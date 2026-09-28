import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './data/store';
import { ToastProvider } from './components/ui';
import './styles/app.css';

// The clickable preview runs inside a sandboxed page, so it keeps its own
// in-memory address bar. The real site uses normal web addresses.
const Router = import.meta.env.MODE === 'preview' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </Router>
  </StrictMode>,
);
