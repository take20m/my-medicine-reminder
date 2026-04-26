import { useState, useEffect } from 'preact/hooks';

const STORAGE_KEY = 'install-banner-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="note"
      style={{
        background: '#FFF8E1',
        borderBottom: '1px solid #F9D648',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)'
      }}
    >
      <span style={{ fontSize: '20px' }} aria-hidden="true">📱</span>
      <div style={{ flex: 1, color: 'var(--color-gray-800)', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
        スマホは <strong>「ホーム画面に追加」</strong> してから使ってね。通知が届きます。
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)', marginTop: '2px' }}>
          iOS は 16.4 以降で Web Push に対応
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
