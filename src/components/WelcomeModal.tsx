import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Download } from "lucide-react";
import { APP_VERSION, APP_BUILD } from "../lib/constants";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden relative flex flex-col max-h-[90dvh]"
          >
            {/* Decorative glow */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-sky-500/20 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 pt-10 text-center relative z-10 overflow-y-auto custom-scrollbar flex-1">
              <motion.div 
                initial={{ scale: 0.8, rotate: -10 }} 
                animate={{ scale: 1, rotate: 0 }} 
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 mx-auto bg-gradient-to-tr from-sky-500/10 to-indigo-500/10 dark:from-sky-500/20 dark:to-indigo-500/20 rounded-3xl flex items-center justify-center shadow-xl shadow-sky-500/10 mb-6 p-4 border border-sky-100 dark:border-sky-800/50"
              >
                <img src="/icon.svg" alt="App Icon" className="w-full h-full object-contain drop-shadow-md" />
              </motion.div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tighter mb-2">
                Seja Bem-vindo!
              </h2>
              <p className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-6">
                Davvero System v{APP_VERSION} (Build {APP_BUILD})
              </p>

              <div className="text-left space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-8 border-y border-slate-100 dark:border-slate-800 py-6">
                <p>
                  O <strong>DAVVERO System</strong> (do italiano <em>"Verdadeiro"</em>) nasceu em 2025 de um TCC sobre Inteligência Artificial. Inicialmente, seria apenas um simples escaneador de QR Codes de carteirinhas.
                </p>
                <p>
                  Porém, ao ouvirmos os alunos, professores e a comunidade ao longo do tempo, decidimos inovar. O sistema foi integralmente construído por meio de "Vibe Coding" e da IA Gemini, transformando intuição e linguagem natural em linhas de código.
                </p>
                <p>
                  Hoje, o programa busca integrar ao ecossistema da FAJOPA e dos Seminários com funcionalidades que visam auxiliar a todos.
                </p>
                
                <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl flex items-start gap-3 mt-4 border border-sky-100 dark:border-sky-800/30">
                  <Heart className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] sm:text-xs text-sky-900 dark:text-sky-100">
                    Criado por estudantes com apoio de padres e diretores, como um presente da nossa geração para a instituição. Aproveite!
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                  <p className="text-[10px] sm:text-xs text-slate-500 text-center mb-2">
                    <strong>Criador e UI/UX Designer:</strong><br />
                    Alison Fernando Rodrigues dos Santos
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 text-center mb-2">
                    <strong>Apoio Institucional:</strong><br />
                    Prof. Reginaldo, Prof. Anderson e a Faculdade João Paulo II - FAJOPA
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-500 text-center">
                    <strong>Contribuidores:</strong><br />
                    Jonatas Mário Cunha, Carlos Eduardo Dias da Silva, Maicon Luiis, Luan Balbino Lopes, Danilo Chaves, Marcos Roberto
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <button
                  onClick={() => {
                    onClose();
                    if ((window as any).triggerPWAInstall) {
                      (window as any).triggerPWAInstall();
                    } else {
                      const newUrl = new URL(window.location.href);
                      newUrl.searchParams.set('install', 'true');
                      window.location.href = newUrl.toString();
                    }
                  }}
                  className="w-full sm:w-1/2 py-3 sm:py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-4 focus:ring-sky-500/20 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> Baixar App
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-1/2 py-3 sm:py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus:ring-4 focus:ring-slate-900/20"
                >
                  Explorar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
