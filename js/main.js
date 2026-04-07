import { PWA } from './core/pwa.js';
import { App } from './app.js';

// Global error boundary for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global] Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

document.addEventListener('DOMContentLoaded', async () => {
    await PWA.init();
    App.init();
});
