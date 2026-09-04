import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
}

interface ToastContextType {
  toast: (
    variant: ToastVariant,
    title: string,
    description?: string,
    action?: ToastAction
  ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, title: string, description?: string, action?: ToastAction) => {
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-3), { id, variant, title, description, action }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), variant === 'error' ? 6000 : 4000)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const current = timers.current;
    return () => current.forEach((t) => clearTimeout(t));
  }, []);

  const icons: Record<ToastVariant, React.ReactNode> = {
    success: <CheckCircle2 className="size-4 text-ok shrink-0" />,
    error: <AlertCircle className="size-4 text-destructive shrink-0" />,
    info: <Info className="size-4 text-primary shrink-0" />,
  };

  const accent: Record<ToastVariant, string> = {
    success: 'border-l-ok',
    error: 'border-l-destructive',
    info: 'border-l-primary',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-100 flex w-[min(92vw,360px)] flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              style={{ willChange: 'transform, opacity' }}
              variants={{
                initial: { opacity: 0, y: 8, scale: 0.96 },
                animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
                exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-md border border-l-[3px] ${accent[t.variant]} border-border bg-card px-3.5 py-3 shadow-lg`}
            >
              {icons[t.variant]}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground leading-tight">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug wrap-break-word">
                    {t.description}
                  </p>
                )}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action!.onClick()
                      dismiss(t.id)
                    }}
                    className="mt-1.5 text-[11px] font-bold text-primary hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-xs p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
