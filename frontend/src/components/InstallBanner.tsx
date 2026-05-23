import { useState, useEffect } from 'preact/hooks';
import {
  detectPlatform,
  detectBrowserSupport,
  isStandalone,
  type Platform,
  type BrowserSupport,
} from '../utils/platform';

const STORAGE_KEY = 'install-banner-dismissed';

function getMessage(platform: Platform, support: BrowserSupport) {
  if (platform === 'ios' && support === 'not-recommended') {
    return {
      main: (
        <>
          このアプリは <strong>Safari</strong> で開いてください。Safari で開いてから <strong>「ホーム画面に追加」</strong> すると通知が届きます。
        </>
      ),
      sub: 'iOS は 16.4 以降で Web Push に対応。'
    };
  }
  if (platform === 'android' && support === 'not-recommended') {
    return {
      main: (
        <>
          このアプリは <strong>Chrome</strong> で開いてください。Chrome で開いてから <strong>「ホーム画面に追加」</strong> すると通知が届きます。
        </>
      ),
      sub: '※ 他のブラウザでは通知が届かない場合があります。'
    };
  }
  // ios / android の recommended / unknown 向け
  return {
    main: (
      <>
        スマホは <strong>iPhone は Safari</strong>、<strong>Android は Chrome</strong> で開いて、<strong>「ホーム画面に追加」</strong>してから使ってね。通知が届きます。
      </>
    ),
    sub: '※ 他のブラウザでは通知が届かない場合があります。iOS は 16.4 以降で Web Push に対応。'
  };
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [support, setSupport] = useState<BrowserSupport>('unknown');

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const p = detectPlatform();
    if (p === 'desktop') return; // PC では LoginPage 側で案内するのでバナーは出さない
    setPlatform(p);
    setVisible(true);
    detectBrowserSupport(p).then(setSupport);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const { main, sub } = getMessage(platform, support);
  const isWarning = support === 'not-recommended';

  return (
    <div
      role="note"
      style={{
        background: isWarning ? '#FFEBEE' : '#FFF8E1',
        borderBottom: `1px solid ${isWarning ? '#EF9A9A' : '#F9D648'}`,
        padding: 'var(--spacing-sm) var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)'
      }}
    >
      <span style={{ fontSize: '20px' }} aria-hidden="true">{isWarning ? '⚠️' : '📱'}</span>
      <div style={{ flex: 1, color: 'var(--color-gray-800)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
        {main}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)', marginTop: '2px' }}>
          {sub}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="閉じる"
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          color: 'var(--color-gray-600)',
          padding: 'var(--spacing-xs)',
          lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  );
}
