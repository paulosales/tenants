import React from 'react';
import ReactDOM from 'react-dom/client';
import { initWebTelemetry } from './infrastructure/telemetry';
import App from './App';
import './index.css';

initWebTelemetry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
