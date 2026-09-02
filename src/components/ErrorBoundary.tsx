// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Automatically reload the page once if it's a chunk load error
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
       const key = 'error_boundary_chunk_reload';
       const last = sessionStorage.getItem(key);
       const now = Date.now();
       if (!last || now - parseInt(last, 10) > 15000) {
           sessionStorage.setItem(key, now.toString());
           window.location.reload();
       }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMsg = this.state.error?.message || "";
      const errorName = this.state.error?.name || "";
      
      const isPermissionError = 
        errorName === "NotAllowedError" || 
        errorName === "SecurityError" || 
        errorMsg.toLowerCase().includes("permission") ||
        errorMsg.toLowerCase().includes("user denied");

      return (
        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px] w-full">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-2xl flex items-center justify-center mb-4">
               <ShieldAlert className="w-8 h-8" />
            </div>
            
            {isPermissionError ? (
                <>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">Permissão Necessária</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
                        Parece que você negou alguma permissão (Câmera ou Biometria). 
                        Para usar este recurso, por favor libere a permissão nas configurações do seu navegador ou dispositivo e tente novamente.
                    </p>
                </>
            ) : (
                <>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">Ops, algo deu errado.</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
                        Tivemos um problema ao carregar esta parte do aplicativo. {errorMsg && <span className="block mt-2 text-xs opacity-70 border-t border-slate-200 dark:border-slate-700 pt-2">{errorMsg}</span>}
                    </p>
                </>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                  onClick={() => {
                      sessionStorage.clear();
                      window.location.reload();
                  }}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
              >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recarregar Sistema
              </button>

              <button 
                  onClick={() => {
                      try {
                        localStorage.removeItem('fajopa_settings');
                        localStorage.removeItem('app_version_state');
                        sessionStorage.clear();
                      } catch {}
                      window.location.href = window.location.origin + window.location.pathname + '?reset=' + Date.now();
                  }}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                  Limpar Cache & Reiniciar
              </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
