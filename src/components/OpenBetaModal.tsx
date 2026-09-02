import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  Info,
  Calendar,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { playSound } from '../lib/sounds';

interface OpenBetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  endDate?: string;
}

export default function OpenBetaModal({ isOpen, onClose, endDate = '2026-10-05' }: OpenBetaModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const phoneDisplay = "(18) 99703-4969";
  const phoneRaw = "5518997034969";
  const whatsappUrl = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(
    "Olá! Estou utilizando o DAVVERO System em fase de Beta Aberto e gostaria de reportar um ponto / feedback:"
  )}`;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phoneDisplay);
    setCopied(true);
    playSound('pop');
    setTimeout(() => setCopied(false), 2500);
  };

  // Format date helper (e.g. 2026-10-05 -> 5 de outubro de 2026)
  const formatEndDate = (dateStr: string) => {
    try {
      if (!dateStr) return "5 de outubro de 2026";
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return "5 de outubro de 2026";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-amber-500/30 overflow-hidden my-auto"
        >
          {/* Top Decorative Gradient */}
          <div className="h-3 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-sky-500" />

          {/* Close button */}
          <button
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header / Badge */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black tracking-wider uppercase">
                  PROGRAMA BETA ABERTO
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                O que é o Beta Aberto?
              </h2>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Período de testes até {formatEndDate(endDate)}</span>
              </div>
            </div>

            {/* Explanation box */}
            <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-700 dark:text-slate-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="font-medium text-xs sm:text-sm">
                    O aplicativo está passando pelo processo de testes e pode sofrer algumas instabilidades e bugs.
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed">
                Por isso, é muito importante reportar os erros, comportamentos inesperados ou sugestões de melhoria diretamente ao criador do projeto para que possamos aperfeiçoar o sistema continuamente.
              </p>

              {/* Creator WhatsApp Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Canal Direto com o Criador
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    WhatsApp Ativo
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {phoneDisplay}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Suporte e reporte de erros em tempo real
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyPhone}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Copiar número"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Direct Action Button */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playSound('click')}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98]"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  Reportar Erro no WhatsApp
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  onClose();
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-wider py-1 px-4 rounded-lg transition-colors"
              >
                Entendi, continuar navegando
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
