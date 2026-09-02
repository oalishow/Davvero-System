import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import {
  Calendar,
  CalendarPlus,
  CalendarCheck,
  Clock,
  MapPin,
  Video,
  UserCheck,
  Users,
  Ban,
  User,
  Download,
  ExternalLink,
  Share2,
  Edit,
  Settings,
  Pin,
  QrCode,
  MessageCircle,
  Church,
  Plus,
  Globe,
  Award,
  Crown,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  db,
  appId,
  enrollStudent,
  unsubscribeFromEvent,
  updateEvent,
  deleteEvent,
} from "../lib/firebase";
import type { Event, Attendance, Member } from "../types";
import { AVAILABLE_DIOCESES } from "../types";
import PublicAttendeesModal from "./PublicAttendeesModal";
import Modal from "./Modal";
import PublicRequestModal from "./PublicRequestModal";
import RegistrationSuccessModal from "./RegistrationSuccessModal";
import EventQrCodeModal from "./EventQrCodeModal";
import QuickEventEnrollModal from "./QuickEventEnrollModal";
import CreateDioceseEventModal from "./CreateDioceseEventModal";
import EventAttendeesModal from "./EventAttendeesModal";
import CertificateEditor from "./CertificateEditor";
import EventCheckInModal from "./EventCheckInModal";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import { DEFAULT_PUBLIC_URL } from "../lib/constants";
import EventManagement from "./EventManagement";

