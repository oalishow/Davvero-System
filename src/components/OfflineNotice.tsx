import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  CloudOff,
  IdCard,
  Award,
  CalendarCheck,
  Mail,
  UploadCloud,
} from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import Modal from "./Modal";

interface OfflineNoticeProps {
  onStatusChange?: (isOnline: boolean) => void;
  showModalExternally?: boolean;
  onCloseExternalModal?: () => void;
}

export default function OfflineNotice({
  onStatusChange,
  showModalExternally,
  onCloseExternalModal,
}: OfflineNoticeProps = {}) {
  const { isOnline, wasOffline, isChecking, checkConnection } = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(isOnline);
    }
  }, [isOnline, onStatusChange]);

  const isModalOpen = showModalExternally || showInfoModal;
  const handleCloseModal = () => {
    setShowInfoModal(false);
    if (onCloseExternalModal) {
      onCloseExternalModal();
    }
  };

  // Reset dismissed state whenever offline status changes
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Show reconnected toast when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedToast(true);
      const timer = setTimeout(() => {
        setShowReconnectedToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <>
      {/* 1. TOAST DE RECONEXÃO (ONLINE) */}
      <AnimatePresence>
        {showReconnectedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[92%] sm:w-auto px-4 py-3 bg-emerald-600 dark:bg-emerald-700 text-white rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-400/40 backdrop-blur-md"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 pr-2">
              <p className="text-xs font-bold leading-tight">Conexão Restabelecida!</p>
              <p className="text-[11px] text-emerald-100 leading-snug">
                Você está online novamente. As alterações pendentes serão sincronizadas com o servidor.
              </p>
            </div>
            <button
              onClick={() => setShowReconnectedToast(false)}
              className="p-1 text-emerald-100 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. BANNER DE MODO OFFLINE */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`fixed ${
              isDismissed ? "bottom-4 left-4" : "top-0 left-0 right-0"
            } z-[99998] transition-all duration-300`}
          >
            {isDismissed ? (
              /* Mini-badge flutuante quando o usuário minimiza */
              <motion.button
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                onClick={() => setIsDismissed(false)}
                className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-full shadow-lg border border-amber-300 transition-transform active:scale-95 cursor-pointer"
                title="Modo Offline Ativo - Clique para ver detalhes"
              >
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                <WifiOff className="w-3.5 h-3.5" />
                <span>Modo Offline</span>
              </motion.button>
            ) : (
              /* Barra Completa no topo */
              <div className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 px-4 py-2.5 shadow-md border-b border-amber-400">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-slate-950/10 flex items-center justify-center shrink-0">
                      <WifiOff className="w-4 h-4 text-slate-950" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                        <h4 className="text-xs font-black tracking-tight uppercase">Modo Offline Ativado</h4>
                      </div>
                      <p className="text-[11px] font-medium text-slate-900 leading-snug truncate sm:whitespace-normal">
                        Você está sem internet. Sua Carteirinha, Certificados Conquistados e Histórico continuam 100% disponíveis offline para consulta e download em PDF.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => setShowInfoModal(true)}
                      className="px-2.5 py-1.5 bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>O que funciona?</span>
                    </button>
                    <button
                      onClick={() => checkConnection()}
                      disabled={isChecking}
                      className="px-2.5 py-1.5 bg-slate-950 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
                      <span>{isChecking ? "Checando..." : "Reconectar"}</span>
                    </button>
                    <button
                      onClick={() => setIsDismissed(true)}
                      className="p-1.5 text-slate-900 hover:text-slate-950 hover:bg-slate-950/10 rounded-lg transition-colors cursor-pointer"
                      title="Minimizar aviso"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MODAL DE INFORMAÇÃO DO MODO OFFLINE */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Modo Offline e Limitações"
      >
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Funcionamento sem Conexão à Internet
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                O aplicativo possui armazenamento local inteligente para permitir seu uso contínuo em locais remotos ou com sinal instável.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* O que funciona offline */}
            <div className="border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 bg-emerald-50/50 dark:bg-emerald-500/5">
              <h5 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Disponível no Modo Offline (100% Funcional)
              </h5>
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <IdCard className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Carteirinha Estudantil ("Minha ID"):</strong> Seu documento estudantil com foto, dados de curso e seminário, QR Code de segurança e validação presencial para meia-entrada e identificação oficial.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Certificados Conquistados:</strong> Acesso completo à aba de Certificados, visualização dos diplomas oficiais com temas e assinaturas cacheados e geração/download de PDF no formato A4 Paisagem sem internet.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Histórico de Eventos e Presenças:</strong> Consulta de presenças e eventos já cursados registrados no seu histórico acadêmico local.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Acesso Instantâneo via PWA e Cache API:</strong> Carregamento imediato do aplicativo sem conexão à internet e sem telas de erro.</span>
                </li>
              </ul>
            </div>

            {/* O que fica limitado */}
            <div className="border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4 bg-rose-50/50 dark:bg-rose-500/5">
              <h5 className="text-xs font-black uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Pausado no Modo Offline (Requer Internet)
              </h5>
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <CalendarCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Novas Inscrições em Eventos:</strong> A busca de novos eventos em tempo real e a confirmação de novas inscrições requerem conexão com o servidor.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Novos Certificados Não Liberados:</strong> Certificados de eventos recentes que ainda não foram liberados ou sincronizados previamente no seu dispositivo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CloudOff className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Verificador Público e Painel de Gestão:</strong> O scanner público em tempo real e a área administrativa de gestão de eventos ficam bloqueados offline.</span>
                </li>
                <li className="flex items-start gap-2">
                  <UploadCloud className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Envio de Comprovantes Externos:</strong> O upload de certificados de outras instituições será sincronizado assim que a conexão for restabelecida.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                checkConnection();
              }}
              disabled={isChecking}
              className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
              <span>{isChecking ? "Testando conexão..." : "Testar Conexão Agora"}</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
