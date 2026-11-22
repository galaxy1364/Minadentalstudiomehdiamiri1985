---
name: "minadental-ecc"
source: "https://github.com/affaan-m/ecc"
description: "Everything Claude Code (ECC) engineering standards, AgentShield security gates, Zod boundary validation, structured redacted logging, and continuous verification loop tailored for MinaDental Clinic OS (RTL Persian iOS 27 PWA / APK / IPA)."
---

# MinaDental ECC Engineering Skill

## When to Apply
Apply on every feature, audit, refactor, API route, modal, and release preparation task in MinaDental.

## Enforced Modules in Codebase
- `src/utils/eccSchemas.ts`: Strict Zod v4 validation at untrusted boundaries (Backup JSON restore, Supabase URL/key config, AI consult payloads, clinical records).
- `src/utils/eccLogger.ts`: Redacted, dev-scoped structured logger replacing raw `console.log`.
- `server.ts`: Express server-side proxy for `/api/ai/consult` (`@google/genai` with `gemini-4-hydrogen`), rate limiting, body size caps, and security headers.
- `scripts/runEccStandardsAudit.ts`: Executable ECC AgentShield & quality gate (`npm run test:ecc`).

## Verification Command
```bash
npm run test:all
```
