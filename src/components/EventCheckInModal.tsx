import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  UserCheck,
  AlertTriangle,
  QrCode,
  Sparkles,
  Lock,
  ArrowRight,
  User,
  ShieldCheck,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, appId, enrollStudent, updateAttendanceStatus } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import type { Event, Member, Attendance } from "../types";
import DavveroLogo from "./DavveroLogo";

interface EventCheckInModalProps {
  event: Event;
  currentMember?: Member | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EventCheckInModal({
  event,
  currentMember,
  onClose,
  onSuccess,
}: EventCheckInModalProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(false);
  const [successCheckedIn, setSuccessCheckedIn] = useState(false);
  const [alreadyPresent, setAlreadyPresent] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<Attendance | null>(null);

  // Form for non-logged-in participants
  const [identifier, setIdentifier] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorDiocese, setVisitorDiocese] = useState("");
  const [isVisitorMode, setIsVisitorMode] = useState(false);

  // Check presence availability
  const checkIsPresenceOpen = (): { isOpen: boolean; reason: string; openTime?: string } => {
    if (event.presenceConfig?.enabled === false) {
      return {
        isOpen: false,
        reason: "A lista de presença digital está desativada para este evento.",
      };
    }

    const cfg = event.presenceConfig || {
      enabled: true,
      openMode: "default_30min",
      closeMode: "24h_after",
    };

    if (cfg.openMode === "always") {
      return { isOpen: true, reason: "" };
    }

    if (cfg.openMode === "manual") {
      if (cfg.isManualUnlocked) {
        return { isOpen: true, reason: "" };
      }
      return {
        isOpen: false,
        reason: "Aguardando liberação manual pelo organizador/coordenador do evento.",
      };
    }

    const now = Date.now();
    let openTime = 0;
    if (cfg.openMode === "default_30min" || !cfg.openMode) {
      const startTimestamp = new Date(event.startDate).getTime();
      openTime = startTimestamp - 30 * 60 * 1000;
    } else if (cfg.openMode === "custom" && cfg.customOpenTime) {
      openTime = new Date(cfg.customOpenTime).getTime();
    }

    let closeTime = Infinity;
    if (cfg.closeMode === "24h_after" || !cfg.closeMode) {
      const endTimestamp = event.endDate
        ? new Date(event.endDate).getTime()
        : new Date(event.startDate).getTime();
      closeTime = endTimestamp + 24 * 60 * 60 * 1000;
    } else if (cfg.closeMode === "1h_after") {
      const endTimestamp = event.endDate
        ? new Date(event.endDate).getTime()
        : new Date(event.startDate).getTime();
      closeTime = endTimestamp + 1 * 60 * 60 * 1000;
    } else if (cfg.closeMode === "custom" && cfg.customCloseTime) {
      closeTime = new Date(cfg.customCloseTime).getTime();
    }

    if (openTime > now) {
      const openDate = new Date(openTime);
      return {
        isOpen: false,
        reason: `A assinatura de presença abrirá em ${openDate.toLocaleDateString(
          "pt-BR"
        )} às ${openDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
        openTime: openDate.toLocaleString("pt-BR"),
      };
    }

    if (now > closeTime) {
      return {
        isOpen: false,
        reason: "O prazo de assinatura de presença para este evento já foi encerrado.",
      };
    }

    return { isOpen: true, reason: "" };
  };

  const presenceStatus = checkIsPresenceOpen();

  // Check if current user is already registered / present
  useEffect(() => {
    if (!currentMember) return;
    const fetchMyAttendance = async () => {
      try {
        const q = query(
          collection(db, `artifacts/${appId}/public/data/attendances`),
          where("eventId", "==", event.id),
          where("studentId", "==", currentMember.id)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const att = snap.docs[0].data() as Attendance;
          setExistingAttendance(att);
          if (att.status === "presente") {
            setAlreadyPresent(true);
          }
        }
      } catch (err) {
        console.error("Error fetching attendance status:", err);
      }
    };
    fetchMyAttendance();
  }, [event.id, currentMember]);

  const handleConfirmPresenceLoggedIn = async () => {
    if (!currentMember) return;
    if (!presenceStatus.isOpen) {
      showAlert(presenceStatus.reason, { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      if (existingAttendance) {
        await updateAttendanceStatus(existingAttendance.id, "presente", todayStr);
      } else {
        // Self-enroll directly if not already in list
        await enrollStudent({
          eventId: event.id,
          studentId: currentMember.id,
          status: "presente",
          checkInDates: [todayStr],
          timestamp: new Date().toISOString(),
        });
      }

      setSuccessCheckedIn(true);
      showAlert("Presença confirmada com sucesso!", { type: "success" });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Check-in error:", err);
      showAlert("Erro ao confirmar presença: " + (err.message || ""), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchOrRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presenceStatus.isOpen) {
      showAlert(presenceStatus.reason, { type: "warning" });
      return;
    }

    if (!isVisitorMode) {
      if (!identifier.trim()) {
        showAlert("Por favor, digite seu RA, CPF ou E-mail.", { type: "warning" });
        return;
      }

      setLoading(true);
      try {
        const qRaw = identifier.trim().toLowerCase();
        // Look up member
        const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`));
        const matched = snap.docs
          .map((d) => d.data() as Member)
          .find((m) => {
            return (
              (m.ra && m.ra.toLowerCase() === qRaw) ||
              (m.cpf && m.cpf.replace(/\D/g, "") === qRaw.replace(/\D/g, "")) ||
              (m.email && m.email.toLowerCase() === qRaw) ||
              (m.name && m.name.toLowerCase() === qRaw)
            );
          });

        if (matched) {
          const todayStr = new Date().toISOString().split("T")[0];
          await enrollStudent({
            eventId: event.id,
            studentId: matched.id,
            status: "presente",
            checkInDates: [todayStr],
            timestamp: new Date().toISOString(),
          });
          setSuccessCheckedIn(true);
          showAlert(`Presença confirmada com sucesso para ${matched.name}!`, { type: "success" });
          if (onSuccess) onSuccess();
        } else {
          showAlert("Cadastro acadêmico não encontrado. Por favor, preencha seus dados como visitante.", {
            type: "info",
          });
          setIsVisitorMode(true);
          setVisitorName(identifier);
        }
      } catch (err: any) {
        console.error("Error matching student:", err);
        showAlert("Erro ao verificar cadastro.", { type: "error" });
      } finally {
        setLoading(false);
      }
    } else {
      if (!visitorName.trim()) {
        showAlert("Por favor, preencha o seu nome completo.", { type: "warning" });
        return;
      }

      setLoading(true);
      try {
        const newVisitorId = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newVisitor: Member = {
          id: newVisitorId,
          name: visitorName.trim(),
          email: visitorEmail.trim() || undefined,
          diocese: visitorDiocese.trim() || undefined,
          course: "Visitante",
          roles: ["VISITANTE"],
          isActive: true,
          registrationType: "quick",
          createdAt: new Date().toISOString(),
        };

        await setDoc(
          doc(db, `artifacts/${appId}/public/data/students`, newVisitorId),
          newVisitor
        );

        const todayStr = new Date().toISOString().split("T")[0];
        await enrollStudent({
          eventId: event.id,
          studentId: newVisitorId,
          status: "presente",
          checkInDates: [todayStr],
          timestamp: new Date().toISOString(),
        });

        setSuccessCheckedIn(true);
        showAlert(`Presença registrada com sucesso como visitante para ${visitorName}!`, {
          type: "success",
        });
        if (onSuccess) onSuccess();
      } catch (err: any) {
        console.error("Error creating visitor check-in:", err);
        showAlert("Erro ao registrar presença de visitante.", { type: "error" });
      } finally {
        setLoading(false);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>Check-in Digital de Presença</span>
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Lista Oficial de Presença • DAVVERO System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Event Preview Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
              Evento Acadêmico
            </span>
            <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
              {event.title}
            </h4>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(event.startDate).toLocaleDateString("pt-BR")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(event.startDate).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {event.hours ? (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  • {event.hours}h Certificadas
                </span>
              ) : null}
            </div>
          </div>

          {/* Time Window Restriction Notice */}
          {!presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <h5 className="text-sm font-bold">Assinatura Não Disponível no Momento</h5>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                {presenceStatus.reason}
              </p>
              <div className="text-[11px] text-amber-600/90 dark:text-amber-400/80 pt-1">
                O QR Code impresso respeita rigorosamente os horários e liberações configurados pela coordenação.
              </div>
            </div>
          )}

          {/* Success State */}
          {(successCheckedIn || alreadyPresent) && (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-emerald-900 dark:text-emerald-200">
                Presença Confirmada!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-sm mx-auto leading-relaxed">
                Sua presença foi registrada na lista oficial deste evento acadêmico. O certificado será emitido automaticamente ao término do evento.
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          {/* Active Flow: Logged-in User */}
          {presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && currentMember && (
            <div className="space-y-4">
              <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold shrink-0">
                  {currentMember.name?.substring(0, 1) || <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                    Identificado como
                  </p>
                  <h5 className="text-sm font-black text-slate-800 dark:text-white truncate">
                    {currentMember.name}
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentMember.ra ? `RA: ${currentMember.ra}` : currentMember.email || ""}
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirmPresenceLoggedIn}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-2xl font-black text-sm uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{loading ? "Registrando..." : "Confirmar Minha Presença Agora"}</span>
              </button>
            </div>
          )}

          {/* Active Flow: Not Logged In */}
          {presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && !currentMember && (
            <form onSubmit={handleSearchOrRegisterVisitor} className="space-y-4">
              {!isVisitorMode ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Digite seu R.A., CPF ou E-mail Cadastrado:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 2024001 ou 000.000.000-00"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      onClick={() => setIsVisitorMode(true)}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold"
                    >
                      Não possui R.A.? Entrar como Visitante
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Pe. Carlos Santos"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={visitorEmail}
                        onChange={(e) => setVisitorEmail(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Diocese / Instituição
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Diocese de Marília"
                        value={visitorDiocese}
                        onChange={(e) => setVisitorDiocese(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVisitorMode(false)}
                    className="text-xs text-slate-500 hover:underline font-semibold"
                  >
                    ← Voltar para busca por RA
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-2xl font-black text-sm uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{loading ? "Processando..." : "Assinar Presença no Evento"}</span>
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
            <span>Validação Criptográfica de Presença • DAVVERO System</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
