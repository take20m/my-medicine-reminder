export function Header() {
  return (
    <header class="safe-area-top" style={{
      background: 'var(--color-primary)',
      color: 'var(--color-white)',
      padding: 'var(--spacing-md)',
      boxShadow: 'var(--shadow)'
    }}>
      <div class="container flex items-center">
        <img
          src="/favicon.svg"
          alt=""
          style={{ width: '28px', height: '28px', marginRight: '8px' }}
        />
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
          おくすりリマインダー
        </h1>
      </div>
    </header>
  );
}
