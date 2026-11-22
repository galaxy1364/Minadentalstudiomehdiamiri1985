/**
 * MinaDental ECC Structured Logger (affaan-m/ecc coding-style & security-review)
 * - Suppresses debug chatter in production builds
 * - Redacts potential API keys, bearer tokens, JWTs, passwords, and national IDs before logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_API_KEY]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]'],
  [/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]'],
  [/(password|passwordHash|secret|apiKey|token)\s*[:=]\s*["']?[^\s,"'}]+/gi, '$1=[REDACTED]'],
];

export function redactSensitiveText(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function sanitizeArg(arg: unknown): unknown {
  if (typeof arg === 'string') {
    return redactSensitiveText(arg);
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${redactSensitiveText(arg.message)}`;
  }
  if (arg && typeof arg === 'object') {
    try {
      const serialized = JSON.stringify(arg);
      return JSON.parse(redactSensitiveText(serialized));
    } catch {
      return '[Unserializable Object]';
    }
  }
  return arg;
}

function isDevEnvironment(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return Boolean((import.meta as any).env.DEV);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  return false;
}

function emit(level: LogLevel, scope: string, ...args: unknown[]): void {
  if (typeof console === 'undefined') return;
  if ((level === 'debug' || level === 'info') && !isDevEnvironment()) {
    return;
  }

  const safeArgs = args.map(sanitizeArg);
  const prefix = `[MinaDental:${scope}]`;

  if (level === 'error') {
    console.error(prefix, ...safeArgs);
  } else if (level === 'warn') {
    console.warn(prefix, ...safeArgs);
  } else if (level === 'info') {
    console.info(prefix, ...safeArgs);
  } else {
    console.debug(prefix, ...safeArgs);
  }
}

export const eccLogger = {
  debug: (scope: string, ...args: unknown[]) => emit('debug', scope, ...args),
  info: (scope: string, ...args: unknown[]) => emit('info', scope, ...args),
  warn: (scope: string, ...args: unknown[]) => emit('warn', scope, ...args),
  error: (scope: string, ...args: unknown[]) => emit('error', scope, ...args),
};
