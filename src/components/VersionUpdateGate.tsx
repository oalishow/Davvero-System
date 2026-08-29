import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { safeReloadApp } from "../lib/versionManager";

interface VersionUpdateGateProps {
  isUpdating: boolean;
  updateProgress: number;
  targetVersion: string;
  isLoopBlocked: boolean;
  onDismissBlocked?: () => void;
}

export default function VersionUpdateGate({
  isUpdating,
  updateProgress,
  targetVersion,
  isLoopBlocked,
  onDismissBlocked,
}: VersionUpdateGateProps) {
  const [isManualUpdating, setIsManualUpdating] = useState(false);

  const handleManualCleanUpdate = async () => {
    setIsManualUpdating(true);
    await safeReloadApp(targetVersion);
  };

  return (
    <AnimatePresence>
      {/* 1. Automated Progress Overlay (during the safe 1st reload) */}
      {isUpdating && !isLoopBlocked && (
        <motion.div
          key="version-updating-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md text-white no-print"
        >
          <div className="bg-slate-900 border border-sky-500/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-sky-500/10 animate-pulse">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Nova Versão Disponível
              </h3>
              <p className="text-xs text-sky-300 font-mono mt-0.5 font-semibold">
                Sincronizando v{targetVersion || "mais recente"}
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Atualizando os arquivos do sistema para garantir a segurança e o correto funcionamento dos seus dados.
            </p>

            <div className="space-y-1.5 pt-2">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <motion.div
                  className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full"
                  initial={{ width: "10%" }}
                  animate={{ width: `${Math.max(updateProgress, 25)}%` }}
                  transition={{ ease: "easeInOut", duration: 0.3 }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>Limpando cache...</span>
                <span>{updateProgress}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. Anti-Loop Gate Overlay (when browser cache prevented auto-reload and blocked loop) */}
      {isLoopBlocked && (
        <motion.div
          key="version-loop-gate"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md no-print"
        >
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 mb-1">
                Atualização Obrigatória
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Versão do Sistema Desatualizada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                O servidor está operando na versão <strong className="text-sky-600 dark:text-sky-400">v{targetVersion}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl text-left border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Para evitar inconsistências no banco de dados e problemas de exibição, versões legadas não têm permissão para operar.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleManualCleanUpdate}
                disabled={isManualUpdating}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isManualUpdating ? "animate-spin" : ""}`} />
                {isManualUpdating ? "Limpando e Atualizando..." : "Limpar Cache & Atualizar Agora"}
              </button>

              {onDismissBlocked && (
                <button
                  onClick={onDismissBlocked}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Continuar em modo de visualização
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
