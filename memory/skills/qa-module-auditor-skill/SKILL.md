---
name: qa-module-auditor-skill
description: ممیزی خودکار ۱۸ ماژول بالینی و مالی مینادنتال با تست‌های واقعی تعاملی happy-dom، بررسی دسترسی‌پذیری، نبود اعشار خام و ثبت گزارش شکاف‌ها در حافظه فعال
---

# مهارت ممیزی و تست زنده ماژول‌ها (QA Module Auditor Skill)

## زنجیره ابزار و پلاگین‌های نصب‌شده
- `vitest` + `@testing-library/react` + `happy-dom` + `@vitest/coverage-v8`
- `tsx scripts/runModuleHealthAudit.ts` (`npm run test:modules`)
- `tsx src/tests/industrialAuditSuite.ts` (`npm run test:industrial`)

## چک‌لیست اجباری هر ماژول (`MD-TST-01` تا `MD-TST-18`)
1. **رندر بدون خطا در `happy-dom` و SSR:** نبود `NaN`، `undefined` یا کرش هنگام مانت با دیتای واقعی.
2. **امنیت رابط کاربری:** صفر فراخوانی مسدودکننده `window.alert` / `window.confirm` / `window.open`.
3. **قفل اسکرول افقی موبایل (RTL):** کلاس `w-full max-w-full min-w-0 overflow-x-hidden` روی نمای اصلی.
4. **استاندارد لمسی و WAI-ARIA:** دکمه‌ها حداقل `38px–44px`، مدال‌ها با `role="dialog"` و `aria-modal="true"`.
5. **ثبت نتایج واقعی در `/memory/TEST_AUDIT_LEDGER.json` و `/memory/ACTIVE_GAP_SCANNER.md`.**
