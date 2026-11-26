import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import { ToastProvider } from './components/ui/ToastProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <ToastProvider>
      <App />
    </ToastProvider>
  </MotionConfig>
);
