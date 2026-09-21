import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The inline boot splash in index.html owns the first paint — fade it out
// once React takes over so the handoff to the app never cuts abruptly.
requestAnimationFrame(() => {
  setTimeout(() => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.add('boot-hide');
    setTimeout(() => boot.remove(), 300);
  }, 50);
});
