import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Calendar,
  Clock,
  MapPin,
  Video,
  Share2,
  QrCode,
  User,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useSettings } from "../context/SettingsContext";
import { useDialog } from "../context/DialogContext";
import { DEFAULT_PUBLIC_URL } from "../lib/constants";
import DavveroLogo from "./DavveroLogo";
import type { Event } from "../types";

interface EventQrCodeModalProps {
  event: Event;
  onClose: () => void;
}

export default function EventQrCodeModal({
  event,
  onClose,
}: EventQrCodeModalProps) {
  const { settings } = useSettings();
  const { showAlert } = useDialog();
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const baseUrl = settings.url?.trim()
    ? settings.url.trim().replace(/\/$/, "")
    : DEFAULT_PUBLIC_URL;
  const eventUrl = `${baseUrl}/?event=${encodeURIComponent(event.id)}`;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSameDay = () => {
    if (!event.endDate) return true;
    const d1 = new Date(event.startDate).toDateString();
    const d2 = new Date(event.endDate).toDateString();
    return d1 === d2;
  };

  const shareText =
    `*${event.title}*\n` +
    (event.speaker ? `👤 Convidado: ${event.speaker}\n` : "") +
    `📅 Data: ${formatDate(event.startDate)}${
      formatTime(event.startDate) ? ` às ${formatTime(event.startDate)}` : ""
    }\n` +
    `📍 Formato: ${
      event.format === "online"
        ? "Online"
        : event.format === "presencial"
        ? "Presencial"
        : "Híbrido"
    }${
      event.location || event.locationOrLink
        ? ` - ${event.location || event.locationOrLink}`
        : ""
    }\n\n` +
    `👉 Acesse e inscreva-se:\n${eventUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      showAlert("Link do evento copiado com sucesso!", { type: "success" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showAlert("Não foi possível copiar o link.", { type: "error" });
    }
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      shareText
    )}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: event.title,
          text: `Confira o evento acadêmico: ${event.title}\n${event.speaker ? `👤 Convidado: ${event.speaker}\n` : ''}${eventUrl}`,
          url: eventUrl,
        };

        // Try to attach image file if available so WhatsApp/social apps immediately show the photo in share sheet
        if (event.imageUrl && typeof navigator.canShare === "function") {
          try {
            const res = await fetch(event.imageUrl, { mode: "cors" });
            if (res.ok) {
              const blob = await res.blob();
              const mime = blob.type || "image/jpeg";
              const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
              const file = new File([blob], `evento-${event.id}.${ext}`, { type: mime });
              if (navigator.canShare({ files: [file] })) {
                shareData.files = [file];
              }
            }
          } catch (imgErr) {
            console.log("Could not attach image file to share sheet:", imgErr);
          }
        }

        await navigator.share(shareData);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    try {
      const canvas = qrCanvasRef.current?.querySelector("canvas");
      if (!canvas) {
        showAlert("Erro ao gerar imagem do QR Code.", { type: "error" });
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      const cleanTitle = event.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .substring(0, 30);
      a.download = `qrcode_${cleanTitle || "evento"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showAlert("QR Code baixado com sucesso!", { type: "success" });
    } catch (e) {
      console.error(e);
      showAlert("Erro ao baixar o QR Code.", { type: "error" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      id="event-qr-modal-overlay"
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible print:z-auto"
    >
      <div
        id="event-qr-modal-container"
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[95vh] print:shadow-none print:border-none print:max-h-none print:w-full print:max-w-none print:rounded-none print:p-0"
      >
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Cartaz & QR Code do Evento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Imprima com foto ou compartilhe para entrada rápida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Poster Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4 print:p-0 print:overflow-visible">
          {/* Action Buttons Toolbar (Hidden on Print) */}
          <div className="flex flex-wrap gap-2 justify-center no-print">
            <button
              onClick={handlePrint}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Cartaz A4
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={handleDownloadQr}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Baixar QR Code isolado em PNG"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar QR</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Copiar Link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copiado!" : "Copiar Link"}
              </span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Outros Compartilhamentos"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* A4 Portrait Optimization Notice (Hidden on print) */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 no-print px-1 py-0.5">
            <span className="inline-flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400 text-[11px]">
              <Sparkles className="w-3.5 h-3.5" /> Otimizado para Página A4 em Modo Retrato
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Layout 100% Centralizado</span>
          </div>

          {/* PRINTABLE POSTER CARD (OPTIMIZED FOR A4 PORTRAIT & SCREEN) */}
          <div
            id="printable-event-poster"
            className="bg-white text-slate-900 border-2 border-sky-600 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center justify-between shadow-xl relative overflow-hidden w-full max-w-xl mx-auto print:border-2 print:border-sky-600 print:rounded-2xl print:p-6 print:w-full print:max-w-none print:shadow-none break-inside-avoid"
            style={{ minHeight: "560px" }}
          >
            {/* Top Border Accent */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 print:bg-sky-600" />

            {/* App / Event Header */}
            <div className="flex flex-col items-center justify-center pt-2 mb-2 w-full text-center">
              <div className="h-12 sm:h-14 w-auto flex items-center justify-center mb-1.5 print:h-11 mx-auto">
                <DavveroLogo
                  src={settings.instLogo}
                  alt={settings.instName || "DAVVERO System"}
                  className="h-12 sm:h-14 object-contain print:h-11 rounded-xl mx-auto block"
                  iconClassName="w-12 h-12 text-sky-600"
                  color={settings.instColor || "#0284c7"}
                />
              </div>
              <p className="text-xs font-black tracking-widest uppercase text-slate-800 text-center">
                {settings.instName || "DAVVERO System"}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 text-sky-700 print:border print:border-sky-200">
                  {event.isSeminary
                    ? "Seminário Maior • Evento Oficial"
                    : event.isDiocese
                    ? "Diocese • Evento Oficial"
                    : "Cartaz Oficial • Evento Acadêmico"}
                </span>
              </div>
            </div>

            {/* EVENT PHOTO / BANNER (CENTERED, BALANCED FOR A4) */}
            {event.imageUrl ? (
              <div className="w-full max-w-md my-2 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50/80 p-1 flex items-center justify-center mx-auto print:border-slate-300 print:shadow-none print:my-1.5 print:bg-transparent print:p-0 print:max-h-[160px]">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-auto max-h-[220px] print:max-h-[150px] object-contain rounded-xl print:w-auto mx-auto block"
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}

            {/* Event Title & Speaker */}
            <div className="my-2 max-w-lg w-full text-center mx-auto">
              <h1 className="text-xl sm:text-2xl print:text-2xl font-black text-slate-900 tracking-tight leading-snug text-center mx-auto">
                {event.title}
              </h1>
              {event.speaker && (
                <div className="mt-1.5 inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-100 mx-auto text-center">
                  <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Convidado / Palestrante: {event.speaker}</span>
                </div>
              )}
            </div>

            {/* Event Metadata Card (Fully Centered & Balanced) */}
            <div className="w-full max-w-lg mx-auto my-2 text-center bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 print:bg-slate-50/80 print:my-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                {/* Data */}
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/80 border border-slate-100 print:bg-white">
                  <div className="flex items-center gap-1.5 text-sky-600 mb-1">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Data
                    </span>
                  </div>
                  <p className="font-extrabold text-xs sm:text-sm text-slate-800 text-center">
                    {formatDate(event.startDate)}
                  </p>
                  {!isSameDay() && event.endDate && (
                    <p className="text-[10px] font-semibold text-slate-600 text-center">
                      até {formatDate(event.endDate)}
                    </p>
                  )}
                </div>

                {/* Horário */}
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/80 border border-slate-100 print:bg-white">
                  <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Horário
                    </span>
                  </div>
                  <p className="font-extrabold text-xs sm:text-sm text-slate-800 text-center">
                    {formatTime(event.startDate)}
                    {event.endDate && ` às ${formatTime(event.endDate)}`}
                  </p>
                  {event.hours ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100">
                      {event.hours}h Certificadas
                    </span>
                  ) : null}
                </div>

                {/* Formato & Local */}
                <div className="sm:col-span-2 flex flex-col items-center justify-center p-2 rounded-xl bg-white/80 border border-slate-100 print:bg-white">
                  <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                    {event.format === "online" ? (
                      <Video className="w-4 h-4 shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Modalidade & Local
                    </span>
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-slate-800 text-center capitalize">
                    {event.format === "presencial"
                      ? "Presencial"
                      : event.format === "online"
                      ? "Online / Remoto"
                      : "Híbrido"}
                    {event.location || event.locationOrLink ? (
                      <span className="font-medium text-slate-600">
                        {" "}
                        — {event.location || event.locationOrLink}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              {/* Extra tags (Gratuito / Valor / Vagas) */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-center gap-2 flex-wrap text-center">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  {event.isPaid && event.price
                    ? `Investimento: R$ ${event.price.toFixed(2)}`
                    : "Inscrição Gratuita"}
                </span>
                {event.maxParticipants ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 text-slate-700">
                    Vagas Limitadas: {event.maxParticipants}
                  </span>
                ) : null}
              </div>
            </div>

            {/* QR CODE DISPLAY (PROMINENT & HIGH CONTRAST) */}
            <div className="my-2 flex flex-col items-center justify-center text-center mx-auto">
              <div
                ref={qrCanvasRef}
                className="bg-white p-3 sm:p-3.5 rounded-2xl border-2 border-slate-900 shadow-md inline-flex flex-col items-center justify-center print:p-2 print:border-2"
              >
                <QRCodeCanvas
                  value={eventUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide text-center">
                <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Aponte a câmera para se inscrever</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-sm text-center mx-auto truncate">
                {eventUrl}
              </p>
            </div>

            {/* Footer Notice */}
            <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-medium w-full flex flex-col sm:flex-row justify-between items-center gap-1 text-center">
              <span>{settings.instName || "DAVVERO System"} • Credenciamento Acadêmico</span>
              <span>Acesso Rápido via QR Code</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

