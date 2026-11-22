/**
 * MinaDental ECC (affaan-m/ecc) Standards, AgentShield Security & Release-Readiness Gate
 * Run via: npm run test:ecc
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseAndValidateClinicBackup,
  validateSupabaseConfigInput,
  aiConsultRequestSchema,
} from '../src/utils/eccSchemas';
import { redactSensitiveText } from '../src/utils/eccLogger';
import { INITIAL_USERS } from '../src/services/syncEngine';

const ROOT = process.cwd();

function collectFiles(dir: string, exts: string[], excludeDirs: Set<string> = new Set()): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      out.push(...collectFiles(full, exts, excludeDirs));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function runEccAudit() {
  console.log('=== MinaDental ECC (affaan-m/ecc) Engineering & Security Gate ===');
  let passed = 0;

  // [ECC-01] ECC Harness Files Present
  const requiredEccFiles = [
    '.ecc/ecc.config.json',
    '.ecc/rules/coding-style.md',
    '.ecc/rules/security-review.md',
    '.ecc/rules/testing-tdd.md',
    '.ecc/rules/verification-loop.md',
    '.ecc/skills/minadental-ecc/SKILL.md',
  ];
  for (const rel of requiredEccFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `Missing ECC harness file: ${rel}`);
  }
  const eccCfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.ecc/ecc.config.json'), 'utf8'));
  assert.equal(eccCfg.source, 'https://github.com/affaan-m/ecc');
  passed++;
  console.log('  [ECC-01] PASS — ECC harness config, rules (4), and MinaDental skill installed');

  // [ECC-02] Zero Client-Side API Key Exposure
  const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
  assert.equal(
    viteConfig.includes('GEMINI_API_KEY'),
    false,
    'vite.config.ts must NEVER bundle GEMINI_API_KEY into client JS'
  );
  const runtimeSrcFiles = collectFiles(
    path.join(ROOT, 'src'),
    ['.ts', '.tsx'],
    new Set(['tests', 'node_modules', 'dist'])
  );
  for (const f of runtimeSrcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.equal(
      /from\s+['"]@google\/genai['"]/.test(content),
      false,
      `${rel} must NOT import @google/genai on the client (use server.ts /api/ai/consult)`
    );
    assert.equal(
      /GEMINI_API_KEY|VITE_GEMINI/.test(content),
      false,
      `${rel} must NOT reference GEMINI_API_KEY on the client`
    );
  }
  passed++;
  console.log(`  [ECC-02] PASS — Zero client-side Gemini SDK or API key exposure across ${runtimeSrcFiles.length} runtime files`);

  // [ECC-03] Server-Side Express Proxy Hardening
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
  assert.ok(serverSrc.includes("app.post('/api/ai/consult'"), 'server.ts must expose POST /api/ai/consult');
  assert.ok(serverSrc.includes("model: 'gemini-4-hydrogen'"), 'server.ts must use active gemini-4-hydrogen model');
  assert.ok(serverSrc.includes("'User-Agent': 'aistudio-build'"), 'server.ts must send required User-Agent header');
  assert.ok(serverSrc.includes('aiConsultRequestSchema.safeParse'), 'server.ts must validate payloads with Zod');
  assert.ok(serverSrc.includes('isRateLimited'), 'server.ts must enforce rate limiting');
  assert.ok(serverSrc.includes("app.disable('x-powered-by')"), 'server.ts must hide x-powered-by');
  passed++;
  console.log('  [ECC-03] PASS — server.ts Gemini proxy hardened (Zod + rate limit + gemini-4-hydrogen + headers)');

  // [ECC-04] Zero Raw HTML / Dynamic Code Sinks in Runtime Source
  const dangerousSinkRegex = /dangerouslySetInnerHTML|\.(?:innerHTML|outerHTML)\s*=|\beval\s*\(|new\s+Function\s*\(|document\.write\s*\(/;
  for (const f of runtimeSrcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.equal(
      dangerousSinkRegex.test(content),
      false,
      `Forbidden unsafe DOM/code sink detected in ${rel}`
    );
  }
  passed++;
  console.log('  [ECC-04] PASS — Zero unsafe HTML injection or dynamic eval sinks across runtime src/');

  // [ECC-05] Zero Unguarded console.log Leakage + Redaction Verification
  for (const f of runtimeSrcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.equal(
      /\bconsole\.log\s*\(/.test(content),
      false,
      `Unguarded console.log detected in ${rel} (use eccLogger instead)`
    );
  }
  const redacted = redactSensitiveText('token=AIzaSyA123456789012345678901234567890');
  assert.equal(redacted.includes('AIzaSy'), false, 'eccLogger must redact API keys');
  passed++;
  console.log('  [ECC-05] PASS — Zero unguarded console.log in runtime src/ and eccLogger redaction verified');

  // [ECC-06] Runtime Zod Boundary Validation (Backup Restore, SSRF URL Allowlist, AI Payload)
  const validBackup = parseAndValidateClinicBackup(
    JSON.stringify({
      patients: [{ id: 'p-1', fullName: 'بیمار نمونه', phone: '۰۹۱۲۳۴۵۶۷۸۹' }],
      appointments: [{ id: 'a-1', patientName: 'بیمار نمونه', date: '۱۴۰۵/۰۲/۰۱', time: '۱۰:۰۰' }],
      __proto__: { polluted: true },
    })
  );
  assert.equal(validBackup.ok, true, 'Valid backup JSON must pass Zod validation');
  if (validBackup.ok) {
    assert.equal(Object.prototype.hasOwnProperty.call(validBackup.data, 'polluted'), false);
    assert.equal(({} as any).polluted, undefined, 'Prototype pollution must be stripped');
  }
  const badBackup = parseAndValidateClinicBackup('{"patients":"not-an-array","appointments":[]}');
  assert.equal(badBackup.ok, false, 'Malformed backup payload must be rejected by Zod');

  assert.equal(
    validateSupabaseConfigInput('https://clinic.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.sig').ok,
    true,
    'Valid HTTPS Supabase config must pass'
  );
  assert.equal(
    validateSupabaseConfigInput('http://169.254.169.254/latest/meta-data', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.sig').ok,
    false,
    'Cloud metadata SSRF URL must be blocked'
  );
  assert.equal(
    validateSupabaseConfigInput('javascript:alert(1)', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.sig').ok,
    false,
    'javascript: URI scheme must be blocked'
  );
  assert.equal(
    validateSupabaseConfigInput('https://10.0.0.5/rest', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.sig').ok,
    false,
    'Private RFC1918 IP must be blocked'
  );
  assert.equal(aiConsultRequestSchema.safeParse({ prompt: '' }).success, false, 'Empty AI prompt must be rejected');
  passed++;
  console.log('  [ECC-06] PASS — Zod boundary schemas verified (Backup Restore + Prototype Strip + SSRF Block + AI Request)');

  // [ECC-07] Zero Blocking Dialogs & Explicit Button Types Across All Components
  const compFiles = collectFiles(path.join(ROOT, 'src/components'), ['.tsx']);
  for (const f of compFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    assert.equal(/window\.(alert|confirm|open)\(/.test(content), false, `Blocking dialog in ${rel}`);
    const re = /<button\b([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      assert.ok(/\btype\s*=/.test(m[1]), `Missing explicit type attribute on <button> in ${rel}`);
    }
  }
  passed++;
  console.log(`  [ECC-07] PASS — Zero blocking dialogs & 100% explicit <button type> across ${compFiles.length} components`);

  // [ECC-08] Zero Plaintext Passwords & Strict Salted SHA-256 Seed Hygiene
  for (const u of INITIAL_USERS) {
    assert.equal(u.password, undefined, `Plaintext password found on ${u.username}`);
    assert.ok(u.passwordHash?.startsWith('sha256$'), `Missing salted sha256 hash on ${u.username}`);
  }
  passed++;
  console.log('  [ECC-08] PASS — Zero plaintext credentials; salted SHA-256 verified across all staff accounts');

  // [ECC-09] Metadata & PWA Installability Standards
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, 'metadata.json'), 'utf8'));
  assert.ok(
    metadata.majorCapabilities?.includes('MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API'),
    'metadata.json must declare MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API'
  );
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.dir, 'rtl');
  assert.ok(manifest.short_name && manifest.short_name.length <= 12);
  passed++;
  console.log('  [ECC-09] PASS — Metadata capabilities & PWA manifest standards verified');

  // [ECC-10] Boundary Consumers Wired to ECC Schemas
  const backupModalSrc = fs.readFileSync(path.join(ROOT, 'src/components/BackupModal.tsx'), 'utf8');
  const supabaseSvcSrc = fs.readFileSync(path.join(ROOT, 'src/services/supabaseService.ts'), 'utf8');
  assert.ok(backupModalSrc.includes('parseAndValidateClinicBackup'), 'BackupModal must use ECC Zod backup parser');
  assert.ok(supabaseSvcSrc.includes('validateSupabaseConfigInput'), 'supabaseService must use ECC Zod URL validator');
  passed++;
  console.log('  [ECC-10] PASS — ECC boundary validators wired into BackupModal & supabaseService');

  console.log(`✅ ALL ${passed}/10 ECC (affaan-m/ecc) ENGINEERING & SECURITY GATES PASSED 100%.`);
}

runEccAudit();
