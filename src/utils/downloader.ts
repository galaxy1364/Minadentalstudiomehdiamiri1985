/**
 * MinaDental Reliable Native & Source Package Downloader
 * Provides 1-tap binary downloads without .html extension corruption on Android Chrome & iOS Safari:
 *  - Android Native APK (`MinaDental-v27.5.0.apk`) -> `application/vnd.android.package-archive`
 *  - iPhone / iPad Native IPA (`MinaDental-v27.5.0.ipa`) -> `application/octet-stream`
 *  - iPhone Direct Home-Screen Profile (`MinaDental-iOS27.mobileconfig`) -> `application/x-apple-aspen-config`
 *  - Full Source Code ZIP (`minadental-source-full.zip`) -> `application/zip`
 */

export const MINADENTAL_PACKAGE_VERSION = '27.5.0';

export function getProjectArchiveUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/minadental-source-full.zip`;
  }
  return '/minadental-source-full.zip';
}

export function getAndroidApkUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/MinaDental-v${MINADENTAL_PACKAGE_VERSION}.apk`;
  }
  return `/MinaDental-v${MINADENTAL_PACKAGE_VERSION}.apk`;
}

export function getIosIpaUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/MinaDental-v${MINADENTAL_PACKAGE_VERSION}.ipa`;
  }
  return `/MinaDental-v${MINADENTAL_PACKAGE_VERSION}.ipa`;
}

export function getIosMobileConfigUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/MinaDental-iOS27.mobileconfig`;
  }
  return '/MinaDental-iOS27.mobileconfig';
}

async function clearStaleDevServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const scriptUrl =
        reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
      if (scriptUrl.includes('dev-sw.js')) {
        await reg.unregister();
      }
    }
  } catch {
    // ignore service worker inspection errors
  }
}

function isHtmlPayload(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 64));
  let prefix = '';
  for (let i = 0; i < bytes.length; i++) {
    prefix += String.fromCharCode(bytes[i]);
  }
  const trimmed = prefix.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function triggerTypedBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    window.URL.revokeObjectURL(blobUrl);
  }, 4000);
}

async function downloadFileByUrl(
  url: string,
  filename: string,
  explicitMimeType: string,
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  try {
    await clearStaleDevServiceWorkers();

    const separator = url.includes('?') ? '&' : '?';
    const cacheBustedUrl = `${url}${separator}dl=${Date.now()}`;

    const response = await fetch(cacheBustedUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`خطا در دریافت فایل (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || isHtmlPayload(buffer)) {
      throw new Error('پاسخ دریافتی از سرور معتبر نیست؛ در حال تلاش با لینک مستقیم');
    }

    const typedBlob = new Blob([buffer], { type: explicitMimeType });
    triggerTypedBlobDownload(typedBlob, filename);

    onSuccess?.();
    return true;
  } catch (err: any) {
    try {
      const fallbackA = document.createElement('a');
      fallbackA.style.display = 'none';
      fallbackA.href = `${url}${url.includes('?') ? '&' : '?'}direct=${Date.now()}`;
      fallbackA.setAttribute('download', filename);
      document.body.appendChild(fallbackA);
      fallbackA.click();
      setTimeout(() => {
        if (fallbackA.parentNode) fallbackA.parentNode.removeChild(fallbackA);
      }, 2000);
      onSuccess?.();
      return true;
    } catch (e: any) {
      onError?.(err || e);
      return false;
    }
  }
}

export async function downloadProjectArchive(
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  return downloadFileByUrl(
    getProjectArchiveUrl(),
    'minadental-source-full.zip',
    'application/zip',
    onSuccess,
    onError
  );
}

export async function downloadAndroidApk(
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  return downloadFileByUrl(
    getAndroidApkUrl(),
    `MinaDental-v${MINADENTAL_PACKAGE_VERSION}.apk`,
    'application/vnd.android.package-archive',
    onSuccess,
    onError
  );
}

export async function downloadIosIpa(
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  return downloadFileByUrl(
    getIosIpaUrl(),
    `MinaDental-v${MINADENTAL_PACKAGE_VERSION}.ipa`,
    'application/octet-stream',
    onSuccess,
    onError
  );
}

export async function downloadIosMobileConfigProfile(
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  try {
    await clearStaleDevServiceWorkers();
    const response = await fetch(`${getIosMobileConfigUrl()}?dl=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`خطا در دریافت پروفایل آیفون (${response.status})`);
    }
    let xmlText = await response.text();
    if (xmlText.trimStart().toLowerCase().startsWith('<!doctype html')) {
      throw new Error('HTML fallback intercepted mobileconfig');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      xmlText = xmlText.replace(
        /<key>URL<\/key>\s*<string>[^<]+<\/string>/,
        `<key>URL</key>\n\t\t\t<string>${window.location.origin}</string>`
      );
    }
    const blob = new Blob([xmlText], { type: 'application/x-apple-aspen-config' });
    triggerTypedBlobDownload(blob, 'MinaDental-iOS27.mobileconfig');
    onSuccess?.();
    return true;
  } catch (err: any) {
    return downloadFileByUrl(
      getIosMobileConfigUrl(),
      'MinaDental-iOS27.mobileconfig',
      'application/x-apple-aspen-config',
      onSuccess,
      onError
    );
  }
}
