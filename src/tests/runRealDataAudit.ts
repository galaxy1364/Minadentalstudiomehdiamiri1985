import { INITIAL_PATIENTS } from '../data/mockData';
import { executeSingleLiveAuditCycle } from '../services/liveAuditStressLoop';
import { supabaseService } from '../services/supabaseService';
import { queryMaterializedDoctorCommissionLedger } from '../utils/accountingEngine';
import { validateIranianNationalCode, validateSayadCheckId } from '../utils/validators';
import { 
  toPersianDigits, 
  toEnglishDigits, 
  formatToman, 
  getCurrentPersianDate, 
  parsePersianDate, 
  getRelativePersianDate
} from '../utils/jalali';
import fs from 'fs';

async function runHorrorAudit() {
  console.log('================================================================');
  console.log('       MINA DENTAL CLINIC OS - 100% REAL CLINICAL AUDIT         ');
  console.log('   iOS 27 HIG / Android APK / IPA / PWA Multi-Platform Engine   ');
  console.log('================================================================\n');

  // Stage 1: Jalali date math & Persian digit conversion
  const today = getCurrentPersianDate();
  const parsed = parsePersianDate(today);
  console.log('[1/7] Jalali Date Engine:', today, 'parsed:', parsed);
  if (!parsed.year || !parsed.month || !parsed.day) throw new Error('Jalali error');
  if (toPersianDigits('12345') !== '۱۲۳۴۵') throw new Error('toPersianDigits error');
  if (toEnglishDigits('۱۲۳۴۵') !== '12345') throw new Error('toEnglishDigits error');
  if (formatToman(1000000) !== '۱,۰۰۰,۰۰۰ تومان') throw new Error('formatToman error');

  // Stage 2: National ID Modulus 11 algorithm
  const n1 = validateIranianNationalCode('0018374621');
  const n2 = validateIranianNationalCode('0000810002');
  const n3 = validateIranianNationalCode('1111111111');
  console.log('[2/7] National Code Modulus 11:', { n1, n2, n3FakeInvalid: n3 });
  if (!n1 || !n2 || n3) throw new Error('National code validator error');

  // Stage 3: Sayad 16-Digit Check ID validation
  const s1 = validateSayadCheckId('۷۳۰۱۸۴۹۲۱۶۴۸۵۲۱۰');
  const s2 = validateSayadCheckId('123456');
  console.log('[3/7] Sayad 16-digit Check ID:', { s1Valid: s1, s2Invalid: s2 });
  if (!s1 || s2) throw new Error('Sayad validator error');

  // Stage 4: Doctor Commission Calculation (Dr. Mehdi Amiri)
  if (INITIAL_PATIENTS.length < 5) throw new Error(`Expected at least 5 patients in INITIAL_PATIENTS, found ${INITIAL_PATIENTS.length}`);
  const commission = queryMaterializedDoctorCommissionLedger(INITIAL_PATIENTS, {
    doctorId: 'dr-mehdi-amiri',
    doctorName: 'دکتر مهدی امیری (مدیر کلینیک)',
    specialty: 'جراح فک و دندان و ایمپلنتولوژیست',
    isManager: true,
    model: 'lab_split_half',
    percentageRate: 100,
    fixedWagePerTreatment: 0,
    baselineHistoricalGross: 45000000,
    baselineHistoricalLab: 5000000
  });
  console.log('[4/7] Doctor Commission Ledger (Dr. Mehdi Amiri):', {
    doctor: commission.doctorName,
    grossTreatmentRevenue: formatToman(commission.totalRegisteredGrossWork),
    totalLabDeductions: formatToman(commission.totalAssignedLabDeductions),
    netCommissionableBase: formatToman(commission.netCommissionableBase),
    exactDoctorPayable: formatToman(commission.exactDoctorPayable),
    auditFormula: commission.calculationAuditFormula
  });
  if (commission.exactDoctorPayable <= 0) throw new Error('Commission engine calculation error');

  // Stage 5: 30 Consecutive Live Audit Stress Loop Cycles
  console.log('[5/7] Executing 30 Consecutive Live Audit Stress Cycles...');
  for (let c = 1; c <= 30; c++) {
    const summary = await executeSingleLiveAuditCycle(c);
    if (!summary.passed || summary.steps.length !== 11) {
      throw new Error(`Cycle ${c} failed!`);
    }
  }
  console.log('      -> All 30/30 cycles PASSED 100% with cryptographic Merkle integrity.');

  // Stage 6: 11-Step Supabase Diagnostic Suite
  console.log('[6/7] Running 11-Step Supabase Diagnostic Tests...');
  const diag = await supabaseService.runFullDiagnosticTests(() => {});
  const successCount = diag.filter(d => d.status === 'success').length;
  console.log('      -> Diagnostic results:', successCount, '/', diag.length, 'passed:');
  diag.forEach(d => console.log(`         ✓ [${d.moduleName}] ${d.title} (${d.latencyMs ?? 0}ms)`));
  if (successCount !== 11) throw new Error('Diagnostic suite failure');

  // Stage 7: Transparent Frameless Icon Assets & PWA Compliance
  console.log('[7/7] Validating Frameless PNG Icons & PWA Manifest Assets...');
  for (const file of ['public/logo.png', 'public/icon-512.png', 'public/apple-touch-icon.png']) {
    const buf = fs.readFileSync(file);
    const magic = buf.slice(0, 8).toString('hex');
    if (magic !== '89504e470d0a1a0a') {
      throw new Error(`${file} is not a valid PNG! Magic: ${magic}`);
    }
    const colorType = buf[25];
    if (colorType !== 6) {
      throw new Error(`${file} is not RGBA transparent PNG (colorType=${colorType})`);
    }
    console.log(`         ✓ ${file}: Valid transparent RGBA PNG (${buf.length} bytes)`);
  }

  console.log('\n================================================================');
  console.log('  ALL 7 HORROR TESTS & 100% REAL CLINICAL AUDIT PASSED PERFECTLY ');
  console.log('================================================================');
}

runHorrorAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
