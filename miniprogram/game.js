import { startApp } from './js/app.js';
import { whenWxReady } from './js/platform.js';

whenWxReady(() => {
  startApp();
});
