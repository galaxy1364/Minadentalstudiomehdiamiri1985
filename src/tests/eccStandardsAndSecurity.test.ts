import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import {
  parseAndValidateClinicBackup,
  validateSupabaseConfigInput,
  aiConsultRequestSchema,
  stripDangerousObjectKeys,
} from '../utils/eccSchemas';
import { redactSensitiveText } from '../utils/eccLogger';
import { consultDentalAi } from '../services/geminiDentalAi';
import { supabaseService } from '../services/supabaseService';
import { decodeBarcodeFromImageData, resolveClinicScanPayload } from '../utils/qrBarcodeScanner';
import { INITIAL_INVENTORY, INITIAL_PATIENTS } from '../data/mockData';

function renderQrToRgbaImageData(text: string, scale = 6, margin = 4): ImageData {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const size = modules.size;
  const dim = (size + margin * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4);
  data.fill(255); // solid white background

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules.get(r, c)) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const py = (r + margin) * scale + dy;
            const px = (c + margin) * scale + dx;
            const idx = (py * dim + px) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  return { data, width: dim, height: dim, colorSpace: 'srgb' } as ImageData;
}

describe('[MD-TST-33] ECC (affaan-m/ecc) Security Hardening, Zod Boundaries & Server AI Proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    supabaseService.resetToDefaultConfig();
  });

  it('validates clinic backup JSON via Zod and strips prototype-pollution keys', () => {
    const maliciousJson = JSON.stringify({
      version: '27.5.0',
      clinicName: 'کلینیک مینادنتال',
      patients: [{ id: 'pat-10', fullName: 'مریم رضایی', phone: '۰۹۱۲۳۴۵۶۷۸۹' }],
      appointments: [{ id: 'apt-10', patientName: 'مریم رضایی', date: '۱۴۰۵/۰۲/۱۰', time: '۱۱:۰۰' }],
      constructor: { prototype: { hacked: true } },
    });

    const parsed = parseAndValidateClinicBackup(maliciousJson);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.patients).toHaveLength(1);
      expect(parsed.data.appointments).toHaveLength(1);
      expect(Object.prototype.hasOwnProperty.call(parsed.data, 'constructor')).toBe(false);
    }

    const cleaned = stripDangerousObjectKeys(JSON.parse('{"__proto__":{"polluted":1},"ok":true}'));
    expect((cleaned as any).ok).toBe(true);
    expect(({} as any).polluted).toBeUndefined();

    const invalidType = parseAndValidateClinicBackup(JSON.stringify({ patients: 'invalid', appointments: [] }));
    expect(invalidType.ok).toBe(false);

    const corruptJson = parseAndValidateClinicBackup('{not-valid-json');
    expect(corruptJson.ok).toBe(false);
  });

  it('blocks SSRF metadata IPs, private RFC1918 networks, and javascript: URIs in Supabase config', () => {
    const validKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_payload_12345.sig_xyz';

    expect(validateSupabaseConfigInput('https://minadental-live.supabase.co', validKey).ok).toBe(true);
    expect(validateSupabaseConfigInput('http://localhost:54321', validKey).ok).toBe(true);

    // Blocked dangerous endpoints
    expect(validateSupabaseConfigInput('http://169.254.169.254/latest/meta-data/', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('https://169.254.169.254/', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('https://10.0.0.15/rest/v1', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('https://192.168.1.50/', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('https://172.16.0.8/', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('javascript:alert(1)', validKey).ok).toBe(false);
    expect(validateSupabaseConfigInput('http://insecure-clinic.example.com', validKey).ok).toBe(false);

    // Service rejects invalid config without corrupting active config
    const rejectRes = supabaseService.setConfig('http://169.254.169.254/latest', validKey);
    expect(rejectRes.ok).toBe(false);
    expect(supabaseService.getConfig().url).not.toContain('169.254.169.254');
  });

  it('redacts API keys, JWT tokens, and credentials in ECC structured logger', () => {
    const leaked = redactSensitiveText(
      'Authorization: Bearer secret_token_999 key=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz12345 jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature123'
    );
    expect(leaked).not.toContain('secret_token_999');
    expect(leaked).not.toContain('AIzaSyAbCdEf');
    expect(leaked).not.toContain('signature123');
    expect(leaked).toContain('[REDACTED_API_KEY]');
    expect(leaked).toContain('[REDACTED_JWT]');
  });

  it('routes Dental AI consultations through /api/ai/consult server proxy and falls back cleanly when offline', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'پاسخ تخصصی دریافت‌شده از پروکسی امن سرور مینادنتال', model: 'gemini-4-hydrogen' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const serverReply = await consultDentalAi('پروتکل جراحی ایمپلنت دندان ۶ بالا', {
      fullName: 'علی مرادی',
      age: 42,
      medicalHistory: ['فشار خون'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/consult',
      expect.objectContaining({ method: 'POST' })
    );
    expect(serverReply).toContain('پروکسی امن سرور');

    // Simulate server 503 / offline fallback
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const fallbackReply = await consultDentalAi('پروتکل جراحی ایمپلنت در استخوان تیپ ۴', {
      fullName: 'علی مرادی',
      medicalHistory: ['فشار خون'],
    });
    expect(fallbackReply).toContain('تحلیل بالینی و گایدلاین هوشمند مینادنتال');
    expect(fallbackReply).toContain('ایمپلنت');

    // Schema rejects oversized or empty prompts
    expect(aiConsultRequestSchema.safeParse({ prompt: 'a' }).success).toBe(false);
    expect(aiConsultRequestSchema.safeParse({ prompt: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('decodes real generated QR pixel matrices end-to-end and returns null on blank camera frames (zero fake fallbacks)', () => {
    // 1. Real GS1-128 dental composite QR matrix
    const gs1Payload = '(01)04027591001234(17)281231(10)LOT405B(30)4';
    const gs1Decoded = decodeBarcodeFromImageData(renderQrToRgbaImageData(gs1Payload));
    expect(gs1Decoded).toBe(gs1Payload);
    const gs1Entity = resolveClinicScanPayload(gs1Decoded!, INITIAL_PATIENTS, INITIAL_INVENTORY);
    expect(gs1Entity?.kind).toBe('product_data');

    // 2. Real Sayad 16-digit check QR matrix
    const sayadPayload = 'https://sayad.ir/check?id=7491839216485299&bank=mellat&amount=12500000';
    const sayadDecoded = decodeBarcodeFromImageData(renderQrToRgbaImageData(sayadPayload));
    expect(sayadDecoded).toBe(sayadPayload);
    const sayadEntity = resolveClinicScanPayload(sayadDecoded!, INITIAL_PATIENTS, INITIAL_INVENTORY);
    expect(sayadEntity?.kind).toBe('sayad_check');
    if (sayadEntity?.kind === 'sayad_check') {
      expect(sayadEntity.parsed.sayadId).toBe('7491839216485299');
      expect(sayadEntity.parsed.bankName).toBe('بانک ملت');
    }

    // 3. Real clinic patient QR card matrix
    const firstPatient = INITIAL_PATIENTS[0];
    const patPayload = `MINA-PAT-${firstPatient.fileNumber}`;
    const patDecoded = decodeBarcodeFromImageData(renderQrToRgbaImageData(patPayload));
    expect(patDecoded).toBe(patPayload);
    const patEntity = resolveClinicScanPayload(patDecoded!, INITIAL_PATIENTS, INITIAL_INVENTORY);
    expect(patEntity?.kind).toBe('patient');

    // 4. Blank white frame MUST return null (never fabricate a barcode)
    const blankData = new Uint8ClampedArray(200 * 200 * 4).fill(255);
    const blankDecoded = decodeBarcodeFromImageData({
      data: blankData,
      width: 200,
      height: 200,
      colorSpace: 'srgb',
    } as ImageData);
    expect(blankDecoded).toBeNull();
  });

  it('enforces Iran no-VPN zero-foreign-asset compliance (self-hosted Vazirmatn, zero foreign CDNs, no unconfigured Supabase traffic)', () => {
    const root = process.cwd();
    const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const mainTsx = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
    const swJs = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const viteCfg = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');

    const forbiddenCdns = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net',
      'unpkg.com',
      'cdnjs.cloudflare.com',
      'googletagmanager.com',
    ];
    for (const cdn of forbiddenCdns) {
      expect(indexHtml).not.toContain(cdn);
      expect(swJs).not.toContain(cdn);
      expect(viteCfg).not.toContain(cdn);
    }

    // Vazirmatn font is locally bundled via @fontsource/vazirmatn
    expect(mainTsx).toContain('@fontsource/vazirmatn/400.css');
    expect(mainTsx).toContain('@fontsource/vazirmatn/700.css');

    // Service Worker explicitly bypasses /api/ live clinic routes
    expect(swJs).toContain("url.pathname.startsWith('/api/')");

    // Unconfigured placeholder Supabase client must not initialize background foreign network connections
    supabaseService.resetToDefaultConfig();
    expect(supabaseService.isReady()).toBe(false);
    expect(supabaseService.getClient()).toBeNull();
  });
});
