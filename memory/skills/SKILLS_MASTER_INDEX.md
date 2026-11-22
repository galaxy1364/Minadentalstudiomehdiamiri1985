# فهرست جامع مهارت‌های دائمی برنامه‌نویسی و ممیزی مینادنتال (Skills Master Index)

تمام ۸ مهارت تخصصی زیر به صورت **دائمی** در پوشه حافظه فعال پروژه نصب شده‌اند و پیش از هر توسعه یا ممیزی جدید، طبق زنجیره حافظه خوانده و اعمال می‌شوند:

| ردیف | نام مهارت (Skill ID) | مسیر فایل | حوزه نظارت و تضمین کیفیت |
|---|---|---|---|
| ۱ | `memory-continuity-skill` | `/memory/skills/memory-continuity-skill/SKILL.md` | تداوم حافظه بین سشن‌ها، قوانین کلینیک و رجیستری شناسه‌ها |
| ۲ | `qa-module-auditor-skill` | `/memory/skills/qa-module-auditor-skill/SKILL.md` | تست و ممیزی خودکار ۱۸ ماژول با Vitest + Happy-DOM و امتیازدهی واقعی ۱۰/۱۰ |
| ۳ | `smart-scheduling-clinical-skill` | `/memory/skills/smart-scheduling-clinical-skill/SKILL.md` | موتور نوبت‌دهی فوق هوشمند، جدول ساعتی یونیت‌ها، تداخل، SLA و تقویم جلالی |
| ۴ | `qbank-ui-design-skill` | `/memory/skills/qbank-ui-design-skill/SKILL.md` | طراحی کیوبانک، رنگ‌بندی روشن بدون تم تیره، چیپ‌بار، iOS 27 و لمس ۴۴px |
| ۵ | `clinical-dental-workflow-skill` | `/memory/skills/clinical-dental-workflow-skill/SKILL.md` | اتصال پالمر، پرونده بیمار، لابراتوار ۲ مرحله‌ای، ایمپلنت، استریل و رادیولوژی |
| ۶ | `fintech-ledger-precision-skill` | `/memory/skills/fintech-ledger-precision-skill/SKILL.md` | جداسازی سهم پزشک از وصولی مطب، چک صیادی، اقساط و کنترل دسترسی مدیر |
| ۷ | `offline-pwa-sync-skill` | `/memory/skills/offline-pwa-sync-skill/SKILL.md` | سینک آنی پرسنل، بک‌آپ ابری/لوکال، نوتیفیکیشن واقعی گوشی و PWA/APK/IPA |
| ۸ | `typescript-react-architecture-skill` | `/memory/skills/typescript-react-architecture-skill/SKILL.md` | TypeScript سخت‌گیرانه، تایید دو مرحله‌ای (`ArmedActionButton`) و پورتال‌های استاندارد |

## دستورالعمل اجرای مستمر در هر تغییر کد
1. اجرای `npm run test:all` (شامل تایپ‌چک، تست‌های منطق و DOM در `happy-dom`، ممیزی صنعتی ۲۲ بخشی و اسکنر ۱۸ ماژوله).
2. بروزرسانی خودکار `/memory/TEST_AUDIT_LEDGER.json` و `/memory/ACTIVE_GAP_SCANNER.md`.
3. تایید Build تولیدی و لیک‌نشدن هیچ‌گونه `NaN`، `window.alert` یا پس‌زمینه تیره در UI.
