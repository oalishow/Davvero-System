import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Share2,
  Download,
  X,
  Smartphone,
  Apple,
  Monitor,
  FileText,
  ChevronDown,
  ChevronUp,
  FolderDown,
  ShieldCheck,
} from "lucide-react";

export interface DownloadSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  pdfBlob?: Blob | null;
  eventTitle?: string;
  studentName?: string;
  certCode?: string;
  onReDownload?: () => void;
}

export const DownloadSuccessModal: React.FC<DownloadSuccessModalProps> = ({
  isOpen,
  onClose,
  fileName,
  pdfBlob,
  eventTitle,
  studentName,
  certCode,
  onReDownload,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">("android");
  const [shareSupported, setShareSupported] = useState(false);

  // Detect platform on mount
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(ua)) {
        setActiveTab("ios");
      } else if (/Android/i.test(ua)) {
        setActiveTab("android");
      } else {
        setActiveTab("desktop");
      }
      setShareSupported(Boolean(navigator.share));
    }
  }, []);

  // Create and clean up blob URL
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  if (!isOpen) return null;

  const handleOpenFile = () => {
    if (blobUrl) {
      // Direct user gesture ensures mobile browsers allow opening without popup blocking
      const newWin = window.open(blobUrl, "_blank");
      if (!newWin) {
        // Fallback: create temporary download/open link
        const a = document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const handleShare = async () => {
    if (!pdfBlob) return;
    try {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: fileName,
          text: `Certificado Oficial - ${eventTitle || "Evento"}`,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({
          title: fileName,
          text: `Certificado Oficial emitido para ${studentName || "Participante"}`,
          url: window.location.href,
        });
      }
    } catch (err) {
      console.warn("Share notice", err);
    }
  };

  const handleTryOpenDownloads = () => {
    try {
      // In Chromium mobile, chrome://downloads can sometimes be opened
      window.location.href = "chrome://downloads/";
    } catch (_) {
      setShowGuide(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-100 dark:ring-emerald-900/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Certificado Baixado!
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            O arquivo PDF foi gerado e salvo no seu dispositivo.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-left">
          {/* File Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 rounded-xl shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {fileName}
              </div>
              {eventTitle && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {eventTitle}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  PDF Oficial A4
                </span>
                {certCode && (
                  <span className="flex items-center gap-1 font-mono text-sky-700 dark:text-sky-300">
                    <ShieldCheck className="w-3 h-3 text-sky-500" />
                    {certCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary Mobile Action: Open File Directly */}
          <div className="space-y-2">
            <button
              onClick={handleOpenFile}
              disabled={!blobUrl}
              className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir Certificado Agora</span>
            </button>

            {shareSupported && (
              <button
                onClick={handleShare}
                disabled={!pdfBlob}
                className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-500" />
                <span>Compartilhar / Abrir em Outro App</span>
              </button>
            )}
          </div>

          {/* Guide Section: Where is my file? */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <FolderDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Onde encontrar o arquivo baixado?</span>
              </div>
              {showGuide ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showGuide && (
              <div className="p-3 pt-1 border-t border-slate-200/70 dark:border-slate-700/60 space-y-3">
                {/* Platform Selector Tabs */}
                <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("android")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === "android"
                        ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Android</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("ios")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === "ios"
                        ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5" />
                    <span>iPhone / iPad</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("desktop")}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === "desktop"
                        ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Computador</span>
                  </button>
                </div>

                {/* Tab Instructions */}
                <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {activeTab === "android" && (
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>
                        Toque no menu de <strong>3 pontinhos (⋮)</strong> no topo direito do seu navegador e escolha <strong>Downloads</strong>.
                      </li>
                      <li>
                        Ou abra o app <strong>Arquivos</strong> (ou <em>Files do Google</em>) no celular e acesse a pasta <strong>Download</strong>.
                      </li>
                      <li>
                        Você também pode puxar a barra superior de notificações para tocar no download concluído.
                      </li>
                    </ol>
                  )}

                  {activeTab === "ios" && (
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>
                        Abra o aplicativo nativo <strong>Arquivos</strong> (Files) no seu iPhone.
                      </li>
                      <li>
                        Toque em <strong>Explorar</strong> &gt; <strong>No Meu iPhone</strong> (ou iCloud) &gt; pasta <strong>Downloads</strong>.
                      </li>
                      <li>
                        No Safari, você também pode tocar no ícone <strong>⬇️ Downloads</strong> na barra de endereços.
                      </li>
                    </ol>
                  )}

                  {activeTab === "desktop" && (
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>
                        Pressione o atalho <strong>Ctrl + J</strong> (Windows) ou <strong>Cmd + Option + L</strong> (Mac) no navegador.
                      </li>
                      <li>
                        Ou abra a pasta <strong>Downloads</strong> do explorador de arquivos do seu computador.
                      </li>
                    </ol>
                  )}
                </div>

                {activeTab === "android" && (
                  <button
                    type="button"
                    onClick={handleTryOpenDownloads}
                    className="w-full py-2 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderDown className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Acessar aba de downloads do navegador</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {onReDownload ? (
            <button
              onClick={onReDownload}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar novamente</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadSuccessModal;
