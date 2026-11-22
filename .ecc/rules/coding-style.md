# ECC Rule: Coding Style & Modularity (affaan-m/ecc)

## Core Standards
1. **Immutability First**: Never mutate React state arrays/objects or clinical ledgers in place. Always create new references with spread/map/filter.
2. **Strict TypeScript Hygiene**: Zero `tsc --noEmit` errors. Prefer explicit interfaces and discriminated unions over untyped blobs.
3. **Structured Logging Only**: Never emit unguarded `console.log` in production `src/` modules. Use `eccLogger` (`src/utils/eccLogger.ts`) which redacts sensitive credentials, tokens, national IDs, and phone numbers.
4. **Explicit Interactive Semantics**:
   - Every non-submit `<button>` MUST carry `type="button"`.
   - Every icon-only button MUST declare `aria-label`.
   - Never call `window.alert`, `window.confirm`, or `window.open` (sandboxed iframe & mobile PWA safe).
   - Guard `window.print?.()` and delegate all clipboard writes to `copyTextSafely()`.
5. **Financial Precision**: All clinic ledgers and doctor commissions MUST use `10^-6` integer micro-unit arithmetic (`accountingEngine.ts`) to guarantee zero IEEE-754 drift.
6. **File Modularity Budget**: Target `< 800` lines per new module/component; decompose legacy monoliths incrementally during Phase 2 refactoring without breaking existing test contracts.
