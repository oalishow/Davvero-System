import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Award,
  ShieldCheck,
  CheckCircle,
  Copy,
  Check,
  Printer,
  Download,
  FileDown,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Share2,
  Calendar,
  Clock,
  BookOpen,
  User,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Info,
  Move,
  Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { CertificateRenderer } from "./CertificateRenderer";
import { getDefaultCertificateTemplate, resolveCertificateReleaseDate } from "../lib/certificateAuth";
import { db, appId } from "../lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { printCertificateNode } from "../lib/certificatePrint";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import type { Event, Member, CertificateTemplate } from "../types";

export interface CertificateMatchItem {
  event: Event;
  member: Member;
  isOrganizer: boolean;
  certCode: string;
  template?: CertificateTemplate;
  hours?: number;
}

interface CertificateVerificationViewerProps {
  event: Event;
  member: Member;
  isOrganizer: boolean;
  certCode: string;
  template?: CertificateTemplate;
  allMatches?: CertificateMatchItem[];
  isAdminLogged?: boolean;
  isMyID?: boolean;
  cleanBaseUrl: string;
  onReset: () => void;
}

export default function CertificateVerificationViewer({
  event,
  member,
  isOrganizer,
  certCode,
  template,
  allMatches,
  isAdminLogged,
  isMyID,
  cleanBaseUrl,
  onReset,
}: CertificateVerificationViewerProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState<"diploma" | "dossier">("diploma");
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [userZoom, setUserZoom] = useState(1);
  const [isRotated, setIsRotated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenRotated, setFullscreenRotated] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 1122) : 800
  );

  // Drag to pan state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const touchStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [scrollEdge, setScrollEdge] = useState<"left" | "middle" | "right">("left");

  const containerRef = useRef<HTMLDivElement>(null);
  const certNodeRef = useRef<HTMLDivElement>(null);

  // Active selected match
  const matchesList = allMatches && allMatches.length > 0
    ? allMatches
    : [{ event, member, isOrganizer, certCode, template }];

  const currentMatch = matchesList[selectedMatchIndex] || matchesList[0];
  const activeEvent = currentMatch.event || event;
  const activeMember = currentMatch.member || member;
  const activeIsOrg = currentMatch.isOrganizer ?? isOrganizer;
  const activeCertCode = currentMatch.certCode || certCode;

  // Template State & Asset Hydration
  const [hydratedTemplate, setHydratedTemplate] = useState<CertificateTemplate>(() => {
    return (
      currentMatch.template ||
      template ||
      (activeIsOrg
        ? activeEvent.organizationCertificateTemplate
        : activeEvent.certificateTemplate) ||
      getDefaultCertificateTemplate(activeEvent, activeIsOrg, settings)
    );
  });

  useEffect(() => {
    let isMounted = true;
    const base =
      currentMatch.template ||
      template ||
      (activeIsOrg
        ? activeEvent.organizationCertificateTemplate
        : activeEvent.certificateTemplate) ||
      getDefaultCertificateTemplate(activeEvent, activeIsOrg, settings);

    setHydratedTemplate(base);

    if (activeEvent?.id) {
      // 1. Fetch fresh event document from Firestore to ensure base template parity
      getDoc(doc(db, `artifacts/${appId}/public/data/events`, activeEvent.id))
        .then((evSnap) => {
          if (evSnap.exists() && isMounted) {
            const evData = evSnap.data() as Event;
            const freshTpl = activeIsOrg
              ? evData.organizationCertificateTemplate
              : evData.certificateTemplate;
            if (freshTpl) {
              setHydratedTemplate((prev) => ({ ...freshTpl, ...prev }));
            }
          }
        })
        .catch(() => null);

      // 2. Fetch specific cert assets document
      const assetDocId = activeIsOrg
        ? `cert_assets_org_${activeEvent.id}`
        : `cert_assets_${activeEvent.id}`;

      const applyAssets = (assetsData: any) => {
        if (!assetsData || !isMounted) return;
        setHydratedTemplate((prev) => ({
          ...prev,
          ...(assetsData.backgroundImageUrl && {
            backgroundImageUrl: assetsData.backgroundImageUrl,
          }),
          ...(assetsData.logoUrl && { logoUrl: assetsData.logoUrl }),
          ...(assetsData.logo2Url && { logo2Url: assetsData.logo2Url }),
          ...(assetsData.fajopaDirectorSignatureUrl && {
            fajopaDirectorSignatureUrl: assetsData.fajopaDirectorSignatureUrl,
          }),
          ...(assetsData.seminarRectorSignatureUrl && {
            seminarRectorSignatureUrl: assetsData.seminarRectorSignatureUrl,
          }),
          ...(assetsData.signature1Url && {
            signature1Url: assetsData.signature1Url,
          }),
          ...(assetsData.signature2Url && {
            signature2Url: assetsData.signature2Url,
          }),
          ...(assetsData.signature3Url && {
            signature3Url: assetsData.signature3Url,
          }),
        }));
      };

      const docRef = doc(db, ASSETS_DOC_PATH(appId, assetDocId));
      getDoc(docRef)
        .then((snap) => {
          if (snap.exists() && isMounted) {
            const snapData = snap.data();
            const assetsData = snapData?.data !== undefined ? snapData.data : snapData;
            applyAssets(assetsData);
          }
        })
        .catch(() => null);

      // Real-time listener for live sync
      const unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists() && isMounted) {
          const snapData = snap.data();
          const assetsData = snapData?.data !== undefined ? snapData.data : snapData;
          applyAssets(assetsData);
        }
      }, () => null);

      // Old custom bg format fallback
      if ((activeEvent.certificateTemplate as any)?.hasCustomBg) {
        getDoc(doc(db, ASSETS_DOC_PATH(appId, `cert_bg_${activeEvent.id}`)))
          .then((bgSnap) => {
            if (bgSnap.exists() && isMounted) {
              const bgData = bgSnap.data();
              const bgUrl = bgData?.data !== undefined ? bgData.data : bgData;
              if (bgUrl) {
                setHydratedTemplate((prev) => ({ ...prev, backgroundImageUrl: bgUrl }));
              }
            }
          })
          .catch(() => null);
      }

      return () => {
        isMounted = false;
        unsub();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [activeEvent?.id, activeIsOrg, currentMatch, template, settings]);

  // Track responsive container width with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Standard A4 dimensions: 1122 x 793 px
  // Normal Horizontal Mode:
  const baseScale = Math.min(
    1,
    Math.max(0.18, (containerWidth - 8) / 1122)
  );
  const effectiveScale = Number((baseScale * userZoom).toFixed(3));
  const scaledWidth = Math.round(1122 * effectiveScale);
  const scaledHeight = Math.round(793 * effectiveScale);

  // Rotated Vertical Mode (Optimized for smartphones portrait orientation):
  const rotBaseScale = Math.min(
    1,
    Math.max(0.28, (containerWidth - 8) / 793)
  );
  const effectiveRotScale = Number((rotBaseScale * userZoom).toFixed(3));
  const rotScaledWidth = Math.round(793 * effectiveRotScale);
  const rotScaledHeight = Math.round(1122 * effectiveRotScale);

  // Track whether content is horizontally overflowing (needs scroll/drag)
  const currentRenderWidth = isRotated ? rotScaledWidth : scaledWidth;
  const isOverflowingX = currentRenderWidth > (containerWidth - 20);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.pageX - containerRef.current.offsetLeft,
      y: e.pageY - containerRef.current.offsetTop,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - dragStart.x) * 1.3;
    const walkY = (y - dragStart.y) * 1.3;
    containerRef.current.scrollLeft = dragStart.scrollLeft - walkX;
    containerRef.current.scrollTop = dragStart.scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Smartphone touch pan & drag handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !containerRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    // Update container scroll smoothly without restriction
    containerRef.current.scrollLeft = touchStartRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = touchStartRef.current.scrollTop - dy;
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Track active scroll edge for navigation chips
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 5) {
      setScrollEdge("left");
    } else if (scrollLeft <= 20) {
      setScrollEdge("left");
    } else if (scrollLeft >= maxScroll - 20) {
      setScrollEdge("right");
    } else {
      setScrollEdge("middle");
    }
  };

  // Quick navigation helpers to jump to edges on smartphone
  const scrollToLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  };

  const scrollToCenter = () => {
    if (containerRef.current) {
      const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
      containerRef.current.scrollTo({ left: maxScroll / 2, behavior: "smooth" });
    }
  };

  const scrollToRight = () => {
    if (containerRef.current) {
      const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
      containerRef.current.scrollTo({ left: maxScroll, behavior: "smooth" });
    }
  };

  // Safe formatting helpers
  const safeName = activeMember?.name || "Participante";
  const rawHours = activeIsOrg && activeEvent.organizationHours
    ? activeEvent.organizationHours
    : activeEvent.hours;
  const parsedRaw = Number(String(rawHours || "").replace(/[^0-9.]/g, "")) || 0;
  let finalHours = parsedRaw;
  if (finalHours <= 0 && activeEvent.startDate && activeEvent.endDate) {
    const d1 = new Date(activeEvent.startDate).getTime();
    const d2 = new Date(activeEvent.endDate).getTime();
    if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
      finalHours = Math.round((d2 - d1) / (1000 * 60 * 60));
    }
  }
  if (finalHours <= 0) finalHours = 4;

  const authUrl = `${cleanBaseUrl}?cert=${activeCertCode}`;

  // Copy Authentication Link
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(authUrl);
    setCopiedLink(true);
    showAlert("Link de autenticação oficial copiado com sucesso!", {
      type: "success",
    });
    setTimeout(() => setCopiedLink(false), 3000);
  }, [authUrl, showAlert]);

  // Native Web Share
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado Oficial FAJOPA - ${activeEvent.title}`,
          text: `Certificado oficial emitido para ${safeName} referente ao evento "${activeEvent.title}".`,
          url: authUrl,
        });
        return;
      } catch (_) {
        // User cancelled or fallback to copy
      }
    }
    handleCopyLink();
  }, [activeEvent.title, safeName, authUrl, handleCopyLink]);

  // Export to PDF (A4 Landscape, High Resolution)
  const handleExportPDF = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportProgress("Renderizando certificado em alta definição...");

      const node = document.getElementById("verified-certificate-render-node");
      if (!node) throw new Error("Documento não encontrado");

      if (document.fonts) {
        await document.fonts.ready;
      }

      setExportProgress("Processando elementos visuais...");
      let canvas: HTMLCanvasElement;
      try {
        const { toCanvas } = await import("html-to-image");
        canvas = await toCanvas(node, {
          pixelRatio: 2.5,
          skipFonts: false,
          cacheBust: true,
        });
      } catch {
        const html2canvas = (await import("html2canvas")).default;
        canvas = await html2canvas(node, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
      }

      setExportProgress("Gerando PDF formato A4 oficial...");
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      // A4 Landscape is 297mm x 210mm
      pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, "FAST");
      const safeFilename = `Certificado_FAJOPA_${safeName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(safeFilename);

      showAlert("Certificado em PDF baixado com sucesso!", { type: "success" });
    } catch (err: any) {
      console.error("PDF Export error:", err);
      showAlert("Falha ao exportar PDF: " + (err?.message || "Tente novamente"), {
        type: "error",
      });
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  }, [safeName, showAlert]);

  // Export to High Resolution PNG
  const handleExportPNG = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportProgress("Gerando imagem em alta resolução...");

      const node = document.getElementById("verified-certificate-render-node");
      if (!node) throw new Error("Documento não encontrado");

      if (document.fonts) await document.fonts.ready;

      let imgUrl: string;
      try {
        const { toPng } = await import("html-to-image");
        imgUrl = await toPng(node, { pixelRatio: 2.5, cacheBust: true });
      } catch {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(node, { scale: 2.5, useCORS: true, allowTaint: true });
        imgUrl = canvas.toDataURL("image/png");
      }

      const link = document.createElement("a");
      link.href = imgUrl;
      const safeFilename = `Certificado_FAJOPA_${safeName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert("Imagem do certificado baixada com sucesso!", { type: "success" });
    } catch (err: any) {
      showAlert("Erro ao exportar imagem: " + (err?.message || "Tente novamente"), {
        type: "error",
      });
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  }, [safeName, showAlert]);

  // Print exclusively the certificate node in isolated A4 landscape
  const handlePrint = useCallback(() => {
    printCertificateNode(certNodeRef.current);
  }, []);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center animate-success-pop space-y-4">
      {/* Top Authenticity Verified Banner */}
      <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-emerald-600/15 border border-emerald-400/40 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 15 }}
              className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center flex-shrink-0 shadow-inner"
            >
              <Award className="w-8 h-8 text-amber-300 drop-shadow" />
            </motion.div>
            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                Autenticidade Oficial Confirmada
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                {activeIsOrg ? "Certificado de Organização" : "Certificado de Participação"}
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Faculdade João Paulo II • Sistema de Certificação DAVVERO
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-white/25 backdrop-blur-sm transition-all"
              title="Copiar Link de Autenticação"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-amber-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? "Copiado!" : "Copiar Link"}
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/25 backdrop-blur-sm transition-all"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Match Switcher (When Multiple Certificates Found) */}
        {matchesList.length > 1 && (
          <div className="mt-4 pt-3.5 border-t border-white/20">
            <p className="text-[11px] font-bold text-emerald-100 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Foram localizados {matchesList.length} certificados para este participante:
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {matchesList.map((m, idx) => {
                const isSelected = idx === selectedMatchIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedMatchIndex(idx);
                      setUserZoom(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-white text-emerald-900 border-white shadow-md scale-[1.02]"
                        : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{m.event?.title || `Certificado ${idx + 1}`}</span>
                    {m.isOrganizer && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-amber-950 font-black">
                        ORG
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main View Mode Tabs */}
      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("diploma")}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "diploma"
                ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <Award className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span className="truncate">Diploma do Certificado</span>
          </button>
          <button
            onClick={() => setActiveTab("dossier")}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "dossier"
                ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <span className="truncate">Fé Pública</span>
          </button>
        </div>

        {/* Smartphone Optimized Quick Reading Bar */}
        {activeTab === "diploma" && (
          <div className="flex items-center justify-between sm:justify-end gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setIsRotated(!isRotated)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                isRotated
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
              }`}
              title={isRotated ? "Voltar ao modo horizontal" : "Girar 90° para leitura vertical no smartphone"}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{isRotated ? "Modo Horizontal" : "Girar 90° (Celular)"}</span>
            </button>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-0.5 rounded-xl border border-slate-200 dark:border-slate-600">
              <button
                onClick={() => setUserZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg active:scale-95 transition-all"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold min-w-[34px] text-center">
                {Math.round(userZoom * 100)}%
              </span>
              <button
                onClick={() => setUserZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(2))))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg active:scale-95 transition-all"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setUserZoom(1);
                  setIsRotated(false);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg active:scale-95 transition-all"
                title="Redefinir visualização"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 rounded-xl border border-sky-200 dark:border-sky-500/30 active:scale-95 transition-all"
              title="Visualizar em Tela Cheia"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Visual Diploma Rendering */}
      {activeTab === "diploma" && (
        <div className="w-full flex flex-col items-center space-y-3">
          {/* Quick preset chips for smartphone */}
          <div className="w-full flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <button
                onClick={() => {
                  setUserZoom(1);
                  setIsRotated(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap border ${
                  userZoom === 1 && !isRotated
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                Ajustar à Tela
              </button>
              <button
                onClick={() => {
                  setIsRotated(true);
                  setUserZoom(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap border flex items-center gap-1 ${
                  isRotated
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                <Smartphone className="w-3 h-3" />
                Leitura Vertical
              </button>
              <button
                onClick={() => setUserZoom(1.5)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap border ${
                  userZoom === 1.5
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                Zoom 1.5x
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-medium hidden sm:block whitespace-nowrap">
              Formato Oficial A4 • 1122 × 793 px
            </div>
          </div>

          {/* Quick Navigation Edge Shortcuts when overflowing horizontally */}
          {isOverflowingX && (
            <div className="w-full flex items-center justify-between gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/70 text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={scrollToLeft}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                    scrollEdge === "left"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 border border-slate-200/80 dark:border-slate-600"
                  }`}
                  title="Ver início à esquerda (Logos e Instituição)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Lado Esquerdo</span>
                </button>
                <button
                  onClick={scrollToCenter}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    scrollEdge === "middle"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 border border-slate-200/80 dark:border-slate-600"
                  }`}
                  title="Centralizar no texto"
                >
                  Centro
                </button>
                <button
                  onClick={scrollToRight}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                    scrollEdge === "right"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 border border-slate-200/80 dark:border-slate-600"
                  }`}
                  title="Ver lado direito (Assinaturas e Validação)"
                >
                  <span>Lado Direito</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 pr-1">
                <Move className="w-3 h-3 text-sky-500 animate-pulse" />
                <span className="hidden sm:inline">Deslize com o dedo</span>
              </div>
            </div>
          )}

          {/* Certificate Viewport */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`w-full overflow-x-auto overflow-y-auto rounded-2xl bg-slate-100 dark:bg-slate-900/60 p-2 sm:p-4 border border-slate-200 dark:border-slate-800 relative select-none touch-pan-x touch-pan-y shadow-inner overscroll-contain ${
              isDragging ? "cursor-grabbing" : isOverflowingX ? "cursor-grab" : ""
            }`}
            style={{
              maxHeight: "75vh",
              minHeight: isRotated
                ? Math.min(rotScaledHeight + 16, 520)
                : Math.min(scaledHeight + 16, 420),
            }}
          >
            {/* Scrollable Stage: When content overflows, aligns to flex-start so x=0 is the left edge and never gets trapped in negative coordinates */}
            <div
              className={`min-w-full flex ${
                isOverflowingX ? "justify-start" : "justify-center"
              } items-start py-1`}
            >
              {/* Exactly sized container matching the scaled dimensions - eliminates ghost whitespace */}
              <div
                style={{
                  width: isRotated ? rotScaledWidth : scaledWidth,
                  height: isRotated ? rotScaledHeight : scaledHeight,
                }}
                className="relative flex-shrink-0 transition-[width,height] duration-200 shadow-2xl rounded-2xl overflow-hidden bg-white"
              >
                <div
                  style={{
                    width: 1122,
                    height: 793,
                    transform: isRotated
                      ? `scale(${effectiveRotScale}) rotate(90deg) translate(0, -793px)`
                      : `scale(${effectiveScale})`,
                    transformOrigin: "top left",
                  }}
                  className="absolute top-0 left-0"
                >
                  <CertificateRenderer
                    ref={certNodeRef}
                    id="verified-certificate-render-node"
                    event={activeEvent}
                    template={hydratedTemplate}
                    member={activeMember}
                    isOrganizer={activeIsOrg}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Zoom & Pan Guidance */}
          {isOverflowingX && (
            <div className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 py-1.5 px-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
              <Move className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span>Toque e arraste livremente para visualizar o brasão, texto e assinaturas</span>
            </div>
          )}

          {/* Action Toolbar for Diploma - Mobile First Layout */}
          <div className="w-full flex flex-col gap-2.5 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Primary Action Button - Full width on smartphones */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 active:scale-98 disabled:opacity-50 transition-all"
            >
              <FileDown className="w-5 h-5 flex-shrink-0" />
              <span>{isExporting ? (exportProgress || "Gerando documento...") : "Baixar PDF Oficial do Certificado"}</span>
            </button>

            {/* Secondary Actions Grid - 2 columns on phones, 4 columns on sm+ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleExportPNG}
                disabled={isExporting}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 disabled:opacity-50 transition-all min-h-[44px]"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Imagem PNG</span>
              </button>

              <button
                onClick={() => setIsFullscreen(true)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all min-h-[44px]"
              >
                <Maximize2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Tela Cheia</span>
              </button>

              <button
                onClick={handlePrint}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all min-h-[44px]"
                title="Imprimir Certificado"
              >
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={onReset}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <span>Nova Consulta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Official Authenticity Dossier */}
      {activeTab === "dossier" && (
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                Registro Notarial Institucional
              </p>
              <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                Dossiê Oficial de Certificação Acadêmica
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Válido & Autêntico
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Participant Information */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-500" />
                Dados do Titular
              </p>
              <div>
                <p className="text-base font-black text-slate-800 dark:text-white leading-tight">
                  {safeName}
                </p>
                {activeMember?.ra && (
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                    RA Acadêmico: {activeMember.ra}
                  </p>
                )}
                {activeMember?.cpf && (isAdminLogged || isMyID) && (
                  <p className="text-xs font-mono font-semibold text-slate-500 mt-0.5">
                    CPF: {activeMember.cpf}
                  </p>
                )}
                {activeMember?.course && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                    <span className="font-bold text-slate-400">Curso:</span> {activeMember.course}
                  </p>
                )}
              </div>
            </div>

            {/* Event & Activity Information */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                Atividade Acadêmica
              </p>
              <div>
                <p className="text-sm sm:text-base font-bold text-sky-600 dark:text-sky-400 leading-snug">
                  {activeEvent?.title || "Evento Acadêmico"}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <strong>{finalHours} Horas</strong> certificadas
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {activeEvent?.startDate
                      ? new Date(activeEvent.startDate).toLocaleDateString("pt-BR")
                      : "Concluído"}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Liberado em: {resolveCertificateReleaseDate(activeEvent, hydratedTemplate, activeMember).formattedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic Hash & Validation */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5 md:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Autenticação Notarial Digital
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Chave Única de Autenticidade
                  </p>
                  <p className="text-sm font-mono font-black text-slate-800 dark:text-white tracking-wide">
                    {activeCertCode}
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? "Copiado!" : "Copiar Link"}
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                  <QRCodeSVG value={authUrl} size={64} level="M" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Este certificado possui fé pública acadêmica garantida pela Faculdade João Paulo II e Seminário Provincial São José, sob os termos das Diretrizes Curriculares Nacionais do Ministério da Educação (MEC).
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setActiveTab("diploma")}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/20"
            >
              <Award className="w-4 h-4" />
              Visualizar Diploma do Certificado
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen High-Resolution Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-2 sm:p-4 overflow-hidden"
          >
            {/* Top Toolbar in Fullscreen */}
            <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-white pb-3 border-b border-white/20 flex-shrink-0">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Award className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-black text-xs sm:text-sm truncate">
                      {safeName}
                    </p>
                    <p className="text-[10px] text-slate-300 truncate">
                      {activeEvent?.title || "Certificado"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 sm:hidden bg-white/15 hover:bg-rose-600 rounded-xl active:scale-95 transition-all text-white flex-shrink-0"
                  title="Fechar Tela Cheia"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-1.5 flex-wrap">
                <button
                  onClick={() => setFullscreenRotated(!fullscreenRotated)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    fullscreenRotated
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-white/15 hover:bg-white/25 text-white border border-white/20"
                  }`}
                  title="Girar 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="text-xs">Girar 90°</span>
                </button>

                <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/15">
                  <button
                    onClick={() => setFullscreenZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(2))))}
                    className="p-1.5 hover:bg-white/20 rounded-lg active:scale-95 transition-all"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs font-bold min-w-[38px] text-center">
                    {Math.round(fullscreenZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setFullscreenZoom((z) => Math.min(3.0, Number((z + 0.2).toFixed(2))))}
                    className="p-1.5 hover:bg-white/20 rounded-lg active:scale-95 transition-all"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setFullscreenZoom(1);
                      setFullscreenRotated(false);
                    }}
                    className="px-2 py-1 text-[11px] font-bold bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-all"
                  >
                    100%
                  </button>
                </div>

                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/30"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Baixar PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>

                <button
                  onClick={() => setIsFullscreen(false)}
                  className="hidden sm:flex p-2 bg-rose-600/80 hover:bg-rose-600 rounded-xl active:scale-95 transition-all text-white"
                  title="Fechar Tela Cheia"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fullscreen Scrollable Stage */}
            <div className="w-full flex-grow overflow-auto p-2 sm:p-4 touch-pan-x touch-pan-y overscroll-contain flex">
              <div className="min-w-full min-h-full flex items-center justify-start sm:justify-center m-auto">
                <div
                  style={{
                    width: fullscreenRotated ? Math.round(793 * fullscreenZoom) : Math.round(1122 * fullscreenZoom),
                    height: fullscreenRotated ? Math.round(1122 * fullscreenZoom) : Math.round(793 * fullscreenZoom),
                  }}
                  className="relative shadow-2xl rounded-2xl overflow-hidden bg-white flex-shrink-0 transition-[width,height] duration-150 m-auto"
                >
                  <div
                    style={{
                      width: 1122,
                      height: 793,
                      transform: fullscreenRotated
                        ? `scale(${fullscreenZoom}) rotate(90deg) translate(0, -793px)`
                        : `scale(${fullscreenZoom})`,
                      transformOrigin: "top left",
                    }}
                    className="absolute top-0 left-0"
                  >
                    <CertificateRenderer
                      event={activeEvent}
                      template={hydratedTemplate}
                      member={activeMember}
                      isOrganizer={activeIsOrg}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
