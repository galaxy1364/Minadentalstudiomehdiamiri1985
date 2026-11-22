/**
 * Safe cross-platform clipboard copy helper for iOS WebView, Android APK, PWA, and Desktop iframes.
 * Falls back cleanly to a temporary textarea + execCommand('copy') when Clipboard API is restricted.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  if (!text || typeof window === 'undefined') return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    if (typeof document === 'undefined' || !document.body) return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
