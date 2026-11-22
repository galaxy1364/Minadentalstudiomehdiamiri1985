import React, { lazy } from 'react';

const RELOAD_GUARD_KEY = 'minadental_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 15000;

export function isDynamicImportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk')
  );
}

export async function purgeStaleModuleCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.update().catch(() => {})));
    }
  } catch {
    // Ignore cache/SW purge restrictions
  }
}

/**
 * Resilient React.lazy wrapper with automatic transient retry and safe one-shot
 * cache-busting recovery when Vite dev dependencies or PWA chunk hashes rotate.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries: number = 2,
  delayMs: number = 350
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
      }
    }

    if (typeof window !== 'undefined' && navigator.onLine && isDynamicImportError(lastError)) {
      try {
        const lastReloadRaw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        const lastReloadTs = lastReloadRaw ? Number(lastReloadRaw) : 0;
        if (!lastReloadTs || Date.now() - lastReloadTs > RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
          await purgeStaleModuleCaches();
          window.location.reload();
          return new Promise<never>(() => {});
        }
      } catch {
        // Ignore sessionStorage errors and let ErrorBoundary handle cleanly
      }
    }

    throw lastError;
  });
}
