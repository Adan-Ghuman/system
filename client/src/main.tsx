import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App.js';
import './index.css';
import { ThemeProvider } from './components/ui/Theme.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider><App /></ThemeProvider>
  </React.StrictMode>
);
