/**
 * Utility for detecting if LUMO Split is running in a browser vs standalone installed app,
 * and managing PWA installation prompts and APK installer downloads.
 */

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Standard W3C display-mode media query
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;

  // 2. iOS Safari standalone property
  const isIosStandalone = (window.navigator as any).standalone === true;

  // 3. Android app referrer (TWA / WebView / installed package)
  const isAndroidReferrer = document.referrer?.includes('android-app://') || false;

  // 4. Custom query parameter or storage flag
  const isQueryStandalone =
    window.location.search.includes('source=pwa') ||
    window.location.search.includes('mode=standalone');

  const isStorageStandalone = localStorage.getItem('lumo_app_installed') === 'true';

  return isStandaloneMedia || isIosStandalone || isAndroidReferrer || isQueryStandalone || isStorageStandalone;
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

// Global deferred prompt store
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    window.dispatchEvent(new Event('lumo_install_prompt_ready'));
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('lumo_app_installed', 'true');
    globalDeferredPrompt = null;
    window.dispatchEvent(new Event('lumo_app_installed_event'));
  });
}

export function getDeferredInstallPrompt(): any {
  return globalDeferredPrompt;
}

/**
 * Triggers the native PWA WebAPK installer prompt if available,
 * or returns guidance instructions so the app can show the step-by-step installation guide.
 */
export async function triggerAppInstallation(): Promise<{ success: boolean; method: 'pwa' | 'ios' | 'guide' }> {
  // 1. If native beforeinstallprompt is ready, trigger it
  if (globalDeferredPrompt) {
    try {
      globalDeferredPrompt.prompt();
      const choiceResult = await globalDeferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        localStorage.setItem('lumo_app_installed', 'true');
        globalDeferredPrompt = null;
        return { success: true, method: 'pwa' };
      }
    } catch (err) {
      console.warn('Native prompt error:', err);
    }
  }

  // 2. On iOS device without beforeinstallprompt
  if (isIosDevice()) {
    return { success: true, method: 'ios' };
  }

  // 3. Fallback: guide user to install via Chrome menu (Add to Home screen)
  return { success: true, method: 'guide' };
}
