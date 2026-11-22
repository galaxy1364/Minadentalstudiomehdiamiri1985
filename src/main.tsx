import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/vazirmatn/300.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/vazirmatn/900.css';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    let refreshingSw = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingSw) return;
      refreshingSw = true;
      window.dispatchEvent(new CustomEvent('minadental:ota-update-ready'));
    });

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // 1. Immediate update check on boot
        registration.update().catch(() => {});

        // 2. Foreground check whenever installed Home Screen PWA is opened on iPhone/Android
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        // 3. Immediate check when internet connection returns
        window.addEventListener('online', () => {
          registration.update().catch(() => {});
        });

        // 4. Periodic 60-second background check
        setInterval(() => {
          if (navigator.onLine) {
            registration.update().catch(() => {});
          }
        }, 60 * 1000);
      },
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('minadental:ota-update-ready'));
        updateSW(true);
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('minadental:pwa-offline-ready'));
      },
    });
  } catch (err) {
    console.warn('PWA service worker registration skipped:', err);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
