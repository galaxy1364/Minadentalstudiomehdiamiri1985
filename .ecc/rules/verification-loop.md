# ECC Rule: Continuous Verification Loop (affaan-m/ecc)

## 7-Step Engineering Loop
`plan -> test -> implement -> review -> verify -> remember -> improve`

### Release Gate Checklist (Execute Before Any Production Release)
1. `npm run lint` — Zero TypeScript diagnostics (`tsc --noEmit`).
2. `npm run test:ecc` — 100% pass on ECC AgentShield & Coding Style static/runtime audit.
3. `npm run test:vitest` — 100% pass on interactive DOM & unit test suite.
4. `npm run test:modules` — 18/18 clinic modules score 10/10.
5. `npm run test:industrial` — 22/22 industrial SSR, RBAC, PWA, and performance checks pass.
6. `npm run build` — Clean Vite production bundle + Workbox service worker + PWA manifest.
7. Dependency Audit — Zero High/Critical runtime vulnerabilities (`bun audit` / `npm audit`).
