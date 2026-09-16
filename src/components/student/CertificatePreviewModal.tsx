import React, { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
  Printer,
  Download,
  Loader2,
} from "lucide-react";
import type { Event, Member } from "../../types";
import { printCertificateNode } from "../../lib/certificatePrint";
import AsyncCertificateRenderer from "./AsyncCertificateRenderer";

export interface CertificatePreviewModalProps {
  previewCertEvent: { event: Event; type: "participant" | "organizer" };
  member: Member;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  downloadingCertKey: string | null;
}

export function CertificatePreviewModal({
  previewCertEvent,
  member,
  onClose,
  onDownload,
  isDownloading,
  downloadingCertKey,
}: CertificatePreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(360);
  const [mode, setMode] = useState<"fit" | "zoom" | "rotate">("fit");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Drag touch state for smartphone panning
  const touchStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    // Bloqueia rolagem de fundo e redireciona a visão do smartphone diretamente para o modal
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Garante que o scroll do viewport e do modal subam imediatamente para a visualização do certificado
    window.scrollTo({ top: 0, behavior: "instant" });
    if (overlayRef.current) {
      overlayRef.current.scrollTop = 0;
    }
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "instant", block: "start" });
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const CERT_W = 1122;
  const CERT_H = 793;

  const fitScale = useMemo(() => {
    const avail = Math.max(260, containerWidth - 16);
    return Math.min(0.95, Math.max(0.18, avail / CERT_W));
  }, [containerWidth]);

  const rotateScale = useMemo(() => {
    const avail = Math.max(260, containerWidth - 16);
    return Math.min(1.05, Math.max(0.24, avail / CERT_H));
  }, [containerWidth]);

  const activeScale = useMemo(() => {
    if (mode === "fit") return fitScale;
    if (mode === "rotate") return rotateScale;
    return Math.min(1.3, Math.max(0.55, fitScale * 2.2 * zoomLevel));
  }, [mode, fitScale, rotateScale, zoomLevel]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current || e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !scrollRef.current || e.touches.length !== 1)
      return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    scrollRef.current.scrollLeft = touchStartRef.current.scrollLeft - dx;
    scrollRef.current.scrollTop = touchStartRef.current.scrollTop - dy;
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  const scrollToSide = (target: "left" | "center" | "right") => {
    if (!scrollRef.current) return;
    if (target === "left") {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    } else if (target === "center") {
      const maxScroll =
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      scrollRef.current.scrollTo({ left: maxScroll / 2, behavior: "smooth" });
    } else {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
  };

  const renderedWidth =
    mode === "rotate" ? CERT_H * activeScale : CERT_W * activeScale;
  const isOverflowing = renderedWidth > containerWidth;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      id="certificate-preview-modal-overlay"
      className="fixed inset-0 z-[99999] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={cardRef}
        id="certificate-preview-modal-card"
        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-5xl w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[96vh] min-h-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight">
                Prévia do Certificado (
                {previewCertEvent.type === "participant"
                  ? "Participação"
                  : "Organização"}
                )
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px] sm:max-w-md">
                {previewCertEvent.event.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-base cursor-pointer"
            title="Fechar Prévia"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Mode controls (Fit, Rotate, Zoom) */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setMode("fit");
                setZoomLevel(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "fit"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ajustar à Tela
            </button>

            <button
              onClick={() => {
                setMode("rotate");
                setZoomLevel(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "rotate"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
              title="Gira 90 graus para leitura vertical em smartphones"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Girar no Celular
            </button>

            <button
              onClick={() => {
                setMode("zoom");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "zoom"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Zoom Detalhes
            </button>
          </div>

          {/* Zoom +/- controls */}
          <div className="flex items-center gap-1">
            {mode === "zoom" && (
              <>
                <button
                  onClick={() =>
                    setZoomLevel((prev) => Math.max(0.6, prev - 0.2))
                  }
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                  {Math.round(activeScale * 100)}%
                </span>
                <button
                  onClick={() =>
                    setZoomLevel((prev) => Math.min(1.8, prev + 0.2))
                  }
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            )}
            <span className="hidden sm:inline-block text-[11px] text-slate-400 dark:text-slate-500 ml-2">
              (1122 × 793 px - A4 Paisagem)
            </span>
          </div>
        </div>

        {/* Quick Side Jump Navigation Buttons (shown when horizontally scrollable) */}
        {isOverflowing && mode !== "fit" && (
          <div className="flex items-center justify-between gap-2 px-2 py-1 mb-2 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900/60 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">
              <MoveHorizontal className="w-3.5 h-3.5" /> Navegação Rápida:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToSide("left")}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shadow-xs hover:bg-sky-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-[10px] font-bold text-slate-700 dark:text-slate-200"
              >
                ◀ Lado Esquerdo
              </button>
              <button
                type="button"
                onClick={() => scrollToSide("center")}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shadow-xs hover:bg-sky-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-[10px] font-bold text-slate-700 dark:text-slate-200"
              >
                ◉ Centro
              </button>
              <button
                type="button"
                onClick={() => scrollToSide("right")}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 shadow-xs hover:bg-sky-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-[10px] font-bold text-slate-700 dark:text-slate-200"
              >
                ▶ Lado Direito
              </button>
            </div>
          </div>
        )}

        {/* Main Certificate Scroll / Viewport Box */}
        <div
          ref={containerRef}
          className="w-full flex-1 min-h-[260px] sm:min-h-[380px] max-h-[62vh] bg-slate-100/80 dark:bg-slate-950/80 rounded-2xl p-2 sm:p-4 overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col justify-center relative shadow-inner"
        >
          <div
            ref={scrollRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`w-full h-full overflow-auto flex py-2 select-none touch-pan-x touch-pan-y ${
              isOverflowing ? "justify-start" : "justify-center"
            }`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {mode === "rotate" ? (
              // Rotated container: certificate scaled and rotated 90 degrees
              <div
                className="shrink-0 transition-transform duration-200"
                style={{
                  width: `${Math.round(CERT_H * activeScale)}px`,
                  height: `${Math.round(CERT_W * activeScale)}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    transform: `rotate(90deg) scale(${activeScale})`,
                    transformOrigin: "center center",
                    width: `${CERT_W}px`,
                    height: `${CERT_H}px`,
                  }}
                >
                  <AsyncCertificateRenderer
                    id="preview-cert-modal-node"
                    event={previewCertEvent.event}
                    member={member}
                    isOrganizer={previewCertEvent.type === "organizer"}
                  />
                </div>
              </div>
            ) : (
              // Standard landscape container (Fit or Zoom mode)
              <div
                className="shrink-0 transition-transform duration-200"
                style={{
                  width: `${Math.round(CERT_W * activeScale)}px`,
                  height: `${Math.round(CERT_H * activeScale)}px`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    transform: `scale(${activeScale})`,
                    transformOrigin: "top left",
                    width: `${CERT_W}px`,
                    height: `${CERT_H}px`,
                  }}
                >
                  <AsyncCertificateRenderer
                    id="preview-cert-modal-node"
                    event={previewCertEvent.event}
                    member={member}
                    isOrganizer={previewCertEvent.type === "organizer"}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>
              Dica: Em smartphones, use <strong>"Girar no Celular"</strong> ou
              arraste para os lados.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={async () => {
                try {
                  setIsPrinting(true);
                  await printCertificateNode(
                    document.getElementById("preview-cert-modal-node")
                  );
                } finally {
                  setIsPrinting(false);
                }
              }}
              disabled={isPrinting}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Imprimir Certificado isolado"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
              ) : (
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
              <span>{isPrinting ? "Preparando..." : "Imprimir"}</span>
            </button>
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {downloadingCertKey ===
              `${previewCertEvent.event.id}_${previewCertEvent.type}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" /> Baixar Certificado em PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CertificatePreviewModal;
