import { PWA } from './core/pwa.js';
import { App } from './app.js';

document.addEventListener('DOMContentLoaded', async () => {
    await PWA.init();
    App.init();
});
