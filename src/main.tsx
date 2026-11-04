import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initAccount } from './lib/account';
import { handlePaymentReturn } from './lib/pay';
import './index.css';

registerSW({ immediate: true });
handlePaymentReturn();
initAccount();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
