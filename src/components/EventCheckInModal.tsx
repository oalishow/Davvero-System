import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import CheckInCelebrationAnimation from "./CheckInCelebrationAnimation";
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
  LogIn,
  UserPlus,
  FileCheck2,
  Check,
  Hash,
  Award
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { db, appId, enrollStudent, updateAttendanceStatus } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import type { Event, Member, Attendance } from "../types";

interface EventCheckInModalProps {
  event: Event;
  currentMember?: Member | null;
  onClose: () => void;
  onSuccess?: () => void;
  onRequestRegistration?: () => void;
  onNavigateToLogin?: () => void;
}

export default function EventCheckInModal({
  event,
  currentMember: initialCurrentMember,
  onClose,
  onSuccess,
  onRequestRegistration,
  onNavigateToLogin,
}: EventCheckInModalProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();

  // Retrieve member from props or localStorage
  const [activeMember, setActiveMember] = useState<Member | null>(() => {
    if (initialCurrentMember) return initialCurrentMember;
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("davveroId_cached_member");
        if (cached) return JSON.parse(cached) as Member;
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [successCheckedIn, setSuccessCheckedIn] = useState(false);
  const [alreadyPresent, setAlreadyPresent] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<Attendance | null>(null);
  const [digitalSignatureProtocol, setDigitalSignatureProtocol] = useState<string>("");
  const [signatureTimestamp, setSignatureTimestamp] = useState<string>("");

  // Form for non-logged-in participants
  const [identifier, setIdentifier] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [isVisitorMode, setIsVisitorMode] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    name: "",
    cpf: "",
    email: "",
    diocese: "",
  });

  // Check presence availability
  const presenceStatus = useMemo(() => {
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
        reason: "Aguardando liberação manual pelo organizador ou coordenação do evento.",
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
        reason: "O prazo de assinatura da lista de presença para este evento já foi encerrado.",
      };
    }

    return { isOpen: true, reason: "" };
  }, [event]);

  // Generate unique digital signature protocol
  const generateProtocol = (studentId: string) => {
    const evShort = (event.id || "EV").replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase();
    const stShort = studentId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase();
    const timeCode = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `DAV-PRES-${evShort}-${stShort}-${timeCode}-${rand}`;
  };

  // Check if active member already has attendance registered or auto-sign if arriving from QR Code
  useEffect(() => {
    if (!activeMember || !activeMember.id) return;

    const fetchMyAttendance = async () => {
      try {
        const q = query(
          collection(db, `artifacts/${appId}/public/data/attendances`),
          where("eventId", "==", event.id),
          where("studentId", "==", activeMember.id),
          limit(1)
        );
        const snap = await getDocs(q);
        const isFromQrScan = typeof window !== "undefined" && window.location.search.includes("checkin_event");

        if (!snap.empty) {
          const att = { id: snap.docs[0].id, ...snap.docs[0].data() } as Attendance;
          setExistingAttendance(att);
          const todayStr = new Date().toISOString().split("T")[0];
          const hasCheckedInToday = Boolean(att.checkInDates && att.checkInDates.includes(todayStr));

          if ((att.status === "presente" || att.status === "apto_para_certificado") && hasCheckedInToday) {
            setAlreadyPresent(true);
            setDigitalSignatureProtocol(
              generateProtocol(activeMember.id)
            );
            setSignatureTimestamp(new Date().toLocaleString("pt-BR"));
            return;
          } else if (isFromQrScan && activeMember.isActive !== false && presenceStatus.isOpen) {
            // Auto-check-in when redirected from QR code for today
            const nowStr = new Date().toLocaleString("pt-BR");
            const protocol = generateProtocol(activeMember.id);
            await updateAttendanceStatus(att.id, "presente", todayStr);
            setDigitalSignatureProtocol(protocol);
            setSignatureTimestamp(nowStr);
            setSuccessCheckedIn(true);
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              try { navigator.vibrate([40, 40, 80]); } catch {}
            }
            showAlert("Check-in e Assinatura Digital do dia realizados com sucesso!", { type: "success" });
            if (onSuccess) onSuccess();
            return;
          }
        } else if (isFromQrScan && activeMember.isActive !== false && presenceStatus.isOpen) {
          // Member enrolled and confirmed automatically upon scanning official QR
          const todayStr = new Date().toISOString().split("T")[0];
          const nowStr = new Date().toLocaleString("pt-BR");
          const protocol = generateProtocol(activeMember.id);
          await enrollStudent({
            eventId: event.id,
            studentId: activeMember.id,
            status: "presente",
            checkInDates: [todayStr],
            timestamp: new Date().toISOString(),
          });
          setDigitalSignatureProtocol(protocol);
          setSignatureTimestamp(nowStr);
          setSuccessCheckedIn(true);
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try { navigator.vibrate([40, 40, 80]); } catch {}
          }
          showAlert("Check-in e Assinatura Digital realizados com sucesso!", { type: "success" });
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        console.error("Error fetching attendance status:", err);
      }
    };
    fetchMyAttendance();
  }, [event.id, activeMember, presenceStatus.isOpen]);

  // Confirmation when logged in
  const handleConfirmPresenceLoggedIn = async () => {
    if (!activeMember || !activeMember.id) return;

    if (activeMember.isActive === false) {
      showAlert(
        "Cadastro Inativo: Seu cadastro acadêmico está inativo no sistema. Não é possível assinar a lista de presença. Por favor, procure a administração/secretaria.",
        { type: "error" }
      );
      return;
    }

    if (!presenceStatus.isOpen) {
      showAlert(presenceStatus.reason, { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nowStr = new Date().toLocaleString("pt-BR");
      const protocol = generateProtocol(activeMember.id);

      if (existingAttendance) {
        await updateAttendanceStatus(existingAttendance.id, "presente", todayStr);
      } else {
        await enrollStudent({
          eventId: event.id,
          studentId: activeMember.id,
          status: "presente",
          checkInDates: [todayStr],
          timestamp: new Date().toISOString(),
        });
      }

      setDigitalSignatureProtocol(protocol);
      setSignatureTimestamp(nowStr);
      setSuccessCheckedIn(true);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try { navigator.vibrate([40, 40, 80]); } catch {}
      }
      showAlert("Check-in e Assinatura Digital realizados com sucesso!", { type: "success" });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Check-in error:", err);
      showAlert("Erro ao confirmar presença: " + (err.message || ""), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Lookup student by RA, CPF, or Email with high-efficiency targeted queries (Protected Firebase Quota)
  const handleSearchAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentifierError("");

    if (!presenceStatus.isOpen) {
      showAlert(presenceStatus.reason, { type: "warning" });
      return;
    }

    if (!identifier.trim()) {
      setIdentifierError("Por favor, digite seu R.A., CPF ou E-mail cadastrado.");
      return;
    }

    setLoading(true);
    try {
      const qTrimmed = identifier.trim();
      const qLower = qTrimmed.toLowerCase();
      const cleanDigits = qTrimmed.replace(/\D/g, "");
      const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);

      let matched: Member | null = null;

      // 1. Check by RA
      if (qTrimmed) {
        const qRa = query(studentsRef, where("ra", "==", qTrimmed), limit(1));
        const snapRa = await getDocs(qRa);
        if (!snapRa.empty) {
          const m = { id: snapRa.docs[0].id, ...snapRa.docs[0].data() } as Member;
          if (!m.deletedAt) matched = m;
        }
      }

      // 2. Check by alphaCode
      if (!matched && qTrimmed) {
        const qAlpha = query(studentsRef, where("alphaCode", "==", qTrimmed), limit(1));
        const snapAlpha = await getDocs(qAlpha);
        if (!snapAlpha.empty) {
          const m = { id: snapAlpha.docs[0].id, ...snapAlpha.docs[0].data() } as Member;
          if (!m.deletedAt) matched = m;
        }
      }

      // 3. Check by CPF (raw and clean digits)
      if (!matched && cleanDigits.length >= 8) {
        const qCpf1 = query(studentsRef, where("cpf", "==", qTrimmed), limit(1));
        const snapCpf1 = await getDocs(qCpf1);
        if (!snapCpf1.empty) {
          const m = { id: snapCpf1.docs[0].id, ...snapCpf1.docs[0].data() } as Member;
          if (!m.deletedAt) matched = m;
        } else {
          const qCpf2 = query(studentsRef, where("cpf", "==", cleanDigits), limit(1));
          const snapCpf2 = await getDocs(qCpf2);
          if (!snapCpf2.empty) {
            const m = { id: snapCpf2.docs[0].id, ...snapCpf2.docs[0].data() } as Member;
            if (!m.deletedAt) matched = m;
          }
        }
      }

      // 4. Check by Email
      if (!matched && qLower.includes("@")) {
        const qEmail = query(studentsRef, where("email", "==", qLower), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const m = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() } as Member;
          if (!m.deletedAt) matched = m;
        }
      }

      if (matched) {
        // Check inactive status
        if (matched.isActive === false) {
          showAlert(
            `Cadastro Inativo: O cadastro acadêmico de "${matched.name}" está inativo no sistema. Não é possível assinar a lista de presença. Por favor, procure a coordenação.`,
            { type: "error" }
          );
          setLoading(false);
          return;
        }

        // Cache member locally
        try {
          localStorage.setItem("davveroId_cached_member", JSON.stringify(matched));
          if (matched.alphaCode || matched.ra) {
            localStorage.setItem("davveroId_student_identity", matched.alphaCode || matched.ra || "");
          }
        } catch {}

        setActiveMember(matched);

        const todayStr = new Date().toISOString().split("T")[0];
        const nowStr = new Date().toLocaleString("pt-BR");
        const protocol = generateProtocol(matched.id);

        await enrollStudent({
          eventId: event.id,
          studentId: matched.id,
          status: "presente",
          checkInDates: [todayStr],
          timestamp: new Date().toISOString(),
        });

        setDigitalSignatureProtocol(protocol);
        setSignatureTimestamp(nowStr);
        setSuccessCheckedIn(true);
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try { navigator.vibrate([40, 40, 80]); } catch {}
        }
        showAlert(`Assinatura digital confirmada com sucesso para ${matched.name}!`, {
          type: "success",
        });
        if (onSuccess) onSuccess();
      } else {
        setIdentifierError("Cadastro acadêmico não localizado com os dados informados.");
        showAlert(
          "Cadastro não encontrado. Para assinar a lista oficial de presença você deve possuir cadastro ativo. Se você for visitante externo, utilize o cadastro de visitante.",
          { type: "warning" }
        );
      }
    } catch (err: any) {
      console.error("Error matching student:", err);
      showAlert("Erro ao verificar cadastro no sistema.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Visitor registration
  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presenceStatus.isOpen) {
      showAlert(presenceStatus.reason, { type: "warning" });
      return;
    }

    if (!visitorForm.name.trim()) {
      showAlert("Por favor, preencha seu nome completo.", { type: "warning" });
      return;
    }

    const cleanCpf = visitorForm.cpf.trim().replace(/\D/g, "");
    if (!cleanCpf) {
      showAlert("O CPF é obrigatório para que você possa consultar e localizar sua presença depois na aba MINHA ID.", { type: "warning" });
      return;
    }
    if (cleanCpf.length !== 11) {
      showAlert("Por favor, informe um CPF válido com 11 dígitos numéricos.", { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const newVisitorId = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newVisitor: Member = {
        id: newVisitorId,
        name: visitorForm.name.trim(),
        cpf: cleanCpf,
        email: visitorForm.email.trim() || undefined,
        diocese: visitorForm.diocese.trim() || undefined,
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
      const nowStr = new Date().toLocaleString("pt-BR");
      const protocol = generateProtocol(newVisitorId);

      await enrollStudent({
        eventId: event.id,
        studentId: newVisitorId,
        status: "presente",
        checkInDates: [todayStr],
        timestamp: new Date().toISOString(),
      });

      setActiveMember(newVisitor);
      setDigitalSignatureProtocol(protocol);
      setSignatureTimestamp(nowStr);
      setSuccessCheckedIn(true);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try { navigator.vibrate([40, 40, 80]); } catch {}
      }
      showAlert(`Presença registrada com sucesso como visitante para ${newVisitor.name}!`, {
        type: "success",
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error creating visitor check-in:", err);
      showAlert("Erro ao registrar presença de visitante.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[95vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>Lista de Presença Digital</span>
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Check-in e Assinatura Oficial • DAVVERO System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Event Preview Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                Evento Oficial
              </span>
              {event.hours ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  {event.hours}h Certificadas
                </span>
              ) : null}
            </div>

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
              {event.location && (
                <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {event.location}
                </span>
              )}
            </div>
          </div>

          {/* Time Window Restriction Notice */}
          {!presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2 text-center animate-in fade-in">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <h5 className="text-sm font-bold">Assinatura Não Disponível no Momento</h5>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                {presenceStatus.reason}
              </p>
              <p className="text-[11px] text-amber-600/90 dark:text-amber-400/80 pt-1">
                O QR Code impresso respeita rigorosamente os horários e regras configurados pela coordenação acadêmica.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SUCCESS STATE: COMPROVANTE OFICIAL COM ANIMAÇÃO DE ASSINATURA DIGITAL     */}
          {/* ========================================================================= */}
          {(successCheckedIn || alreadyPresent) && (
            <CheckInCelebrationAnimation
              member={activeMember || {
                id: "VISITANTE",
                name: visitorForm.name.trim() || "Visitante",
                roles: ["VISITANTE"],
                diocese: visitorForm.diocese.trim() || undefined,
              }}
              event={event}
              protocol={digitalSignatureProtocol || generateProtocol(activeMember?.id || "PARTICIPANTE")}
              signatureTimestamp={signatureTimestamp || new Date().toLocaleString("pt-BR")}
              onClose={onClose}
              onNavigateToLogin={onNavigateToLogin}
              isVisitor={!activeMember?.ra}
            />
          )}

          {/* ========================================================================= */}
          {/* FLOW: LOGGED IN MEMBER                                                    */}
          {/* ========================================================================= */}
          {presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && activeMember && (
            <div className="space-y-4">
              {activeMember.isActive === false ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Cadastro Acadêmico Inativo</span>
                  </div>
                  <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                    O cadastro correspondente a <strong>{activeMember.name}</strong> está inativo no sistema. Não é permitido assinar a lista de presença. Por favor, procure a administração ou secretaria acadêmica.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold shrink-0">
                      {activeMember.name?.substring(0, 1) || <User className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                        Membro Ativo Identificado
                      </p>
                      <h5 className="text-sm font-black text-slate-800 dark:text-white truncate">
                        {activeMember.name}
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeMember.ra ? `RA: ${activeMember.ra}` : activeMember.email || ""}
                        {activeMember.diocese ? ` • Diocese: ${activeMember.diocese}` : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmPresenceLoggedIn}
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-2xl font-black text-sm uppercase tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{loading ? "Autenticando Assinatura..." : "Assinar Lista de Presença Digital"}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* FLOW: NOT LOGGED IN (USER MUST IDENTIFY OR BE LOGGED IN TO SIGN)          */}
          {/* ========================================================================= */}
          {presenceStatus.isOpen && !successCheckedIn && !alreadyPresent && !activeMember && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Mandatory Registration & Login Notice */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-sky-50 dark:from-amber-950/40 dark:to-sky-950/40 border border-amber-200/80 dark:border-amber-800/80 text-slate-800 dark:text-slate-100 space-y-2">
                <div className="flex items-center gap-2 font-black text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Aviso de Assinatura Oficial</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Para assinar a Lista de Presença Digital deste evento oficial, você deve <strong>possuir cadastro acadêmico ativo</strong> e <strong>estar logado no sistema</strong>.
                </p>
                {onNavigateToLogin && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToLogin();
                      }}
                      className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Fazer Login no Portal Acadêmico</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Form Option 1: Identification by RA, CPF, or Email */}
              {!isVisitorMode ? (
                <form onSubmit={handleSearchAndSign} className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Ou valide rapidamente sua matrícula:
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Busca Segura
                    </span>
                  </div>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Digite seu R.A., CPF ou E-mail Cadastrado"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setIdentifierError("");
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                    {identifierError && (
                      <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1">
                        {identifierError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>{loading ? "Verificando Cadastro..." : "Validar e Assinar Lista de Presença"}</span>
                  </button>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs border-t border-slate-200 dark:border-slate-700">
                    {onRequestRegistration && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRequestRegistration();
                        }}
                        className="text-amber-700 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Não possui cadastro? Solicitar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsVisitorMode(true)}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline font-medium cursor-pointer"
                    >
                      Sou Visitante Externo
                    </button>
                  </div>
                </form>
              ) : (
                /* Form Option 2: Visitor Registration */
                <form onSubmit={handleRegisterVisitor} className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Presença como Visitante
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsVisitorMode(false)}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold"
                    >
                      ← Voltar para RA
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Pe. Carlos Santos"
                      value={visitorForm.name}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span>CPF *</span>
                        <span className="text-[10px] text-rose-500 font-semibold lowercase">obrigatório</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="000.000.000-00"
                        value={visitorForm.cpf}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                          let formatted = digits;
                          if (digits.length > 9) {
                            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
                          } else if (digits.length > 6) {
                            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
                          } else if (digits.length > 3) {
                            formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
                          }
                          setVisitorForm((prev) => ({ ...prev, cpf: formatted }));
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Para localizar sua presença na aba MINHA ID.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={visitorForm.email}
                        onChange={(e) =>
                          setVisitorForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Diocese / Instituição de Origem
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Diocese de Marília"
                      value={visitorForm.diocese}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({ ...prev, diocese: e.target.value }))
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loading ? "Registrando..." : "Registrar Presença de Visitante"}</span>
                  </button>
                </form>
              )}

              {/* Action to Request Registration */}
              {onRequestRegistration && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                      Ainda não possui cadastro acadêmico?
                    </span>
                    <span className="text-indigo-700 dark:text-indigo-300 text-[11px]">
                      Solicite seu cadastro para obter credencial de acesso.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestRegistration();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Cadastre-se</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Footer Security Badge */}
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
