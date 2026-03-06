import { useAuth } from '../hooks/useAuth';

export function Header() {
  const { user } = useAuth();

  return (
    <header class="safe-area-top" style={{
      background: 'var(--color-primary)',
      color: 'var(--color-white)',
      padding: 'var(--spacing-md)',
      boxShadow: 'var(--shadow)'
    }}>
      <div class="container flex items-center justify-between">
        <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
          おくすりリマインダー
        </h1>
        {user && (
          <span style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9 }}>
            {user.displayName}
          </span>
        )}
      </div>
    </header>
  );
}
