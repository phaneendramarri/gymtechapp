import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The inline boot splash in index.html owns the first paint — remove it as
// soon as React takes over so it never lingers over the app.
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('boot')?.remove(), 50);
});
