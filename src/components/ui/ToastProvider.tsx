import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface SnackbarOptions {
  id?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'id' | 'title' | 'variant' | 'durationMs'>> {
  description?: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  showSnackbar: (opts: SnackbarOptions) => void;
  dismissToast: (id: string) => void;
  dismissSnackbar: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      showSnackbar: () => {},
      dismissToast: () => {},
      dismissSnackbar: () => {},
    };
  }
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [snackbar, setSnackbar] = useState<SnackbarOptions | null>(null);
  const snackbarTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = opts.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        variant: opts.variant || 'info',
        durationMs: opts.durationMs ?? 3600,
      };
      setToasts((prev) => [item, ...prev].slice(0, 4));

      if (item.durationMs > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, item.durationMs);
      }
    },
    []
  );

  const dismissSnackbar = useCallback(() => {
    if (snackbarTimerRef.current) {
      clearTimeout(snackbarTimerRef.current);
      snackbarTimerRef.current = null;
    }
    setSnackbar(null);
  }, []);

  const showSnackbar = useCallback((opts: SnackbarOptions) => {
    if (snackbarTimerRef.current) {
      clearTimeout(snackbarTimerRef.current);
    }
    const id = opts.id || `snack-${Date.now()}`;
    setSnackbar({ ...opts, id });
    const duration = opts.durationMs ?? 5000;
    if (duration > 0) {
      snackbarTimerRef.current = setTimeout(() => {
        setSnackbar(null);
      }, duration);
    }
  }, []);

  const variantMeta = (variant: ToastVariant) => {
    switch (variant) {
      case 'success':
        return {
          icon: CheckCircle2,
          border: 'border-emerald-500/45',
          iconColor: 'text-emerald-400',
          bar: 'bg-emerald-400',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          border: 'border-amber-500/45',
          iconColor: 'text-amber-400',
          bar: 'bg-amber-400',
        };
      case 'error':
        return {
          icon: ShieldAlert,
          border: 'border-rose-500/50',
          iconColor: 'text-rose-400',
          bar: 'bg-rose-400',
        };
      default:
        return {
          icon: Info,
          border: 'border-blue-500/45',
          iconColor: 'text-blue-400',
          bar: 'bg-blue-400',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ toast, showSnackbar, dismissToast, dismissSnackbar }}>
      {children}

      {/* Sonner-style stacked toasts (top-right desktop, top-center mobile) */}
      <div
        aria-live="polite"
        className="fixed top-18 right-3 left-3 sm:left-auto sm:w-96 z-50 pointer-events-none flex flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item, idx) => {
            const meta = variantMeta(item.variant);
            const Icon = meta.icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.94 }}
                animate={{
                  opacity: 1 - idx * 0.08,
                  y: 0,
                  scale: 1 - idx * 0.02,
                }}
                exit={{ opacity: 0, x: 40, scale: 0.92 }}
                transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
                drag="x"
                dragConstraints={{ left: 0, right: 120 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 70) dismissToast(item.id);
                }}
                className={`pointer-events-auto glass-surface-strong rounded-2xl border ${meta.border} p-3.5 shadow-2xl overflow-hidden relative`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 ${meta.iconColor} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white leading-snug">{item.title}</p>
                    {item.description && (
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(item.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
                    aria-label="Cerrar notificación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {item.durationMs > 0 && (
                  <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: item.durationMs / 1000, ease: 'linear' }}
                    style={{ transformOrigin: 'left' }}
                    className={`h-0.5 ${meta.bar} opacity-75 mt-2.5 rounded-full`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom Snackbar with explicit action button */}
      <div className="fixed bottom-20 md:bottom-5 left-3 right-3 z-50 pointer-events-none flex justify-center">
        <AnimatePresence>
          {snackbar && (
            <motion.div
              key={snackbar.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
              className="pointer-events-auto glass-surface-strong border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl max-w-lg w-full flex items-center justify-between gap-3"
            >
              <span className="text-xs font-medium text-slate-100 leading-snug">
                {snackbar.message}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {snackbar.actionLabel && snackbar.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      snackbar.onAction?.();
                      dismissSnackbar();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    {snackbar.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={dismissSnackbar}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
