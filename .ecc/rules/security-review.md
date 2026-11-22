# ECC Rule: Security Review & AgentShield (affaan-m/ecc)

## Mandatory Security Controls
1. **Zero Client-Side Secrets**:
   - Private API keys (e.g., `GEMINI_API_KEY`) MUST ONLY live in server-side `process.env` (`server.ts`).
   - NEVER expose secrets in `vite.config.ts` `define` blocks or `VITE_*` browser variables.
2. **Runtime Schema Validation at Every Boundary (Zod)**:
   - Validate all external JSON uploads (e.g., Backup Restore in `BackupModal.tsx`), cloud endpoint configurations (`supabaseService.ts`), and API payloads (`/api/ai/consult`) through `src/utils/eccSchemas.ts`.
   - Strip prototype-pollution keys (`__proto__`, `constructor`, `prototype`) before hydrating untrusted JSON.
3. **SSRF & URL Allowlist Enforcement**:
   - Cloud sync URLs MUST use `https://` (or explicit local dev loopback) and MUST block `javascript:`, `data:`, and cloud metadata/private IP ranges (`169.254.169.254`, `10.*`, `172.16-31.*`, `192.168.*`).
4. **Zero Raw HTML Injection**:
   - Never use `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval()`, or `new Function()`.
5. **Role-Based Access Control (RBAC)**:
   - Destructive mutations (deletions, payment refunds, tariff edits, backup restore, staff edits) MUST pass `isClinicManager` / `verifyManagerDeletion` and archive records to Trash Vault + immutable audit log.
   - Zero plaintext passwords in seed data, React state, or `localStorage`; always hash with salted SHA-256 (`authCrypto.ts`).
6. **Server Hardening (`server.ts`)**:
   - Enforce JSON payload size limits (`1mb`), per-IP rate limiting on `/api/*`, `X-Content-Type-Options: nosniff`, and sanitized non-leaking error responses.