export default function EventsPage({ onNavigateToStudent, renderSeminary = false }: { onNavigateToStudent?: () => void, renderSeminary?: boolean }) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
    if (cachedMemberStr) {
      try {
        const m = JSON.parse(cachedMemberStr) as Member;
        if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
          return true;
        }
      } catch(e) {}
    }
    return false;
  });
  const [showAdminEventModal, setShowAdminEventModal] = useState(false);
  const [showCreateDioceseModal, setShowCreateDioceseModal] = useState(false);
  const [dioceseEventToEdit, setDioceseEventToEdit] = useState<Event | null>(null);
  const [adminAttendeesEvent, setAdminAttendeesEvent] = useState<Event | null>(null);
  const [certificateEditorEvent, setCertificateEditorEvent] = useState<{ event: Event, type: "participant" | "organizer" } | null>(null);
  const [selectedDioceseFilter, setSelectedDioceseFilter] = useState<string>("all");
  const [showPublicReq, setShowPublicReq] = useState(false);
  const [showRegistrationSuccessModal, setShowRegistrationSuccessModal] = useState(false);
  const [selectedQrEvent, setSelectedQrEvent] = useState<Event | null>(null);
  const [quickEnrollEvent, setQuickEnrollEvent] = useState<Event | null>(null);
  const [checkInEvent, setCheckInEvent] = useState<Event | null>(null);
  const [sharedEventId, setSharedEventId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("event") || params.get("checkin_event");
    }
    return null;
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypeTab, setEventTypeTab] = useState<"general" | "seminary" | "diocese" | "appointments">(renderSeminary ? "seminary" : "general");
  const [subTab, setSubTab] = useState<"upcoming" | "past">("upcoming");
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [viewPublicAttendeesEvent, setViewPublicAttendeesEvent] =
    useState<Event | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [paymentModalEvent, setPaymentModalEvent] = useState<Event | null>(null);

  useEffect(() => {
    // Load student if logged in
    const bondedId = localStorage.getItem("davveroId_student_identity");
    if (bondedId) {
      const fetchStudent = async () => {
        try {
          const q = query(
            collection(db, `artifacts/${appId}/public/data/students`),
            where("alphaCode", "==", bondedId),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setMember({
              id: snap.docs[0].id,
              ...snap.docs[0].data(),
            } as Member);
          }
        } catch (e) {
          console.error("Failed to load student", e);
        }
      };
      fetchStudent();
    }
  }, []);

  useEffect(() => {
    const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      let evts = snap.docs.map((d) => {
        const e = d.data() as Event;
        const now = new Date().getTime();
        if (e.status === "aberto") {
          const checkDate = e.endDate ? new Date(e.endDate).getTime() : new Date(e.startDate).getTime();
          const GRACE_PERIOD = 2 * 60 * 60 * 1000; // 2 hours
          if (checkDate + GRACE_PERIOD < now) {
             return { ...e, status: "encerrado" as any };
          }
        }
        return e;
      });
      evts = evts.filter(e => e.status !== "deleted");
      const now = new Date().getTime();
      evts.sort((a, b) => {
        // Compute states
        const timeA = new Date(a.startDate).getTime();
        const endA = a.endDate ? new Date(a.endDate).getTime() : timeA + (2 * 60 * 60 * 1000); 
        const timeB = new Date(b.startDate).getTime();
        const endB = b.endDate ? new Date(b.endDate).getTime() : timeB + (2 * 60 * 60 * 1000);
        
        const isAInProgress = timeA <= now && endA >= now;
        const isBInProgress = timeB <= now && endB >= now;
        
        // 1. Pinned Events at very top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // 2. In progress events
        if (isAInProgress && !isBInProgress) return -1;
        if (!isAInProgress && isBInProgress) return 1;
        
        // 3. Chronological sorting
        const aIsFuture = timeA >= now;
        const bIsFuture = timeB >= now;
        if (aIsFuture && bIsFuture) return timeA - timeB;
        if (!aIsFuture && !bIsFuture) return timeB - timeA;
        return aIsFuture ? -1 : 1;
      });
      setEvents(evts);
    });

    return () => unsubEvents();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventIdFromUrl = params.get("event");
    const checkinEventId = params.get("checkin_event");

    if (checkinEventId && events.length > 0) {
      const target = events.find((e) => e.id === checkinEventId);
      if (target) {
        setCheckInEvent(target);
      }
    } else if (eventIdFromUrl && events.length > 0) {
      setTimeout(() => {
        const eventEl = document.getElementById(`event-${eventIdFromUrl}`);
        if (eventEl) {
          eventEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          eventEl.classList.add("ring-4", "ring-indigo-500", "transition-all", "duration-1000");
          setTimeout(() => {
            eventEl.classList.remove("ring-4", "ring-indigo-500");
          }, 3000);
        }
      }, 500); // Wait a bit for render
    }
  }, [events]);

  const hasPrivilegedRole = member?.roles?.some(r => ["ADMIN", "COORDENADOR", "GERENTE", "REITOR", "VICE-REITOR", "DIRETOR ESPIRITUAL", "PADRE"].includes(r.toUpperCase()));

  const isEventAdmin = (event: Event): boolean => {
    if (isAdmin || hasPrivilegedRole) return true;
    if (!member) return false;
    if (event.createdBy && (event.createdBy === member.id || event.createdBy === member.ra || event.createdBy === member.email)) {
      return true;
    }
    if (event.creatorEmail && member.email && event.creatorEmail.toLowerCase() === member.email.toLowerCase()) {
      return true;
    }
    if (event.creatorRa && member.ra && event.creatorRa === member.ra) {
      return true;
    }
    return false;
  };

  const getEventComputedState = (e: any) => {
    if (e.status === "deleted") return "past";
    if (e.status === "cancelado") return "past";
    const now = new Date();
    const start = new Date(e.startDate);
    const end = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
    
    const hasStarted = now >= start;
    const hasFinished = now > end;
    const hoursSinceEnd = hasFinished ? (now.getTime() - end.getTime()) / (1000 * 60 * 60) : 0;

    if (e.status === "encerrado" && hoursSinceEnd >= 2) return "past";

    if (hasStarted && !hasFinished) {
      return "in_progress";
    } else if (hasFinished) {
      return hoursSinceEnd < 2 ? "finished_recently" : "past";
    } else {
      return "upcoming";
    }
  };

  const filteredEvents = events.filter((e) => {
    if (eventTypeTab === "seminary") {
      if (!e.isSeminary) return false;
      if (e.seminaryId && e.seminaryId !== member?.seminary && !hasPrivilegedRole) return false;
      return true;
    } else if (eventTypeTab === "diocese") {
      if (!e.isDiocese) return false;
      if (selectedDioceseFilter !== "all") {
        const eventDiocese = (e.dioceseId || "").toUpperCase().trim();
        const targetDiocese = selectedDioceseFilter.toUpperCase().trim();
        if (eventDiocese !== targetDiocese) return false;
      }
      return true;
    } else {
      // Aba Acadêmico / Geral: Exibe eventos acadêmicos gerais e eventos diocesanos marcados como públicos!
      return (!e.isSeminary && !e.isDiocese) || (e.isDiocese && Boolean(e.isPublic));
    }
  });

  useEffect(() => {
    if (!member) return;

    const qAttendances = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("studentId", "==", member.id)
    );
    const unsubAttendances = onSnapshot(qAttendances, (snap) => {
      const atts = snap.docs.map(d => d.data() as Attendance);
      setMyAttendances(atts);
    });

    return () => unsubAttendances();
  }, [member]);

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      const target = events.find((e) => e.id === eventId);
      if (target) {
        setQuickEnrollEvent(target);
      }
      return;
    }
    setIsEnrollingInProgress(eventId);
    try {
      await enrollStudent({
        eventId,
        studentId: member.id,
        status: "inscrito",
        timestamp: new Date().toISOString(),
      });
      showAlert("Inscrição realizada com sucesso!", { type: 'success' });
      
      const target = events.find((e) => e.id === eventId);
      if (target?.googleFormsLink) {
        const link = target.googleFormsLink.startsWith("http") ? target.googleFormsLink : `https://${target.googleFormsLink}`;
        setTimeout(() => window.open(link, "_blank"), 1500);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "LIMITE_EXCEDIDO") {
        showAlert("Desculpe, a lotação para este evento está esgotada.", { type: 'warning' });
      } else if (err.message === "INSCRICOES_PAUSADAS") {
        showAlert("Desculpe, as inscrições para este evento estão pausadas.", { type: 'warning' });
      } else if (err.message === "INSCRICOES_ENCERRADAS") {
        showAlert("Desculpe, as inscrições para este evento já foram encerradas (prazo expirou).", { type: 'warning' });
      } else if (err.message === "EVENTO_FECHADO") {
        showAlert("Desculpe, este evento já está fechado ou encerrado.", { type: 'warning' });
      } else if (err.message === "EVENTO_EXCLUIDO") {
        showAlert("Desculpe, este evento não existe mais.", { type: 'error' });
      } else {
        showAlert("Erro ao realizar inscrição.", { type: 'error' });
      }
    } finally {
      setIsEnrollingInProgress(null);
    }
  };

  const handleUnenroll = async (eventId: string, studentId: string) => {
    setConfirmModal({
      isOpen: true,
      message:
        "Tem a certeza que deseja cancelar a sua inscrição neste evento?",
      onConfirm: async () => {
        try {
          await unsubscribeFromEvent(eventId, studentId);
          showAlert("Inscrição cancelada com sucesso.", { type: 'success' });
        } catch (err) {
          console.error(err);
          showAlert("Erro ao cancelar inscrição.", { type: 'error' });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aberto":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
      case "encerrado":
        return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
      default:
        return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400";
    }
  };

  const handleRegisterPresence = async (eventId: string) => {
    if (!member) {
      const target = events.find((e) => e.id === eventId);
      if (target) {
        setQuickEnrollEvent(target);
      }
      return;
    }
    const myAttendance = myAttendances.find(a => a.eventId === eventId);
    if (!myAttendance) return;
    
    setIsEnrollingInProgress(eventId);
    try {
      const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, myAttendance.id);
      await updateDoc(attRef, {
        status: "presente",
        checkInDates: arrayUnion(new Date().toISOString().split("T")[0])
      });
      showAlert("Presença registrada com sucesso!", { type: 'success' });
    } catch (e: any) {
      showAlert(e.message || "Erro ao registrar presença.", { type: 'error' });
    } finally {
      setIsEnrollingInProgress(null);
    }
  };

  const isPresenceOpen = (event: Event) => {
    if (event.presenceConfig?.enabled === false) return false;
    const cfg = event.presenceConfig || { enabled: true, openMode: "default_30min", closeMode: "24h_after" };
    if (!cfg.enabled) return false;

    if (cfg.openMode === "always") {
      return true;
    }

    if (cfg.openMode === "manual") {
      return Boolean(cfg.isManualUnlocked);
    }
    
    const now = new Date().getTime();
    
    let openTime = 0;
    if (cfg.openMode === "default_30min" || !cfg.openMode) {
      const startTimestamp = new Date(event.startDate).getTime();
      openTime = startTimestamp - 30 * 60 * 1000;
    } else if (cfg.openMode === "custom" && cfg.customOpenTime) {
      openTime = new Date(cfg.customOpenTime).getTime();
    }
    
    let closeTime = Infinity;
    if (cfg.closeMode === "24h_after" || !cfg.closeMode) {
      const endTimestamp = event.endDate ? new Date(event.endDate).getTime() : new Date(event.startDate).getTime();
      closeTime = endTimestamp + 24 * 60 * 60 * 1000;
    } else if (cfg.closeMode === "1h_after") {
      const endTimestamp = event.endDate ? new Date(event.endDate).getTime() : new Date(event.startDate).getTime();
      closeTime = endTimestamp + 1 * 60 * 60 * 1000;
    } else if (cfg.closeMode === "custom" && cfg.customCloseTime) {
      closeTime = new Date(cfg.customCloseTime).getTime();
    } else if (cfg.closeMode === "manual") {
      closeTime = Infinity;
    }
    
    if (openTime === 0) return true; 
    
    return now >= openTime && now <= closeTime;
  };

  const getPresenceCountdown = (event: Event) => {
    if (!event.presenceConfig?.enabled) return null;
    
    const now = new Date().getTime();
    let openTime = 0;
    if (event.presenceConfig.openMode === "default_30min") {
      const endTimestamp = event.endDate ? new Date(event.endDate).getTime() : new Date(event.startDate).getTime();
      openTime = endTimestamp - 30 * 60 * 1000;
    } else if (event.presenceConfig.openMode === "custom" && event.presenceConfig.customOpenTime) {
      openTime = new Date(event.presenceConfig.customOpenTime).getTime();
    }
    
    if (openTime > now && (openTime - now) <= 24 * 60 * 60 * 1000) {
      return openTime - now; 
    }
    return null;
  };

  const exportToCalendar = (event: Event) => {
    const formatDate = (dateUnparsed: string) => {
      const d = new Date(dateUnparsed);
      // Create ICS format: YYYYMMDDTHHmmssZ
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    let locationStr = event.locationOrLink || event.location || "";
    if (locationStr && !locationStr.startsWith("http")) {
      locationStr = `LOCATION:${locationStr}\n`;
    } else {
      locationStr = "";
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fajopa//Eventos//PT
BEGIN:VEVENT
UID:${event.id}@fajopa.com
DTSTAMP:${formatDate(new Date().toISOString())}
DTSTART:${formatDate(event.startDate)}
DTEND:${formatDate(event.endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
${locationStr}END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className={`${renderSeminary ? 'bg-amber-600 dark:bg-amber-700 border-amber-500 dark:border-amber-600' : 'bg-sky-600 dark:bg-sky-700 border-sky-500 dark:border-sky-600'} rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border`}>
        {viewPublicAttendeesEvent && (
          <PublicAttendeesModal
            event={viewPublicAttendeesEvent}
            onClose={() => setViewPublicAttendeesEvent(null)}
          />
        )}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            {renderSeminary ? "Eventos do Seminário" : "Painel de Eventos"}
          </h2>
          <p className={`${renderSeminary ? 'text-amber-100' : 'text-sky-100'} font-medium text-sm sm:text-base max-w-md mx-auto`}>
            {renderSeminary ? "Explore e inscreva-se nos retiros, formações exclusivas e demais eventos." : "Explore e inscreva-se nos próximos eventos acadêmicos, dos seminários e das dioceses."}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAdminEventModal(true)}
              className="mt-6 bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
            >
              <Settings className="w-4 h-4" /> Gerenciar Eventos
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdminEventModal && (
          <Modal
            isOpen={true}
            onClose={() => setShowAdminEventModal(false)}
            title="Gerenciamento de Eventos"
          >
            <div className="max-h-[80vh] overflow-y-auto custom-scrollbar p-1">
               <EventManagement adminAccessLevel="ADMIN" member={member} />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Shared Event Banner */}
      {sharedEventId && (() => {
        const sharedEvent = events.find(e => e.id === sharedEventId);
        if (!sharedEvent) return null;
        return (
          <div className="mb-4 p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Evento Selecionado via Link
                </span>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-snug">
                  {sharedEvent.title}
                </h4>
              </div>
            </div>
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("event");
                window.history.replaceState({}, "", url.pathname);
                setSharedEventId(null);
              }}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline px-2 py-1 shrink-0"
            >
              Ver todos os eventos
            </button>
          </div>
        );
      })()}

      {!renderSeminary && (
        <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-2 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setEventTypeTab("general")}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
              eventTypeTab === "general"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
            }`}
          >
            Acadêmico
          </button>
          <button
            onClick={() => setEventTypeTab("seminary")}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
              eventTypeTab === "seminary"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
            }`}
          >
            SEMINÁRIO
          </button>
          <button
            onClick={() => setEventTypeTab("diocese")}
            className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
              eventTypeTab === "diocese"
                ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-md transform scale-[1.02]"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
            }`}
          >
            DIOCESES
          </button>
        </div>
      )}

      {eventTypeTab === "diocese" && !renderSeminary && (
        <div className="bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/90 dark:from-purple-950/20 dark:via-slate-800/90 dark:to-indigo-950/20 border border-purple-200/80 dark:border-purple-800/40 p-4 sm:p-5 rounded-3xl mb-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-2xl shrink-0">
                <Church className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  Eventos das Dioceses
                  {member?.diocese && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                      Sua: {member.diocese}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Encontros, formações, assembleias e retiros organizados por cada Diocese.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCreateDioceseModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Evento da Diocese</span>
            </button>
          </div>

          {/* Diocese Filter Bar */}
          <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-900/30 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
              Filtrar:
            </span>
            <button
              onClick={() => setSelectedDioceseFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedDioceseFilter === "all"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-600"
              }`}
            >
              Todas as Dioceses ({events.filter((e) => e.isDiocese).length})
            </button>
            {Array.from(
              new Set([...AVAILABLE_DIOCESES, ...(settings.customDioceses || [])])
            ).map((d) => {
              const count = events.filter(
                (e) =>
                  e.isDiocese &&
                  (e.dioceseId || "").toUpperCase() === d.toUpperCase()
              ).length;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDioceseFilter(d)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    selectedDioceseFilter === d
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-600"
                  }`}
                >
                  {d} {count > 0 && <span className="opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {eventTypeTab === "seminary" && !renderSeminary && !member && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-6 rounded-2xl text-center mb-4">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3">
            Eventos do Seminário são exclusivos para seminaristas
          </p>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-500 mb-4">
            Você precisa vincular sua identidade na aba MINHA ID para visualizar e se inscrever.
          </p>
          <button 
            onClick={() => setShowPublicReq(true)}
            className="px-4 py-2 bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold uppercase hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
          >
            Primeiro Acesso
          </button>
        </div>
      )}

      {!(eventTypeTab === "seminary" && !renderSeminary && !member) && (
        <>
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-6 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setSubTab("upcoming")}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
            subTab === "upcoming"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
          }`}
        >
          Eventos Próximos
        </button>
        <button
          onClick={() => setSubTab("past")}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${
            subTab === "past"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md transform scale-[1.02]"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
          }`}
        >
          Eventos Encerrados
        </button>
      </div>

      <div className="space-y-4">
        {filteredEvents.filter(e => {
            const computedState = getEventComputedState(e);
            return subTab === "upcoming" ? computedState !== "past" : computedState === "past";
        }).length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center border border-slate-200 dark:border-slate-700">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Nenhum evento {subTab === "upcoming" ? "disponível" : "encerrado"} no momento.
            </p>
          </div>
        ) : (
          filteredEvents
            .filter(e => {
                const computedState = getEventComputedState(e);
                return subTab === "upcoming" ? computedState !== "past" : computedState === "past";
            })
            .sort((a, b) => {
              if (subTab === "upcoming") {
                 const stateA = getEventComputedState(a);
                 const stateB = getEventComputedState(b);
                 
                 const getPriority = (s: string) => {
                    if (s === "in_progress") return 0;
                    if (s === "upcoming") return 1;
                    if (s === "finished_recently") return 2;
                    return 3;
                 };
                 
                 const pA = getPriority(stateA);
                 const pB = getPriority(stateB);
                 
                 if (pA !== pB) return pA - pB;
                 return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
              } else {
                 return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
              }
            })
            .map((event) => {
            const computedState = getEventComputedState(event);
            const isOnline = event.format === "online";
            const enrolled = myAttendances.find(
              (a) =>
                a.eventId === event.id && a.status !== ("cancelado" as any),
            );
            const isOpen = event.status === "aberto" && event.status !== "deleted";
            const isPastDeadline = event.registrationDeadline
              ? new Date() > new Date(event.registrationDeadline)
              : false;
            const isPaused = event.isRegistrationPaused === true;
            const isDeleted = event.status === "deleted";
            
            const canEnroll = isOpen && !isPastDeadline && !isPaused && !isDeleted;

            let cannotEnrollReason = "";
            if (isDeleted) cannotEnrollReason = "Evento Excluído";
            else if (isPaused) cannotEnrollReason = "Inscrições Pausadas";
            else if (isPastDeadline) cannotEnrollReason = "Inscrições Encerradas";
            else if (!isOpen) cannotEnrollReason = "Evento Fechado";

            return (
              <div
                id={`event-${event.id}`}
                key={event.id}
                className="bg-white dark:bg-slate-800/80 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-sky-300 dark:hover:border-sky-700 transition-colors"
              >
                {/* Event Admin Management Bar */}
                {isEventAdmin(event) && (
                  <div className="mb-4 -mt-1 p-2.5 sm:p-3 bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <span>{isAdmin || hasPrivilegedRole ? "Painel de Gestão do Evento" : "Você é o Administrador deste Evento"}</span>
                          {event.creatorName && (
                            <span className="text-[10px] font-normal text-purple-700 dark:text-purple-300">
                              (Criado por: {event.creatorName})
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-purple-700/80 dark:text-purple-400">
                          Gerencie inscritos, presenças, certificados e configurações.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Manage Attendees & Presence */}
                      <button
                        onClick={() => setAdminAttendeesEvent(event)}
                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                        title="Gerenciar inscritos, lista de chamada e presença"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Inscritos & Presença</span>
                      </button>

                      {/* Edit Event */}
                      <button
                        onClick={() => {
                          if (event.isDiocese) {
                            setDioceseEventToEdit(event);
                            setShowCreateDioceseModal(true);
                          } else {
                            setShowAdminEventModal(true);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        title="Editar dados e programação do evento"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      {/* Certificates Editor */}
                      <button
                        onClick={() => setCertificateEditorEvent({ event, type: "participant" })}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        title="Configurar modelo de certificado"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Certificado</span>
                      </button>

                      {/* Pause / Resume Registrations */}
                      <button
                        onClick={async () => {
                          try {
                            await updateEvent(event.id, {
                              isRegistrationPaused: !event.isRegistrationPaused
                            });
                            showAlert(
                              event.isRegistrationPaused
                                ? "Inscrições reabertas com sucesso!"
                                : "Inscrições pausadas com sucesso!",
                              { type: "success" }
                            );
                          } catch (e) {
                            showAlert("Erro ao alterar status das inscrições.", { type: "error" });
                          }
                        }}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all border ${
                          event.isRegistrationPaused
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        }`}
                        title={event.isRegistrationPaused ? "Reabrir inscrições" : "Pausar inscrições temporariamente"}
                      >
                        {event.isRegistrationPaused ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reabrir</span>
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Pausar</span>
                          </>
                        )}
                      </button>

                      {/* Delete / Cancel Event */}
                      <button
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            message: `Deseja realmente excluir o evento "${event.title}"? Esta ação removerá o evento do sistema.`,
                            onConfirm: async () => {
                              try {
                                await deleteEvent(event.id);
                                showAlert("Evento excluído com sucesso!", { type: "success" });
                              } catch (e) {
                                showAlert("Erro ao excluir evento. Verifique suas permissões.", { type: "error" });
                              }
                            }
                          });
                        }}
                        className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-[10px] font-bold uppercase transition-all"
                        title="Excluir evento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Left Column - Dates */}
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-1 shrink-0 w-full sm:w-32 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-700/50 pb-4 sm:pb-0 sm:pr-4">
                    <div className="text-center sm:text-left">
                      <p className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">
                        Início
                      </p>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-200 leading-tight">
                        {new Date(event.startDate)
                          .toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })
                          .replace(".", "")}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {new Date(event.startDate).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {event.endDate && (
                      <>
                        <div className="hidden sm:block h-3 w-px bg-slate-200 dark:bg-slate-700 my-1 ml-1" />
                        <div className="hidden sm:block text-slate-300 dark:text-slate-600 rotate-90 sm:rotate-0 self-center">
                          |
                        </div>
                        <div className="text-center sm:text-left pt-2 sm:pt-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Término
                          </p>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-tight">
                            {new Date(event.endDate)
                              .toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })
                              .replace(".", "")}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(event.endDate).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Center Column - Details */}
                  <div className="flex-1">
                    {event.imageUrl && (
                      <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700/50 flex justify-center bg-transparent w-full max-w-sm">
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-auto object-contain rounded-xl"
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {computedState === "in_progress" ? (
                         <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 flex items-center gap-1.5 shadow-sm shadow-purple-500/10 border border-purple-200 dark:border-purple-500/30 ring-1 ring-purple-500/20 ring-offset-1 dark:ring-offset-slate-800 animate-pulse">
                           <span className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-ping relative inline-flex">
                             <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-purple-400 blur-[2px]"></span>
                           </span>
                           Em andamento
                         </span>
                      ) : computedState === "finished_recently" ? (
                         <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 flex items-center gap-1 shadow-sm shadow-amber-500/10 transition-all duration-1000">
                           Evento Finalizado
                         </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(event.status)}`}
                        >
                          {event.status}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {event.format === "online" ? (
                          <Video className="w-3 h-3" />
                        ) : event.format === "hibrido" ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {event.format === "hibrido" ? "Híbrido" : event.format}
                      </span>
                      {event.isDiocese && (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Church className="w-3 h-3" /> Diocese: {event.dioceseId || "Geral"}
                        </span>
                      )}
                      {event.isPublic && (
                        <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Globe className="w-3 h-3" /> Público
                        </span>
                      )}
                      {event.creatorName && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <User className="w-3 h-3" /> Criado por: {event.creatorName}
                        </span>
                      )}
                      {event.isSeminary && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Seminário{event.seminaryId ? `: ${event.seminaryId}` : ""}
                        </span>
                      )}
                      {event.isPinned && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <Pin className="w-3 h-3" /> Fixado
                        </span>
                      )}
                    </div>
                    <h3 
                      onClick={() => {
                        if (!enrolled && canEnroll) {
                          setQuickEnrollEvent(event);
                        }
                      }}
                      className={`text-lg font-black text-slate-800 dark:text-slate-100 mb-2 ${
                        !enrolled && canEnroll ? "cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors" : ""
                      }`}
                    >
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 whitespace-pre-wrap">
                      {event.description.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                        if (part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/)) {
                          const href = part.startsWith("http") ? part : `https://${part}`;
                          return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-600 hover:underline">{part}</a>;
                        }
                        return part;
                      })}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 inline-flex px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {event.hours ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />{" "}
                          {event.hours}h
                        </span>
                      ) : null}
                      {(event.location || event.locationOrLink) && (
                        <span
                          className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[200px]"
                          title={event.location || event.locationOrLink}
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-500" />{" "}
                          {(event.location || event.locationOrLink)?.startsWith("http") || (event.location || event.locationOrLink)?.startsWith("www.") ? (
                            <span className="truncate">Link do Evento</span>
                          ) : (
                            <span className="truncate">{event.location || event.locationOrLink}</span>
                          )}
                        </span>
                      )}
                      {event.speaker && (
                        <span
                          className="flex items-center gap-1.5"
                          title={event.speaker}
                        >
                          <User className="w-3.5 h-3.5 text-indigo-500" />{" "}
                          {event.speaker}
                        </span>
                      )}
                    </div>
                    
                    {/* Event Links Section */}
                    {(event.schedulePdfUrl || event.link || event.locationOrLink) && (
                      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 text-xs font-bold uppercase mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                        {event.schedulePdfUrl && (
                          <>
                            <a
                              href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <Download className="w-4 h-4" /> Baixar Material
                            </a>
                            <a
                              href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <ExternalLink className="w-4 h-4" /> Abrir Link Material
                            </a>
                          </>
                        )}
                        {(event.link || (event.locationOrLink && (event.locationOrLink.startsWith("http") || event.locationOrLink.startsWith("www.")))) && (
                          <a
                            href={event.link ? (event.link.startsWith("http") ? event.link : `https://${event.link}`) : (event.locationOrLink?.startsWith("http") ? event.locationOrLink : `https://${event.locationOrLink}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                          >
                            <Video className="w-4 h-4" /> {event.format === "presencial" ? "Acessar Conteúdo (Formulário)" : "Acessar Link do Evento"}
                          </a>
                        )}
                      </div>
                    )}
                    
                    {/* Botão de Adicionar ao Calendário e Compartilhar */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => exportToCalendar(event)}
                        className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm w-max"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> Calendário
                      </button>

                      <button
                        onClick={() => {
                          const baseUrl = settings.url?.trim()
                            ? settings.url.trim().replace(/\/$/, "")
                            : DEFAULT_PUBLIC_URL;
                          const url = `${baseUrl}/?event=${encodeURIComponent(event.id)}`;
                          const shareMsg = `*${event.title}*\n${event.speaker ? `👤 Convidado: ${event.speaker}\n` : ''}📅 Data: ${new Date(event.startDate).toLocaleDateString('pt-BR')}\n📍 Formato: ${event.format === 'online' ? 'Online' : 'Presencial'}\n\n👉 Acesse e participe:\n${url}`;
                          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`;
                          window.open(waUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex items-center justify-center sm:justify-start gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm w-max cursor-pointer"
                        title="Compartilhar no WhatsApp com foto e dados"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      
                      <button
                        onClick={async () => {
                          const baseUrl = settings.url?.trim()
                            ? settings.url.trim().replace(/\/$/, "")
                            : DEFAULT_PUBLIC_URL;
                          const url = `${baseUrl}/?event=${encodeURIComponent(event.id)}`;
                          if (navigator.share) {
                            try {
                              const shareData: ShareData = {
                                title: event.title,
                                text: `Confira o evento acadêmico: ${event.title}\n${event.speaker ? `👤 Convidado: ${event.speaker}\n` : ''}${url}`,
                                url,
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
                                  console.log("Could not attach image to share:", imgErr);
                                }
                              }

                              await navigator.share(shareData);
                            } catch (err: any) {
                              if (err?.name !== "AbortError") {
                                await navigator.clipboard.writeText(url);
                                showAlert("Link do evento copiado para a área de transferência!", { type: 'success' });
                              }
                            }
                          } else {
                            await navigator.clipboard.writeText(url);
                            showAlert("Link do evento copiado para a área de transferência!", { type: 'success' });
                          }
                        }}
                        className="flex items-center justify-center sm:justify-start gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm w-max cursor-pointer"
                        title="Compartilhar com Foto nas Redes Sociais"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Compartilhar
                      </button>

                      <button
                        onClick={() => setSelectedQrEvent(event)}
                        className="flex items-center justify-center sm:justify-start gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm w-max cursor-pointer"
                        title="Gerar Cartaz com Foto e QR Code para Impressão"
                      >
                        <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>Cartaz / QR Code</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column - Action */}
                  <div className="sm:w-32 flex flex-col justify-end pt-4 sm:pt-0 mt-2 sm:mt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                    <button
                      onClick={() => setViewPublicAttendeesEvent(event)}
                      className="w-full py-1.5 mb-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Ver Inscritos
                    </button>
                    {enrolled ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-center">
                          <UserCheck className="w-5 h-5 text-emerald-500 mb-1" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
                            {enrolled.status === "presente" || enrolled.status === "apto_para_certificado" ? "Participou" : "Inscrito"}
                          </span>
                        </div>
                        {isPresenceOpen(event) && enrolled.status !== "presente" && enrolled.status !== "apto_para_certificado" && (
                          <button
                            onClick={() => handleRegisterPresence(event.id)}
                            disabled={isEnrollingInProgress === event.id}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" /> Registrar Presença
                          </button>
                        )}
                        {!isPresenceOpen(event) && getPresenceCountdown(event) !== null && enrolled.status !== "presente" && enrolled.status !== "apto_para_certificado" && (
                          <div className="flex items-center justify-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500 uppercase text-center border border-slate-200 dark:border-slate-700">
                            <Clock className="w-3 h-3" />
                            Abertura em breve
                          </div>
                        )}
                        {event.isPaid && event.hotmartLink && isOpen && (
                          <a
                            href={event.hotmartLink.startsWith("http") ? event.hotmartLink : `https://${event.hotmartLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center text-center"
                          >
                            Pagar (Hotmart)
                          </a>
                        )}
                        {isOpen && !isDeleted && (
                          <button
                            onClick={() => handleUnenroll(event.id, member.id)}
                            className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-500/20"
                          >
                            <Ban className="w-3 h-3" /> Cancelar
                          </button>
                        )}
                      </div>
                    ) : canEnroll ? (
                      <div className="flex flex-col gap-2 h-full justify-center">
                        {event.isPaid ? (
                          <button
                            onClick={() => setPaymentModalEvent(event)}
                            className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-all flex items-center justify-center text-center px-2 py-2 shadow-sm"
                          >
                            Inscrição - R$ {(event.price || 0).toFixed(2).replace('.', ',')}
                          </button>
                        ) : (
                            <button
                              onClick={() => handleEnroll(event.id)}
                              disabled={isEnrollingInProgress === event.id}
                              className={`w-full min-h-[36px] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center cursor-pointer ${
                                isEnrollingInProgress === event.id
                                  ? "bg-slate-400 opacity-70 cursor-not-allowed scale-100"
                                  : event.googleFormsLink ? "bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 hover:shadow-md min-h-[44px] text-[11px]" : "bg-sky-600 hover:bg-sky-500 hover:scale-105 active:scale-95 hover:shadow-md"
                              }`}
                            >
                              {isEnrollingInProgress === event.id
                                ? "Aguarde..."
                                : event.googleFormsLink 
                                  ? "Inscrição Gratuita (Forms)" 
                                  : "Inscrever-me"}
                            </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 sm:px-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center h-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-balance leading-tight">
                          {cannotEnrollReason || "Encerrado"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      <Modal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title="Cancelar Inscrição"
        confirmLabel="Confirmar"
        confirmVariant="danger"
        onConfirm={confirmModal?.onConfirm}
      >
        <p className="text-slate-600 dark:text-slate-400">
          {confirmModal?.message}
        </p>
      </Modal>

      <Modal
        isOpen={!!paymentModalEvent}
        onClose={() => setPaymentModalEvent(null)}
        title={`Inscrição: ${paymentModalEvent?.title || ''}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl border border-orange-100 dark:border-orange-800/50">
            <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-2">1. Realize o Pagamento</h4>
            <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
              Para confirmar sua inscrição, clique no botão abaixo para efetuar o pagamento via Hotmart.
            </p>
            {paymentModalEvent?.hotmartLink && (
              <div className="flex justify-center">
                <a
                  href={paymentModalEvent.hotmartLink.startsWith("http") ? paymentModalEvent.hotmartLink : `https://${paymentModalEvent.hotmartLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-[#e43a19] hover:bg-[#c23115] text-white rounded-xl text-sm font-bold shadow-md transition-colors w-full text-center"
                >
                  Pagar no Hotmart (R$ {paymentModalEvent.price?.toFixed(2)})
                </a>
              </div>
            )}
            {!paymentModalEvent?.hotmartLink && (
              <p className="text-sm text-red-500 font-bold">Link de pagamento não configurado.</p>
            )}
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <h4 className="font-bold text-emerald-800 dark:text-emerald-200 mb-2">2. Confirme a Inscrição</h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
              Após finalizar o pagamento ou caso já tenha efetuado, clique no botão abaixo para registrar sua inscrição no sistema.
            </p>
            <button
              onClick={() => {
                if (paymentModalEvent) {
                  handleEnroll(paymentModalEvent.id);
                  setPaymentModalEvent(null);
                }
              }}
              disabled={isEnrollingInProgress === paymentModalEvent?.id}
              className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-colors ${
                isEnrollingInProgress === paymentModalEvent?.id
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {isEnrollingInProgress === paymentModalEvent?.id ? "Confirmando..." : "Confirmar Inscrição"}
            </button>
          </div>
        </div>
      </Modal>

      {selectedQrEvent && (
        <EventQrCodeModal
          event={selectedQrEvent}
          onClose={() => setSelectedQrEvent(null)}
        />
      )}

      {quickEnrollEvent && (
        <QuickEventEnrollModal
          event={quickEnrollEvent}
          onClose={() => setQuickEnrollEvent(null)}
          onSuccess={(createdMember) => {
            setMember(createdMember);
            setQuickEnrollEvent(null);
            showAlert("Inscrição confirmada com sucesso!", { type: 'success' });
          }}
        />
      )}

      {showPublicReq && (
        <PublicRequestModal
          onClose={() => setShowPublicReq(false)}
          onSubmitSuccess={() => {
            setShowPublicReq(false);
            setShowRegistrationSuccessModal(true);
          }}
        />
      )}

      {showRegistrationSuccessModal && (
        <RegistrationSuccessModal 
          isOpen={showRegistrationSuccessModal} 
          onClose={() => setShowRegistrationSuccessModal(false)}
        />
      )}

      {showCreateDioceseModal && (
        <CreateDioceseEventModal
          isOpen={showCreateDioceseModal}
          onClose={() => {
            setShowCreateDioceseModal(false);
            setDioceseEventToEdit(null);
          }}
          onSuccess={(newEventId) => {
            setShowCreateDioceseModal(false);
            showAlert(
              dioceseEventToEdit
                ? "Evento da Diocese atualizado com sucesso!"
                : "Evento da Diocese criado com sucesso!",
              { type: "success" }
            );
            setDioceseEventToEdit(null);
            setEventTypeTab("diocese");
          }}
          member={member}
          eventToEdit={dioceseEventToEdit}
          defaultDiocese={selectedDioceseFilter !== "all" ? selectedDioceseFilter : member?.diocese}
        />
      )}

      {adminAttendeesEvent && (
        <EventAttendeesModal
          event={adminAttendeesEvent}
          onClose={() => setAdminAttendeesEvent(null)}
        />
      )}

      {certificateEditorEvent && (
        <CertificateEditor
          event={certificateEditorEvent.event}
          type={certificateEditorEvent.type}
          onClose={() => setCertificateEditorEvent(null)}
          onSaved={() => {
            setCertificateEditorEvent(null);
            showAlert("Modelo de certificado salvo com sucesso!", { type: "success" });
          }}
        />
      )}

      {checkInEvent && (
        <EventCheckInModal
          event={checkInEvent}
          currentMember={member}
          onClose={() => setCheckInEvent(null)}
          onSuccess={() => {
            // Success callback
          }}
        />
      )}
    </div>
  );
}
