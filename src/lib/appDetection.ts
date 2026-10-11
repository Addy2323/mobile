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
 * Triggers the automatic download of the Android Installer (.apk),
 * and if available, simultaneously invokes the native PWA WebAPK installer prompt.
 */
export async function triggerAppInstallation(): Promise<{ success: boolean; method: 'pwa' | 'apk' | 'ios' }> {
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

  // 3. Trigger automatic direct download of the APK installer
  try {
    const link = document.createElement('a');
    link.href = '/api/app/download-installer';
    link.download = 'LumoSplit-Installer.apk';
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true, method: 'apk' };
  } catch (err) {
    console.error('Download trigger error:', err);
    window.open('/api/app/download-installer', '_blank');
    return { success: true, method: 'apk' };
  }
}
