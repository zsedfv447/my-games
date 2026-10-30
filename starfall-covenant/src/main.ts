import { startApp } from './ui/app';
import { registerServiceWorker } from './pwa/register';

startApp(document.querySelector<HTMLDivElement>('#app')!);
registerServiceWorker();
