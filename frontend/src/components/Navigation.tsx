import { route } from 'preact-router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: '今日', icon: '🏠' },
  { path: '/medications', label: 'お薬', icon: '💊' },
  { path: '/history', label: '履歴', icon: '📅' },
  { path: '/settings', label: '設定', icon: '⚙️' }
];

export function Navigation() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <nav class="safe-area-bottom" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--color-white)',
      borderTop: '1px solid var(--color-gray-200)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: 'var(--spacing-sm) 0',
      zIndex: 1000
    }}>
      {navItems.map(item => {
        const isActive = currentPath === item.path ||
          (item.path !== '/' && currentPath.startsWith(item.path));

        return (
          <button
            key={item.path}
            onClick={() => route(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              color: isActive ? 'var(--color-primary)' : 'var(--color-gray-600)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)'
            }}
          >
            <span style={{ fontSize: '24px' }}>{item.icon}</span>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: isActive ? 600 : 400
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
