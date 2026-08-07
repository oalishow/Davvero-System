import { createPortal } from "react-dom";
import { X, Mail, Instagram, ExternalLink, Music2 } from "lucide-react";
import { APP_VERSION } from "../lib/constants";

interface ContactModalProps {
  onClose: () => void;
}

export default function ContactModal({ onClose }: ContactModalProps) {
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animated-fade-in no-print">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 sm:pb-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Contato
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                DAVVERO System v{APP_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Fechar modal de contato"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Fale Conosco
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tem alguma dúvida, encontrou um problema ou gostaria de enviar uma sugestão? Entre em contato através do e-mail abaixo.
            </p>
          </div>

          <a
            href="mailto:oalison.rodrigues@gmail.com"
            className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/50 dark:hover:bg-indigo-500/10 rounded-2xl border border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all duration-300 group"
          >
            <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest font-black text-slate-400 mb-1">E-mail Principal</p>
              <p className="text-base sm:text-lg font-mono font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                oalison.rodrigues@gmail.com
              </p>
            </div>
            <div className="flex justify-center mt-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-slate-400 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </div>
          </a>
          
          <div className="grid grid-cols-2 gap-3 mt-6 text-center">
            <a
               href="https://www.instagram.com/oalison.rodrigues" target="_blank" rel="noopener noreferrer"
               className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-pink-50 dark:bg-slate-800/50 dark:hover:bg-pink-500/10 rounded-2xl border border-slate-200 dark:border-slate-700/50 hover:border-pink-300 dark:hover:border-pink-500/30 transition-all group"
            >
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Instagram className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">@oalison.rodrigues</span>
            </a>
            
             <a
               href="https://www.tiktok.com/@oalison.rodrigues" target="_blank" rel="noopener noreferrer"
               className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-500 transition-all group"
             >
              <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Music2 className="w-5 h-5 text-slate-800 dark:text-slate-200" />
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">TikTok</span>
            </a>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800/80 text-center flex justify-center">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
