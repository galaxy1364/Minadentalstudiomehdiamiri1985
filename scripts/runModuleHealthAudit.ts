import fs from 'node:fs';
import path from 'node:path';

interface ModuleAuditSpec {
  moduleId: string;
  testId: string;
  nameFa: string;
  filePath: string;
  kind: 'view' | 'modal' | 'utility';
  vitestTarget: string;
  requiredTokens: string[];
}

const WORKSPACE_ROOT = process.cwd();

const MODULE_SPECS: ModuleAuditSpec[] = [
  {
    moduleId: 'MD-DSH-1405-1000',
    testId: 'MD-TST-01',
    nameFa: 'داشبورد فرماندهی کلینیک',
    filePath: 'src/components/views/DashboardView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-01-Dashboard',
    requiredTokens: ['dashboard-view', 'grid-cols-2', 'پذیرش و نوبت‌دهی']
  },
  {
    moduleId: 'MD-PAT-1405-1001',
    testId: 'MD-TST-02',
    nameFa: 'پرونده بیماران و پذیرش',
    filePath: 'src/components/views/PatientsListView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-02-Patients',
    requiredTokens: ['پرونده', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-APT-1405-1001',
    testId: 'MD-TST-03',
    nameFa: 'نوبت‌دهی فوق هوشمند و تقویم جلالی',
    filePath: 'src/components/views/AppointmentsView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-03',
    requiredTokens: [
      'یونیت آبی',
      'یونیت زرد',
      'یونیت جراحی',
      'جدول ساعتی یونیت‌ها',
      'انتقال به لیست انتظار',
      'سرویس پیامک',
      'ارسال اتوماتیک',
      'buildRecurringSessionDates',
      'calculateUnitCapacityStats',
      'generateAppointmentsCsvContent'
    ]
  },
  {
    moduleId: 'MD-PLM-1405-1001',
    testId: 'MD-TST-04',
    nameFa: 'چارت دندانی پالمر (بزرگسال و اطفال)',
    filePath: 'src/components/PalmerChartModal.tsx',
    kind: 'modal',
    vitestTarget: 'PalmerChartModal (Industrial Section 12)',
    requiredTokens: ['UR', 'UL', 'LR', 'LL', 'role="dialog"']
  },
  {
    moduleId: 'MD-LAB-1405-1001',
    testId: 'MD-TST-05',
    nameFa: 'لابراتوار پروتز (ثبت ۲ مرحله‌ای)',
    filePath: 'src/components/views/LabModuleView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-05-Lab',
    requiredTokens: ['لابراتوار', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-IMP-1405-1001',
    testId: 'MD-TST-06',
    nameFa: 'کاشت ایمپلنت و جراحی',
    filePath: 'src/components/views/ImplantModuleView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-06-Implant',
    requiredTokens: ['ایمپلنت', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-FIN-1405-1001',
    testId: 'MD-TST-07',
    nameFa: 'امور مالی و مطالبات مطب',
    filePath: 'src/components/views/FinancialView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-07-Financial',
    requiredTokens: ['تومان', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-COM-1405-1001',
    testId: 'MD-TST-08',
    nameFa: 'سهم کارکرد پزشکان (مستقل از پرداخت)',
    filePath: 'src/components/DoctorCommissionModal.tsx',
    kind: 'modal',
    vitestTarget: 'DoctorCommissionModal (Industrial Section 4 & 13)',
    requiredTokens: ['queryMaterializedDoctorCommissionLedger', 'role="dialog"']
  },
  {
    moduleId: 'MD-CHK-1405-1001',
    testId: 'MD-TST-09',
    nameFa: 'چک صیادی و چک ضمانت',
    filePath: 'src/components/AddCheckModal.tsx',
    kind: 'modal',
    vitestTarget: 'AddCheckModal (Industrial Section 12)',
    requiredTokens: ['صیادی', 'role="dialog"']
  },
  {
    moduleId: 'MD-INS-1405-1001',
    testId: 'MD-TST-10',
    nameFa: 'اقساط درمانی',
    filePath: 'src/components/InstallmentPlanModal.tsx',
    kind: 'modal',
    vitestTarget: 'InstallmentPlanModal (Industrial Section 13)',
    requiredTokens: ['قسط', 'role="dialog"']
  },
  {
    moduleId: 'MD-INV-1405-1001',
    testId: 'MD-TST-11',
    nameFa: 'انبار متریال و هشدار کسری',
    filePath: 'src/components/views/InventoryView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-11-Inventory',
    requiredTokens: ['انبار', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-STR-1405-1001',
    testId: 'MD-TST-12',
    nameFa: 'استریلیزاسیون و اتوکلاو',
    filePath: 'src/components/views/SterilizationModuleView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-12-Sterilization',
    requiredTokens: ['اتوکلاو', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-XRY-1405-1001',
    testId: 'MD-TST-13',
    nameFa: 'رادیولوژی OPG & RVG',
    filePath: 'src/components/views/XRayModuleView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-13-XRay',
    requiredTokens: ['CBCT', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-REM-1405-1001',
    testId: 'MD-TST-14',
    nameFa: 'یادآوری هوشمند و اعلان گوشی',
    filePath: 'src/components/views/RemindersView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-14-Reminders',
    requiredTokens: ['یادآوری', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-MKT-1405-1001',
    testId: 'MD-TST-15',
    nameFa: 'باشگاه مشتریان و تبلیغات',
    filePath: 'src/components/views/MarketingCampaignsView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-15-Marketing',
    requiredTokens: ['کمپین', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-CLM-1405-1001',
    testId: 'MD-TST-16',
    nameFa: 'بیمه پایه و تکمیلی',
    filePath: 'src/components/views/InsuranceClaimsView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-16-Insurance',
    requiredTokens: ['بیمه', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-AIA-1405-1001',
    testId: 'MD-TST-17',
    nameFa: 'هوش مصنوعی تشخیصی',
    filePath: 'src/components/views/AiAssistantView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-17-AI',
    requiredTokens: ['هوش مصنوعی', 'overflow-x-hidden']
  },
  {
    moduleId: 'MD-SET-1405-1001',
    testId: 'MD-TST-18',
    nameFa: 'تنظیمات تعرفه‌ها، پرسنل و بک‌آپ ابری',
    filePath: 'src/components/views/SettingsView.tsx',
    kind: 'view',
    vitestTarget: 'MD-TST-18-Settings',
    requiredTokens: ['تعرفه‌ها', 'overflow-x-hidden']
  }
];

function findDisallowedDarkLines(filePath: string, content: string): Array<{ line: number; snippet: string }> {
  const hits: Array<{ line: number; snippet: string }> = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\bbg-(?:slate-(?:800|900|950)|\[#0f1b13\])\b/.test(line)) continue;
    // Allow full-screen modal backdrop overlays and the inner medical X-Ray film canvas
    const isBackdrop = line.includes('fixed inset-0');
    const isXrayFilm =
      filePath.endsWith('XRayModuleView.tsx') &&
      (line.includes('from-slate-950') || line.includes('DICOM') || line.includes('activeRecord.boneDensity') || line.includes('bg-slate-950/75'));
    const isAuditConsole =
      filePath.endsWith('PhaseAuditSuiteModal.tsx') || filePath.endsWith('RealWorldClinicTestConsole.tsx');
    if (!isBackdrop && !isXrayFilm && !isAuditConsole) {
      hits.push({ line: i + 1, snippet: line.trim().slice(0, 100) });
    }
  }
  return hits;
}

function findMissingButtonTypes(content: string): number {
  let count = 0;
  const regex = /<button\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (!/\btype\s*=/.test(m[1])) count++;
  }
  return count;
}

function runAudit() {
  const results = MODULE_SPECS.map((spec) => {
    const absPath = path.join(WORKSPACE_ROOT, spec.filePath);
    const exists = fs.existsSync(absPath);
    const gaps: string[] = [];
    const warnings: string[] = [];

    if (!exists) {
      gaps.push(`فایل ماژول یافت نشد: ${spec.filePath}`);
      return {
        ...spec,
        exists: false,
        score: 0,
        status: 'FAIL' as const,
        gaps,
        warnings
      };
    }

    const content = fs.readFileSync(absPath, 'utf8');

    // 1. No blocking browser dialogs
    if (/window\.(alert|confirm|open)\(/.test(content)) {
      gaps.push('استفاده غیرمجاز از window.alert / confirm / open');
    }

    // 2. No dark UI surfaces (noDarkBackgrounds: true)
    const darkHits = findDisallowedDarkLines(spec.filePath, content);
    if (darkHits.length > 0) {
      gaps.push(
        `پس‌زمینه تیره/سیاه غیرمجاز در UI (${darkHits.map((h) => `خط ${h.line}`).join('، ')})`
      );
    }

    // 3. No .000000 raw decimal leaks
    if (/\.000000/.test(content)) {
      gaps.push('نشت اعشار خام (.000000) در نمایش ارقام');
    }

    // 4. Explicit view horizontal overflow protection
    if (spec.kind === 'view' && !content.includes('w-full max-w-full min-w-0 overflow-x-hidden')) {
      gaps.push('نقص قفل اسکرول افقی (w-full max-w-full min-w-0 overflow-x-hidden)');
    }

    // 5. Required clinical & domain tokens
    for (const token of spec.requiredTokens) {
      if (!content.includes(token)) {
        gaps.push(`توکن/قابلیت الزامی یافت نشد: ${token}`);
      }
    }

    // 6. Legacy unit aliases check in AppointmentsView
    if (spec.moduleId === 'MD-APT-1405-1001') {
      if (content.includes("'یونیت ۱'") || content.includes("'یونیت ۲'") || content.includes("'اتاق جراحی'")) {
        gaps.push('برچسب قدیمی یونیت (یونیت ۱/۲ یا اتاق جراحی) به جای نام رسمی یافت شد');
      }
    }

    // 7. Non-blocking advisory checks (explicit button types)
    const missingBtnTypes = findMissingButtonTypes(content);
    if (missingBtnTypes > 0) {
      warnings.push(`${missingBtnTypes} دکمه بدون type صریح (بهبود دسترسی‌پذیری پیشنهادی)`);
    }

    const score = Math.max(0, 10 - gaps.length * 2 - (warnings.length > 0 ? 0.2 : 0));
    return {
      ...spec,
      exists: true,
      score: Number(score.toFixed(1)),
      status: gaps.length === 0 ? ('PASS' as const) : ('FAIL' as const),
      gaps,
      warnings
    };
  });

  const passedModules = results.filter((r) => r.status === 'PASS').length;
  const totalModules = results.length;
  const averageScore = Number(
    (results.reduce((acc, r) => acc + r.score, 0) / Math.max(1, totalModules)).toFixed(2)
  );
  const generatedAtIso = new Date().toISOString();

  const ledger = {
    project: 'MinaDental (مینادنتال)',
    auditEngineVersion: '27.6.0-QA-LOCKED',
    generatedAtIso,
    summary: {
      totalModules,
      passedModules,
      failedModules: totalModules - passedModules,
      averageScoreOutOf10: averageScore,
      allCriticalPassed: passedModules === totalModules
    },
    modules: results
  };

  fs.writeFileSync(
    path.join(WORKSPACE_ROOT, 'memory/TEST_AUDIT_LEDGER.json'),
    JSON.stringify(ledger, null, 2),
    'utf8'
  );

  const mdLines: string[] = [
    '# گزارش زنده اسکنر کمبودها و شناسنامه تست ماژول‌ها (Active Gap Scanner)',
    '',
    `- **زمان اجرا:** \`${generatedAtIso}\``,
    `- **نتیجه کلی:** ${passedModules} از ${totalModules} ماژول تایید کامل (میانگین امتیاز: **${averageScore} / 10**)`,
    '',
    '| شناسه تست | کد ماژول | نام ماژول | هدف Vitest | امتیاز | وضعیت | کمبود / هشدار واقعی |',
    '|---|---|---|---|---|---|---|'
  ];

  for (const r of results) {
    const detail =
      r.gaps.length > 0
        ? `❌ ${r.gaps.join(' ؛ ')}`
        : r.warnings.length > 0
        ? `⚠️ ${r.warnings.join(' ؛ ')}`
        : 'بدون نقص ✓';
    mdLines.push(
      `| \`${r.testId}\` | \`${r.moduleId}\` | ${r.nameFa} | \`${r.vitestTarget}\` | **${r.score}/10** | ${r.status === 'PASS' ? 'PASS ✓' : 'FAIL ❌'} | ${detail} |`
    );
  }

  fs.writeFileSync(
    path.join(WORKSPACE_ROOT, 'memory/ACTIVE_GAP_SCANNER.md'),
    mdLines.join('\n') + '\n',
    'utf8'
  );

  console.log(
    `=== MinaDental 18-Module Health Audit: ${passedModules}/${totalModules} PASS (Avg ${averageScore}/10) ===`
  );
  for (const r of results) {
    const note = r.gaps.length ? `FAIL: ${r.gaps.join('; ')}` : r.warnings.length ? `WARN: ${r.warnings.join('; ')}` : 'OK';
    console.log(`  [${r.testId}] ${r.moduleId} (${r.score}/10) -> ${note}`);
  }

  if (passedModules < totalModules) {
    process.exit(1);
  }
}

runAudit();
