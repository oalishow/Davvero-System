import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Youtube,
  Radio,
  ExternalLink,
  RefreshCw,
  X,
  Play,
  Share2,
  Check,
  AlertCircle
} from "lucide-react";
import { useYouTubeLive } from "../hooks/useYouTubeLive";

interface YouTubeLiveButtonProps {
  variant?: "header" | "banner" | "compact";
  className?: string;
}

export default function YouTubeLiveButton({
  variant = "header",
  className = "",
}: YouTubeLiveButtonProps) {
  const {
    isLive,
    videoId,
    title,
    liveUrl,
    channelUrl,
    loading,
    isChecking,
    checkLiveStatus,
    checkedAt,
  } = useYouTubeLive();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOfflinePopover, setShowOfflinePopover] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : liveUrl;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // BANNER VARIANT (e.g. for Home/Events section)
  if (variant === "banner") {
    if (!isLive) {
      return (
        <div
          className={`flex items-center justify-between gap-3 p-3 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl text-xs ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
              <Youtube className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Canal YouTube FAJOPA</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                  Offline
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Nenhuma transmissão ao vivo no momento.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => checkLiveStatus(true)}
              disabled={isChecking}
              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              title="Verificar status da transmissão agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-sky-500" : ""}`} />
            </button>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 transition-all"
            >
              <span>Ver Canal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      );
    }

    // Banner variant when LIVE
    return (
      <div
        className={`relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-lg shadow-red-500/20 border border-red-400/40 ${className}`}
      >
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 text-white shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white text-red-600 font-black text-[10px] tracking-wider uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  AO VIVO AGORA
                </span>
                <span className="text-xs font-semibold text-white/90">FAJOPA Marília</span>
              </div>
              <h4 className="font-bold text-sm text-white mt-0.5 line-clamp-1">
                {title || "Transmissão ao vivo no canal oficial"}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial px-4 py-2 bg-white text-red-600 hover:bg-red-50 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-red-600" />
              <span>Assistir no App</span>
            </button>
            <a
              href={videoId ? `https://www.youtube.com/watch?v=${videoId}` : liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center"
              title="Abrir no YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // HEADER / COMPACT VARIANT
  return (
    <>
      <div className={`relative inline-flex items-center ${className}`}>
        {isLive ? (
          // --- ESTADO ATIVADO (CANAL ONLINE / AO VIVO) ---
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsModalOpen(true)}
            className="group relative flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs shadow-md shadow-red-500/30 border border-red-400/50 cursor-pointer overflow-hidden transition-all shrink-0"
            title={`Canal FAJOPA está AO VIVO: ${title || "Clique para assistir"}`}
          >
            {/* Live ripple pulse */}
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-white" />
            </span>

            <Youtube className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white shrink-0" />

            <span className="tracking-wide uppercase text-[10px] sm:text-[11px] font-black drop-shadow-xs whitespace-nowrap">
              AO VIVO
            </span>

            {/* Shimmer animation */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </motion.button>
        ) : (
          // --- ESTADO DESATIVADO (CANAL OFFLINE) ---
          <div className="relative shrink-0">
            <button
              onClick={() => setShowOfflinePopover(!showOfflinePopover)}
              className="group flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:border-slate-300 dark:hover:border-slate-600 font-bold text-xs transition-all cursor-pointer shrink-0"
              title="Status da Live YouTube: Canal Offline (Clique para opções)"
            >
              <div className="relative shrink-0">
                <Youtube className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500 transition-colors" />
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              </div>
              <span className="text-[11px] font-medium hidden md:inline text-slate-500 dark:text-slate-400">
                Live
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                OFF
              </span>
            </button>

            {/* Popover explicativo para estado desativado */}
            <AnimatePresence>
              {showOfflinePopover && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-3.5 z-50 text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-white">
                          Canal FAJOPA
                        </h5>
                        <span className="text-[10px] text-slate-400">
                          @fajopademarilia
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowOfflinePopover(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    Nenhuma transmissão <strong>ao vivo</strong> em andamento no momento. Assim que o canal iniciar uma transmissão, o botão será ativado automaticamente.
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        checkLiveStatus(true);
                      }}
                      disabled={isChecking}
                      className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
                      {isChecking ? "Verificando..." : "Verificar agora"}
                    </button>

                    <a
                      href={channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      <span>Abrir Canal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* --- MODAL DO STREAM AO VIVO --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]"
            >
              {/* Header do Modal */}
              <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        AO VIVO
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Canal FAJOPA Marília
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white line-clamp-1 mt-0.5">
                      {title || "Transmissão ao Vivo"}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Player Iframe do YouTube */}
              <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                {videoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                    title={title || "YouTube Live Stream"}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <iframe
                    src={`https://www.youtube.com/embed/live_stream?channel=UCz7DxjLyAGSUrrCC9jZlVOg&autoplay=1`}
                    title="YouTube Live Stream"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>

              {/* Footer do Modal */}
              <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Compartilhar</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={videoId ? `https://www.youtube.com/watch?v=${videoId}` : liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <Youtube className="w-4 h-4 fill-white" />
                    <span>Abrir no YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
