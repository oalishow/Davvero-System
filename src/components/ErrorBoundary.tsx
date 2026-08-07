// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Automatically reload the page once if it's a chunk load error
    // Use sessionStorage to prevent infinite reload loops
    if (error.name === 'ChunkLoadError' || error.message.includes('dynamically imported module') || error.message.includes('fetch')) {
       if (!sessionStorage.getItem('reloaded_once')) {
           sessionStorage.setItem('reloaded_once', 'true');
           window.location.reload();
       }
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Ops, algo deu errado.</h2>
            <p className="text-sm text-slate-500 mb-4">Tivemos um problema ao carregar o aplicativo. Pode ser uma versão desatualizada.</p>
            <button 
                onClick={() => {
                    sessionStorage.clear();
                    window.location.reload();
                }}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg font-medium"
            >
                Recarregar Página
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}
