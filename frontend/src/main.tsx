import { render } from 'preact';
import { App } from './App';
import './styles/global.css';

render(<App />, document.getElementById('app')!);

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('SW registered:', registration);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}
