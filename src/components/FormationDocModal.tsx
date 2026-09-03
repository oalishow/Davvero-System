import React from "react";
import { X, Download, ExternalLink, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";

interface FormationDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  docUrl: string | null;
  docName?: string;
  docType?: "pdf" | "image" | "link";
  professionalName?: string;
  description?: string;
}

export default function FormationDocModal({
  isOpen,
  onClose,
  docUrl,
  docName = "Documento de Formação",
  docType,
  professionalName,
  description,
}: FormationDocModalProps) {
  if (!isOpen || !docUrl) return null;

  const isPdf =
    docType === "pdf" ||
    docUrl.startsWith("data:application/pdf") ||
    docUrl.toLowerCase().endsWith(".pdf") ||
    docUrl.includes("/pdf");
  
  const isImage =
    docType === "image" ||
    docUrl.startsWith("data:image/") ||
    /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(docUrl);

  const handleDownload = () => {
    try {
      const a = document.createElement("a");
      a.href = docUrl;
      a.download = docName || (isPdf ? "documento-formacao.pdf" : "documento-formacao.jpg");
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(docUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 shrink-0">
              {isPdf ? <FileText className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <ExternalLink className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 truncate">
                {docName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {professionalName ? `Material disponibilizado por ${professionalName}` : "Documento importante para formações"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-download-formation-doc"
              onClick={handleDownload}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Baixar arquivo"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar</span>
            </button>
            <a
              id="btn-open-external-formation-doc"
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Aba</span>
            </a>
            <button
              id="btn-close-formation-doc"
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-500 hover:text-red-500 rounded-xl transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Description */}
        {description && (
          <div className="px-6 py-2.5 bg-sky-50/50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-sky-500" />
            <span>{description}</span>
          </div>
        )}

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/60 flex items-center justify-center min-h-[400px]">
          {isPdf ? (
            <div className="w-full h-[65vh] rounded-2xl overflow-hidden shadow-inner border border-slate-300 dark:border-slate-800 bg-white">
              <iframe
                src={`${docUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title={docName}
              />
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-[70vh] flex items-center justify-center">
              <img
                src={docUrl}
                alt={docName}
                className="max-w-full max-h-[68vh] object-contain rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md">
              <FileText className="w-12 h-12 text-sky-500 mx-auto mb-3" />
              <h4 className="text-base font-black text-slate-800 dark:text-slate-100 mb-2">
                Documento de Formação Externo
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Este material está hospedado externamente (Google Drive ou link da nuvem).
              </p>
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                <ExternalLink className="w-4 h-4" /> Acessar Documento Externo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
