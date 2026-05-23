export type Platform = 'ios' | 'android' | 'desktop';
export type BrowserSupport = 'recommended' | 'not-recommended' | 'unknown';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export async function detectBrowserSupport(platform: Platform): Promise<BrowserSupport> {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;

  if (platform === 'ios') {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua)) return 'not-recommended';
    if (/Safari/i.test(ua)) return 'recommended';
    return 'unknown';
  }

  if (platform === 'android') {
    try {
      const isBrave = await (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave?.isBrave?.();
      if (isBrave) return 'not-recommended';
    } catch {
      // ignore
    }
    if (/SamsungBrowser|EdgA|Firefox|OPR|OPiOS|YaBrowser|DuckDuckGo/i.test(ua)) return 'not-recommended';
    if (/Chrome/i.test(ua)) return 'recommended';
    return 'unknown';
  }

  return 'unknown';
}
