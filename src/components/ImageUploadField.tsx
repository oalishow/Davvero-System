import React, { useRef, useState } from "react";
import { Upload, Link2, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { resizeAndConvertToBase64 } from "../lib/imageUtils";

interface ImageUploadFieldProps {
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  maxDimension?: number;
  preserveAlpha?: boolean;
  previewAspect?: "portrait" | "landscape" | "circle";
  idPrefix?: string;
}

export default function ImageUploadField({
  label,
  helperText,
  value,
  onChange,
  maxDimension = 600,
  preserveAlpha = false,
  previewAspect = "landscape",
  idPrefix = "img",
}: ImageUploadFieldProps) {
  const [mode, setMode] = useState<"upload" | "url">(value && value.startsWith("http") ? "url" : "upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    try {
      setIsProcessing(true);
      const base64 = await resizeAndConvertToBase64(file, maxDimension, {
        quality: 0.82,
        preserveAlpha,
        mimeType: preserveAlpha ? "image/png" : "image/jpeg",
      });
      onChange(base64);
    } catch (err: any) {
      console.error("Erro ao processar imagem:", err);
      alert("Não foi possível carregar a imagem. Verifique o arquivo e tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-700 dark:text-slate-200 block">
          {label}
        </label>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px]">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-all ${
              mode === "upload"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            <Upload className="w-2.5 h-2.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-all ${
              mode === "url"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            <Link2 className="w-2.5 h-2.5" />
            Link URL
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      )}

      {/* Caixa de Entrada de Imagem */}
      {mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30"
              : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            id={`${idPrefix}-file-input`}
          />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-1.5 py-2 text-sky-600 dark:text-sky-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[11px] font-bold">Otimizando imagem para exibição inteira...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Clique para enviar ou arraste a imagem aqui
              </p>
              <p className="text-[10px] text-slate-400">
                PNG, JPG, WEBP. A imagem será ajustada para aparecer por completo sem cortes.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <input
              type="text"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-sky-500 pr-8"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pré-visualização da imagem Inteira (Uncropped) */}
      {value && (
        <div className="mt-2 p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={`shrink-0 overflow-hidden bg-slate-900/10 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-600 flex items-center justify-center ${
                previewAspect === "circle"
                  ? "w-12 h-12 rounded-full"
                  : previewAspect === "portrait"
                  ? "w-14 h-18 rounded-lg shadow-sm"
                  : "w-20 h-14 rounded-lg shadow-sm"
              }`}
            >
              <img
                src={value}
                alt="Prévia"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="truncate">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block truncate">
                Imagem carregada com sucesso
              </span>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block">
                Visualização por inteiro garantida (sem cortes)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all shrink-0"
            title="Remover imagem"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
