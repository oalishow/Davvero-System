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
  GraduationCap,
  Sparkles,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useSettings } from "../context/SettingsContext";
import { useDialog } from "../context/DialogContext";
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

  const eventUrl = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
    event.id
  )}`;

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
        await navigator.share({
          title: event.title,
          text: `Confira o evento: ${event.title}`,
          url: eventUrl,
        });
      } catch {
        // Ignored or cancelled
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 print:p-0 print:overflow-visible">
          {/* Action Buttons Toolbar (Hidden on Print) */}
          <div className="flex flex-wrap gap-2 justify-center no-print">
            <button
              onClick={handlePrint}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Cartaz
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
              title="Baixar QR Code isolado"
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

          {/* PRINTABLE POSTER CARD */}
          <div
            id="printable-event-poster"
            className="bg-white text-slate-900 border-2 border-slate-200 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center justify-between shadow-lg relative overflow-hidden print:shadow-none print:border-none print:p-6 print:w-full print:m-0 print:h-auto break-inside-avoid"
            style={{ minHeight: "560px" }}
          >
            {/* Top Border Accent */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 print:bg-sky-600" />

            {/* Institution Header */}
            <div className="flex flex-col items-center justify-center pt-2 mb-3 w-full">
              {settings.instLogo ? (
                <img
                  src={settings.instLogo}
                  alt="Instituição"
                  className="h-12 sm:h-14 object-contain mb-2 print:h-12"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-2 font-black">
                  <GraduationCap className="w-6 h-6 text-sky-600" />
                </div>
              )}
              <p className="text-xs font-extrabold tracking-widest uppercase text-slate-500">
                {settings.instName || "INSTITUIÇÃO DE ENSINO"}
              </p>
              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-0.5">
                {event.isSeminary ? "Seminário Maior" : "Portal Acadêmico"}
              </p>
            </div>

            {/* EVENT PHOTO / BANNER (PROMINENT FOR PRINT & DISPLAY) */}
            {event.imageUrl ? (
              <div className="w-full max-w-md my-2.5 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center print:border-slate-300 print:shadow-none print:my-2">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full max-h-48 sm:max-h-56 object-cover print:max-h-44 print:object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}

            {/* Event Title */}
            <div className="mb-3 max-w-md">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {event.title}
              </h1>
              {event.speaker && (
                <p className="text-xs font-bold text-indigo-700 mt-1 flex items-center justify-center gap-1">
                  <User className="w-3.5 h-3.5" /> Palestrante / Convidado:{" "}
                  {event.speaker}
                </p>
              )}
            </div>

            {/* Event Metadata Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md text-left mb-4 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100 print:bg-slate-50/70">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Data
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatDate(event.startDate)}
                  </p>
                  {!isSameDay() && event.endDate && (
                    <p className="text-[11px] text-slate-600">
                      até {formatDate(event.endDate)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Horário
                  </p>
                  <p className="font-bold text-slate-800">
                    {formatTime(event.startDate)}
                    {event.endDate && ` às ${formatTime(event.endDate)}`}
                  </p>
                  {event.hours ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      {event.hours}h Certificadas
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-2 sm:col-span-2 pt-1 border-t border-slate-200/60">
                {event.format === "online" ? (
                  <Video className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                )}
                <div className="truncate">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Formato & Local
                  </p>
                  <p className="font-bold text-slate-800 capitalize truncate">
                    {event.format === "presencial"
                      ? "Presencial"
                      : event.format === "online"
                      ? "Online / Remoto"
                      : "Híbrido"}
                    {event.location || event.locationOrLink ? (
                      <span className="font-normal text-slate-600">
                        {" "}
                        — {event.location || event.locationOrLink}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            {/* QR CODE DISPLAY */}
            <div className="my-2 flex flex-col items-center justify-center">
              <div
                ref={qrCanvasRef}
                className="bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-md inline-block print:p-2.5"
              >
                <QRCodeCanvas
                  value={eventUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-sky-500" />
                Aponte a câmera para se inscrever
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-xs truncate">
                {eventUrl}
              </p>
            </div>

            {/* Footer Notice */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-medium w-full flex justify-between items-center">
              <span>DAVVERO System</span>
              <span>Acesso Acadêmico Direto</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

