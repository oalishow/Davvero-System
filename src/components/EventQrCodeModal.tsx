import React, { useRef, useState, useMemo } from "react";
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
  Settings2,
  Lock,
  Unlock,
  CheckCircle2,
  Save,
  AlertCircle,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useSettings } from "../context/SettingsContext";
import { useDialog } from "../context/DialogContext";
import { DEFAULT_PUBLIC_URL } from "../lib/constants";
import { updateEvent } from "../lib/firebase";
import DavveroLogo from "./DavveroLogo";
import type { Event, EventPresenceConfig } from "../types";

interface EventQrCodeModalProps {
  event: Event;
  initialMode?: "enrollment" | "attendance";
  onClose: () => void;
  onEventUpdated?: (updated: Event) => void;
}

export default function EventQrCodeModal({
  event: initialEvent,
  initialMode = "attendance",
  onClose,
  onEventUpdated,
}: EventQrCodeModalProps) {
  const { settings } = useSettings();
  const { showAlert } = useDialog();

  // Strict check: Cartaz with QR Code is exclusively for administrators
  const isMasterAdmin = useMemo(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("adminMasterLogged") === "true") return true;
      try {
        const cached = localStorage.getItem("davveroId_cached_member");
        if (cached) {
          const m = JSON.parse(cached);
          if (m.roles && m.roles.some((r: string) => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
            return true;
          }
        }
      } catch {}
    }
    return false;
  }, []);

  const [event, setEvent] = useState<Event>(initialEvent);
  const [posterType, setPosterType] = useState<"attendance" | "enrollment">(initialMode);
  const [copied, setCopied] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Presence Config Local Form State
  const defaultPresenceConfig: EventPresenceConfig = {
    enabled: true,
    openMode: "default_30min",
    closeMode: "24h_after",
    isManualUnlocked: false,
    allowSelfEnroll: true,
    ...event.presenceConfig,
  };
  const [configState, setConfigState] = useState<EventPresenceConfig>(defaultPresenceConfig);

  const baseUrl = settings.url?.trim()
    ? settings.url.trim().replace(/\/$/, "")
    : DEFAULT_PUBLIC_URL;

  // The generated URL depends on poster type
  const targetUrl =
    posterType === "attendance"
      ? `${baseUrl}/?checkin_event=${encodeURIComponent(event.id)}`
      : `${baseUrl}/?event=${encodeURIComponent(event.id)}`;

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
    posterType === "attendance"
      ? `*LISTA DE PRESENÇA DIGITAL: ${event.title}*\n` +
        `📅 Data: ${formatDate(event.startDate)}${
          formatTime(event.startDate) ? ` às ${formatTime(event.startDate)}` : ""
        }\n` +
        `👉 Escaneie ou acesse o link para confirmar sua presença:\n${targetUrl}`
      : `*${event.title}*\n` +
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
        `👉 Acesse e inscreva-se:\n${targetUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      showAlert(
        posterType === "attendance"
          ? "Link de check-in copiado com sucesso!"
          : "Link do evento copiado com sucesso!",
        { type: "success" }
      );
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
          text: shareText,
          url: targetUrl,
        };

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
            console.log("Could not attach image file:", imgErr);
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
      a.download = `qrcode_${posterType}_${cleanTitle || "evento"}.png`;
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

  const handleSavePresenceConfig = async () => {
    setIsSavingConfig(true);
    try {
      await updateEvent(event.id, {
        presenceConfig: configState,
      });
      const updatedEvt = { ...event, presenceConfig: configState };
      setEvent(updatedEvt);
      if (onEventUpdated) onEventUpdated(updatedEvt);
      showAlert("Configurações de liberação da lista de presença salvas!", { type: "success" });
      setShowConfigPanel(false);
    } catch (err: any) {
      console.error("Erro ao salvar configuração de presença:", err);
      showAlert("Erro ao salvar configurações.", { type: "error" });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Block non-administrators from accessing or generating QR code posters
  if (!isMasterAdmin) {
    return createPortal(
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full text-center border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white">
            Acesso Restrito a Administradores
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            A geração de cartazes oficiais com QR Code e controle de lista de presença é uma funcionalidade exclusiva de administradores e coordenação.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      id="event-qr-modal-overlay"
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible print:z-auto"
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
                Gere cartazes para divulgação ou lista de presença digital
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4 print:p-0 print:overflow-visible">
          {/* Mode Switcher Tabs (Hidden on Print) */}
          <div className="flex bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl no-print gap-1">
            <button
              onClick={() => setPosterType("attendance")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                posterType === "attendance"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Lista de Presença (Check-in)</span>
            </button>
            <button
              onClick={() => setPosterType("enrollment")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                posterType === "enrollment"
                  ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Cartaz de Inscrição</span>
            </button>
          </div>

          {/* Configuration Trigger Bar (Admin Presence Timing Controls) */}
          <div className="no-print bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Regras de Liberação do QR Code
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {configState.openMode === "always"
                    ? "Sempre liberado para assinatura"
                    : configState.openMode === "manual"
                    ? configState.isManualUnlocked
                      ? "Liberado manualmente agora"
                      : "Bloqueado (Aguardando liberação manual)"
                    : configState.openMode === "custom"
                    ? `Abre em: ${configState.customOpenTime || "Horário definido"}`
                    : "Abre 30 min antes do evento"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showConfigPanel ? "Ocultar Ajustes" : "Configurar Liberação"}</span>
            </button>
          </div>

          {/* Expanded Config Panel */}
          {showConfigPanel && (
            <div className="no-print bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4" />
                  <span>Ajustar Janela de Assinatura do QR Code</span>
                </h4>
              </div>

              <div className="space-y-3">
                {/* Open Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quando o QR Code é Liberado para Assinar?
                  </label>
                  <select
                    value={configState.openMode}
                    onChange={(e) =>
                      setConfigState((prev) => ({
                        ...prev,
                        openMode: e.target.value as any,
                      }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="default_30min">
                      Abertura Padrão (30 minutos antes do evento)
                    </option>
                    <option value="always">Sempre Liberado (Qualquer horário)</option>
                    <option value="custom">Horário Personalizado (Definir data/hora)</option>
                    <option value="manual">Controle Manual (Abrir/Fechar sob demanda)</option>
                  </select>
                </div>

                {/* Custom Open Time Input */}
                {configState.openMode === "custom" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Data e Hora Exata de Abertura:
                    </label>
                    <input
                      type="datetime-local"
                      value={configState.customOpenTime || ""}
                      onChange={(e) =>
                        setConfigState((prev) => ({
                          ...prev,
                          customOpenTime: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                {/* Manual Unlock Toggle */}
                {configState.openMode === "manual" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {configState.isManualUnlocked ? (
                        <Unlock className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-amber-600" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {configState.isManualUnlocked
                            ? "Lista Liberada para Assinaturas"
                            : "Lista Bloqueada no Momento"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Mesmo com o cartaz impresso, participantes só conseguirão assinar quando desbloqueado.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfigState((prev) => ({
                          ...prev,
                          isManualUnlocked: !prev.isManualUnlocked,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        configState.isManualUnlocked
                          ? "bg-rose-600 hover:bg-rose-500 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {configState.isManualUnlocked ? "Bloquear Agora" : "Liberar Agora"}
                    </button>
                  </div>
                )}

                {/* Close Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Encerramento da Lista de Presença:
                  </label>
                  <select
                    value={configState.closeMode}
                    onChange={(e) =>
                      setConfigState((prev) => ({
                        ...prev,
                        closeMode: e.target.value as any,
                      }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="24h_after">24 horas após o término do evento</option>
                    <option value="1h_after">1 hora após o término do evento</option>
                    <option value="custom">Data e Hora Personalizada</option>
                    <option value="manual">Fechamento Manual</option>
                  </select>
                </div>

                {configState.closeMode === "custom" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Data e Hora de Fechamento:
                    </label>
                    <input
                      type="datetime-local"
                      value={configState.customCloseTime || ""}
                      onChange={(e) =>
                        setConfigState((prev) => ({
                          ...prev,
                          customCloseTime: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                {/* Allow Self Enroll toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allowSelfEnrollCheck"
                    checked={configState.allowSelfEnroll !== false}
                    onChange={(e) =>
                      setConfigState((prev) => ({
                        ...prev,
                        allowSelfEnroll: e.target.checked,
                      }))
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <label
                    htmlFor="allowSelfEnrollCheck"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Permitir que participantes não previamente inscritos assinem a lista ao escanear
                  </label>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSavePresenceConfig}
                    disabled={isSavingConfig}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingConfig ? "Salvando..." : "Salvar Configurações"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Toolbar (Hidden on Print) */}
          <div className="flex flex-wrap gap-2 justify-center no-print">
            <button
              onClick={handlePrint}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-95 cursor-pointer ${
                posterType === "attendance"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-sky-600 hover:bg-sky-500"
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cartaz A4</span>
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
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

          {/* PRINTABLE POSTER CARD (OPTIMIZED FOR A4 PORTRAIT & SCREEN) */}
          <div
            id="printable-event-poster"
            className={`bg-white text-slate-900 border-2 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center justify-between shadow-xl relative overflow-hidden w-full max-w-xl mx-auto print:border-2 print:rounded-2xl print:p-6 print:w-full print:max-w-none print:shadow-none break-inside-avoid ${
              posterType === "attendance"
                ? "border-emerald-600 print:border-emerald-600"
                : "border-sky-600 print:border-sky-600"
            }`}
            style={{ minHeight: "560px" }}
          >
            {/* Top Border Accent */}
            <div
              className={`absolute top-0 left-0 right-0 h-3 ${
                posterType === "attendance"
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 print:bg-emerald-600"
                  : "bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 print:bg-sky-600"
              }`}
            />

            {/* App / Event Header */}
            <div className="flex flex-col items-center justify-center pt-2 mb-2 w-full text-center">
              <div className="h-12 sm:h-14 w-auto flex items-center justify-center mb-1.5 print:h-11 mx-auto">
                <DavveroLogo
                  src={settings.instLogo}
                  alt="DAVVERO System"
                  className="h-12 sm:h-14 object-contain print:h-11 rounded-xl mx-auto block"
                  iconClassName="w-12 h-12 text-sky-600"
                  color={settings.instColor || "#0284c7"}
                />
              </div>
              <p className="text-xs font-black tracking-widest uppercase text-slate-800 text-center">
                DAVVERO SYSTEM
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span
                  className={`px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider print:border ${
                    posterType === "attendance"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-sky-100 text-sky-700 border-sky-200"
                  }`}
                >
                  {posterType === "attendance"
                    ? "LISTA OFICIAL DE PRESENÇA DIGITAL"
                    : event.isSeminary
                    ? "Seminário Maior • Evento Oficial"
                    : event.isDiocese
                    ? "Diocese • Evento Oficial"
                    : "Cartaz Oficial • Evento Acadêmico"}
                </span>
              </div>
            </div>

            {/* EVENT PHOTO / BANNER */}
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

            {/* Event Metadata Card */}
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
            </div>

            {/* QR CODE DISPLAY */}
            <div className="my-2 flex flex-col items-center justify-center text-center mx-auto">
              <div
                ref={qrCanvasRef}
                className={`bg-white p-3 sm:p-3.5 rounded-2xl border-2 shadow-md inline-flex flex-col items-center justify-center print:p-2 print:border-2 ${
                  posterType === "attendance"
                    ? "border-emerald-600"
                    : "border-slate-900"
                }`}
              >
                <QRCodeCanvas
                  value={targetUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide text-center">
                {posterType === "attendance" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Aponte a câmera para assinar a presença</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                    <span>Aponte a câmera para se inscrever</span>
                  </>
                )}
              </div>

              {posterType === "attendance" && (
                <p className="text-[10px] text-slate-500 font-medium mt-0.5 max-w-sm text-center mx-auto">
                  Assinatura digital validada conforme regras de horário do evento
                </p>
              )}

              <p className="text-[9px] text-slate-400 font-mono mt-0.5 max-w-sm text-center mx-auto truncate">
                {targetUrl}
              </p>
            </div>

            {/* Footer Notice */}
            <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-medium w-full flex flex-col sm:flex-row justify-between items-center gap-1 text-center">
              <span>{settings.instName || "DAVVERO System"} • Credenciamento Acadêmico</span>
              <span>
                {posterType === "attendance"
                  ? "Lista de Presença Oficial"
                  : "Acesso Rápido via QR Code"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
