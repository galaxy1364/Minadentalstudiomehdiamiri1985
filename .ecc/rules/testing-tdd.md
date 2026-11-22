# ECC Rule: Testing & TDD Workflow (affaan-m/ecc)

## Red-Green-Refactor Discipline
1. **Write/Update Verification First**: Every bug fix, security hardening patch, or new clinical feature MUST include a deterministic automated test in `src/tests/`.
2. **Multi-Layer Verification Pyramid**:
   - **Layer 1 — Unit & Validation Tests**: Jalali calendar, Modulus-11 national code, 16-digit Sayad ID, Zod boundary schemas, micro-unit accounting.
   - **Layer 2 — Interactive DOM Tests (Vitest + Happy-DOM)**: Click flows, modal portals, keyboard Escape handling, RBAC blocks, clipboard/print safety.
   - **Layer 3 — ECC Standards Gate (`npm run test:ecc`)**: Static + runtime enforcement of all ECC coding, security, and PWA invariants across 100% of `src/`.
   - **Layer 4 — 18-Module Health Audit (`npm run test:modules`)**: Zero dark-surface regressions, horizontal overflow locks, and required clinical tokens.
   - **Layer 5 — 22-Section Industrial SSR Suite (`npm run test:industrial`)**: SSR rendering of every view/modal, zero `NaN`/`undefined`, latency budgets.
3. **Never Bypass Failing Gates**: Every release candidate MUST pass `npm run test:all` and `npm run build` with 0 errors.
