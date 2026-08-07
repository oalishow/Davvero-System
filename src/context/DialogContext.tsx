import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, CheckCircle2, Info, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playSound } from '../lib/sounds';

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning' | 'loading';
  confirmText?: string;
  cancelText?: string;
  isConfirm?: boolean;
}

interface DialogContextType {
  showAlert: (message: string, options?: Omit<DialogOptions, 'message' | 'isConfirm'>) => Promise<void>;
  showConfirm: (message: string, options?: Omit<DialogOptions, 'message' | 'isConfirm'>) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used within DialogProvider");
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<(DialogOptions & { id: string; resolve: (value: any) => void })[]>([]);

  const showAlert = useCallback((message: string, options?: Omit<DialogOptions, 'message' | 'isConfirm'>) => {
    if (options?.type === 'error') playSound('error');
    else if (options?.type === 'success') playSound('success');
    else playSound('notification');

    return new Promise<void>((resolve) => {
      const id = Math.random().toString(36).substr(2, 9);
      setDialogs(prev => [...prev, { id, message, ...options, isConfirm: false, resolve }]);
    });
  }, []);

  const showConfirm = useCallback((message: string, options?: Omit<DialogOptions, 'message' | 'isConfirm'>) => {
    playSound('notification');
    return new Promise<boolean>((resolve) => {
      const id = Math.random().toString(36).substr(2, 9);
      setDialogs(prev => [...prev, { id, message, ...options, isConfirm: true, resolve }]);
    });
  }, []);

  const closeDialog = (id: string, value: any) => {
    setDialogs(prev => {
      const dialog = prev.find(d => d.id === id);
      if (dialog) {
        dialog.resolve(value);
      }
      return prev.filter(d => d.id !== id);
    });
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {createPortal(
        <AnimatePresence>
          {dialogs.map(dialog => (
            <motion.div
              key={dialog.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] min-h-0 relative my-auto"
              >
                <div className="p-5 sm:p-6 pb-0 flex gap-4 shrink overflow-hidden flex-col max-h-full min-h-0">
                  <div className="flex gap-4 shrink-0">
                    <div className="shrink-0 mt-0.5">
                      {dialog.type === 'error' ? (
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      ) : dialog.type === 'success' ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      ) : dialog.type === 'warning' ? (
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                      ) : (
                        <Info className="w-8 h-8 text-sky-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {dialog.title && (
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 leading-tight">
                          {dialog.title}
                        </h3>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 overflow-y-auto shrink mb-4 pl-12 -ml-12 mt-2 pr-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed ml-12">
                      {dialog.message}
                    </p>
                  </div>
                </div>
                
                <div className="p-4 sm:p-6 pt-5 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  {dialog.isConfirm && (
                    <button
                      onClick={() => closeDialog(dialog.id, false)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      {dialog.cancelText || 'Cancelar'}
                    </button>
                  )}
                  <button
                    onClick={() => closeDialog(dialog.id, true)}
                    className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-transform active:scale-95 ${
                      dialog.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                      dialog.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                      dialog.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' :
                      'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20'
                    }`}
                  >
                    {dialog.confirmText || 'OK'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>,
        document.body
      )}
    </DialogContext.Provider>
  );
}
