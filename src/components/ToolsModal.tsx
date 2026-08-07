import React from 'react';
import { createPortal } from "react-dom";
import { X } from 'lucide-react';
import ToolsPanel from './ToolsPanel';

interface ToolsModalProps {
  onClose: () => void;
}

export default function ToolsModal({ onClose }: ToolsModalProps) {
  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pwa-safe-area animated-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Ferramentas Úteis
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50">
          <ToolsPanel />
        </div>
      </div>
    </div>,
    document.body
  );
}
