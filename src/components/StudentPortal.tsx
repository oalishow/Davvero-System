import React, { useState, useEffect, memo, useRef, useMemo, lazy, Suspense } from "react";
import {
  User,
  CreditCard,
  QrCode,
  LogOut,
  Loader2,
  ShieldCheck,
  CheckCircle,
  History,
  Lock,
  KeyRound,
  Clock,
  ExternalLink,
  Download,
  Video,
  GraduationCap,
  CalendarHeart,
  Trash2,
  Fingerprint,
  Library,
  Bell,
  BellRing,
  Eye,
  Award,
  Mail,
  MailCheck,
  MailX,
  AlertTriangle,
} from "lucide-react";
import { isEventCertificateReleased, getDefaultCertificateTemplate, resolveCertificateReleaseDate } from "../lib/certificateAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db, appId, enrollStudent, loginAnon, auth } from "../lib/firebase";
import type { Member, Event, Attendance, CertificateTemplate } from "../types";
import VerificationResult from "./VerificationResult";
import StudentSecurityGate from "./student/StudentSecurityGate";
import StudentCardTab from "./student/StudentCardTab";
import StudentEventsTab from "./student/StudentEventsTab";
import StudentCertificatesTab from "./student/StudentCertificatesTab";
import AsyncCertificateRenderer from "./student/AsyncCertificateRenderer";
import CertificatePreviewModal from "./student/CertificatePreviewModal";
import useStudentBiometrics from "./student/useStudentBiometrics";
import StudentPortalHeader, { StudentTabType } from "./student/StudentPortalHeader";
import StudentAccountTab from "./student/StudentAccountTab";
import StudentAcademicTab from "./student/StudentAcademicTab";
import StudentLibraryTab from "./student/StudentLibraryTab";
import StudentSeminaryTab from "./student/StudentSeminaryTab";
import Modal from "./Modal";
import PublicRequestModal from "./PublicRequestModal";
import RegistrationSuccessModal from "./RegistrationSuccessModal";
import ApprovalSuccessModal from "./ApprovalSuccessModal";
import DownloadSuccessModal from "./student/DownloadSuccessModal";
import SuggestEditModal from "./SuggestEditModal";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import TermsOfUseModal from "./TermsOfUseModal";
import HomePollsWidget from "./HomePollsWidget";
import { playSound } from '../lib/sounds';
import { isWebAuthnSupported, registerBiometric, verifyBiometric, cancelBiometric, checkBiometricAvailability } from "../lib/webauthn";
import { compressOriginalImage } from "../lib/cropUtils";

const STUDENT_BOND_KEY = "davveroId_student_identity";
const STUDENT_TRACK_KEY = "davveroId_student_track_ra";
const STUDENT_FALLBACK_PIN = "student_fallback_pin";

interface StudentPortalProps {
  overrideCode?: string | null;
  onOverrideConsumed?: () => void;
}

const StudentPortal = memo(function StudentPortal({
  overrideCode,
  onOverrideConsumed,
}: StudentPortalProps) {
  const { settings } = useSettings();
  const { showAlert, showConfirm } = useDialog();
  const { isOnline } = useOnlineStatus();
  const { isSupported, subscription, permission, isSubscribing, lastError, subscribe, unsubscribe } = usePushNotifications();
  const [bondedId, setBondedId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STUDENT_BOND_KEY) || localStorage.getItem("davveroId_student_identity");
    }
    return null;
  });
  const [member, setMember] = useState<Member | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("davveroId_cached_member") || localStorage.getItem("davvero_cached_member");
        if (cached) return JSON.parse(cached) as Member;
      } catch {}
    }
    return null;
  });
  const [expandedPortalEvents, setExpandedPortalEvents] = useState<Record<string, boolean>>({});
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window !== "undefined") {
      // Exige autenticação a cada abertura do aplicativo (somente desbloqueado se autenticado na sessão ativa)
      return sessionStorage.getItem("davveroId_unlocked") === "true";
    }
    return false;
  });

  // Garante que o fechamento da janela/app ou inatividade em segundo plano no celular bloqueie a MINHA ID
  useEffect(() => {
    let backgroundedAt = 0;

    const handleWindowUnload = () => {
      try {
        sessionStorage.removeItem("davveroId_unlocked");
      } catch (_) {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        backgroundedAt = Date.now();
      } else if (document.visibilityState === "visible") {
        // Se ficou em segundo plano / celular bloqueado por mais de 2 minutos, tranca novamente por segurança
        if (backgroundedAt > 0 && Date.now() - backgroundedAt > 2 * 60 * 1000) {
          try {
            sessionStorage.removeItem("davveroId_unlocked");
          } catch (_) {}
          setIsUnlocked(false);
          const hasPin = typeof localStorage !== "undefined" && !!localStorage.getItem(STUDENT_FALLBACK_PIN);
          setPinMode(hasPin ? "verify" : "none");
        }
        backgroundedAt = 0;
      }
    };

    window.addEventListener("pagehide", handleWindowUnload);
    window.addEventListener("beforeunload", handleWindowUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handleWindowUnload);
      window.removeEventListener("beforeunload", handleWindowUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleTogglePush = async () => {
    if (subscription) {
      const ok = await unsubscribe();
      if (ok) {
        await showAlert("Notificações Desativadas", "Este dispositivo não receberá mais comunicados push.");
      }
    } else {
      const sub = await subscribe();
      if (sub) {
        await showAlert("Notificações Ativadas com Sucesso!", "Seu aparelho agora está conectado para receber avisos urgentes e comunicados da secretaria.");
      } else {
        const isIOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
        const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

        if (typeof window !== "undefined" && window.self !== window.top) {
          await showAlert("Visualização em Prévia (Janela Embutida)", "Para ativar as notificações push do seu navegador, abra o aplicativo em uma nova aba fora do modo de pré-visualização.");
        } else if (isIOS && !isStandalone) {
          await showAlert("Instalação no iPhone Necessária", "No iPhone (iOS), para ativar notificações você precisa instalar o app na Tela de Início: toque no botão Compartilhar (quadrado com seta) do Safari e escolha 'Adicionar à Tela de Início'.");
        } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          await showAlert("Permissão Bloqueada no Navegador", "Você bloqueou as notificações para este site no seu celular. No topo do navegador (ao lado do link do site), toque no ícone de cadeado/opções 🔒 e altere 'Notificações' para 'Permitir'.");
        } else if (lastError) {
          await showAlert(lastError.title, `${lastError.message}\n\n${lastError.resolution}`);
        } else {
          await showAlert("Permissão do Navegador", "Para receber avisos, toque em 'Permitir' quando o navegador solicitar ou libere as notificações nas configurações do seu celular.");
        }
      }
    }
  };

  // Update sessionStorage whenever isUnlocked changes
  useEffect(() => {
    if (isUnlocked) {
      sessionStorage.setItem("davveroId_unlocked", "true");
    } else {
      sessionStorage.removeItem("davveroId_unlocked");
    }
  }, [isUnlocked]);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkMode, setLinkMode] = useState(false);
  const [alphaCode, setAlphaCode] = useState("");
  const [isPrePinAnimation, setIsPrePinAnimation] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalIframeBiometric, setModalIframeBiometric] = useState(false);
  const [pendingCertTarget, setPendingCertTarget] = useState<{
    eventId: string;
    type: "participant" | "organizer";
  } | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const eventId = params.get("eventId") || params.get("certEvent");
      const isCertAction =
        params.get("tab") === "certificates" ||
        params.get("tab") === "certificados" ||
        params.get("view") === "certificates" ||
        params.has("certType") ||
        params.has("certEvent");
      const certType =
        params.get("certType") === "organizer" || params.get("type") === "organizer"
          ? "organizer"
          : "participant";
      if (eventId && (isCertAction || params.has("certType") || params.has("eventId"))) {
        const target = { eventId, type: certType as "participant" | "organizer" };
        try {
          sessionStorage.setItem("pending_cert_action", JSON.stringify(target));
        } catch {}
        return target;
      }
      const saved = sessionStorage.getItem("pending_cert_action");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<"id" | "events" | "certificates" | "academic" | "appointments" | "seminary_events" | "liturgy" | "account" | "biblioteca">(() => {
    if (typeof window !== "undefined") {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return "id";
      }
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("tab") === "certificates" ||
        params.get("tab") === "certificados" ||
        params.get("view") === "certificates" ||
        params.has("certEvent") ||
        (params.has("eventId") && params.has("certType"))
      ) {
        return "certificates";
      }
      const saved = sessionStorage.getItem("student_target_tab");
      if (saved) {
        sessionStorage.removeItem("student_target_tab");
        return saved as any;
      }
    }
    return "id";
  });

  useEffect(() => {
    const handleOpenStudentTab = (e: any) => {
      if (e.detail?.tab) {
        if (typeof navigator !== "undefined" && !navigator.onLine && e.detail.tab !== "id" && e.detail.tab !== "certificates") {
          return;
        }
        setActiveTab(e.detail.tab);
        if (e.detail.tab === "id") {
          scrollToCard();
        }
      }
    };
    window.addEventListener("openStudentTab", handleOpenStudentTab);
    return () => window.removeEventListener("openStudentTab", handleOpenStudentTab);
  }, []);

  // Força a aba em "id" ou "certificates" quando offline (demais abas necessitam de sincronização em tempo real)
  useEffect(() => {
    if (!isOnline && activeTab !== "id" && activeTab !== "certificates") {
      setActiveTab("id");
    }
  }, [isOnline, activeTab]);
  const [eventsSubTab, setEventsSubTab] = useState<"upcoming" | "past">(
    "upcoming",
  );

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);
  const [modalPinReset, setModalPinReset] = useState(false);
  const [modalDNEOpen, setModalDNEOpen] = useState(false);
  const [showAccountEditModal, setShowAccountEditModal] = useState(false);
  const [showPublicReq, setShowPublicReq] = useState(false);
  const [showRegisterTypeSelection, setShowRegisterTypeSelection] = useState(false);
  const [showVisitorRegisterModal, setShowVisitorRegisterModal] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorCPF, setVisitorCPF] = useState("");
  const [visitorRegistering, setVisitorRegistering] = useState(false);
  const [showRegistrationSuccessModal, setShowRegistrationSuccessModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [previewCertEvent, setPreviewCertEvent] = useState<{
    event: Event;
    type: "participant" | "organizer";
  } | null>(null);

  // Estados para organização e filtragem por semestre de certificados
  const [certSearchTerm, setCertSearchTerm] = useState("");
  const [certSemesterFilter, setCertSemesterFilter] = useState<string>("all");
  const [certTypeFilter, setCertTypeFilter] = useState<"all" | "participant" | "organizer">("all");

  // Estado para Modal de Sucesso de Download com abertura direta para celular
  const [isDownloadSuccessOpen, setIsDownloadSuccessOpen] = useState(false);
  const [downloadedCertInfo, setDownloadedCertInfo] = useState<{
    fileName: string;
    pdfBlob: Blob | null;
    eventTitle?: string;
    studentName?: string;
    certCode?: string;
  } | null>(null);

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const scrollToCard = () => {
    if (typeof window === 'undefined') return;
    const performScroll = () => {
      const targetElement = cardRef.current || document.getElementById('student-carteirinha-container');
      if (targetElement) {
        // Obter posição exata com offset confortável abaixo do menu fixo / cabeçalho
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 16;
        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: 'smooth'
        });
      }
    };

    // Executa em múltiplos frames para acomodar carregamentos assíncronos e renderizações do DOM
    performScroll();
    setTimeout(performScroll, 50);
    setTimeout(performScroll, 150);
    setTimeout(performScroll, 350);
  };

  // Fallback PIN state
  const [pinMode, setPinMode] = useState<"create" | "verify" | "none">(() => {
    if (typeof window !== "undefined") {
      const isAlreadyUnlocked = sessionStorage.getItem("davveroId_unlocked") === "true";
      if (isAlreadyUnlocked) return "none";
      const hasPin = !!localStorage.getItem(STUDENT_FALLBACK_PIN);
      return hasPin ? "verify" : "none";
    }
    return "none";
  });
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [resetCodeStr, setResetCodeStr] = useState("");

  // Check for approval
  useEffect(() => {
    if (member && member.isApproved && member.isActive && isUnlocked && pinMode === "none" && !isPrePinAnimation) {
      const notifiedKey = `davvero_approval_notified_${member.id}`;
      // Basic check to see if another primary modal (WelcomeModal) isn't overlapping
      const hasSeenWelcome = localStorage.getItem("has_seen_welcome") === "true";
      if (localStorage.getItem(notifiedKey) !== "true" && hasSeenWelcome) {
         // Also verify they aren't looking at terms of use or changelog
         if (!document.querySelector('.modal-overlay')) {
            setShowApprovalModal(true);
         }
      }
    }
  }, [member, isUnlocked, pinMode, isPrePinAnimation]);

  const hasAutoScrolled = useRef(false);

  useEffect(() => {
    if (isUnlocked && !isLoading && !isPrePinAnimation && bondedId && pinMode === "none" && activeTab === "id") {
      scrollToCard();
    }
  }, [isUnlocked, isLoading, isPrePinAnimation, bondedId, pinMode, activeTab]);

  const handleApprovalModalClose = () => {
    if (member?.id) {
       localStorage.setItem(`davvero_approval_notified_${member.id}`, "true");
    }
    setShowApprovalModal(false);
  };

  const [trackMode, setTrackMode] = useState(false);
  const [trackRa, setTrackRa] = useState("");
  const [trackStatusResult, setTrackStatusResult] = useState<{
    status: "APPROVED" | "PENDING" | "REJECTED" | "NOT_FOUND" | "INACTIVE";
    msg: string;
    name?: string;
  } | null>(null);

  const [allEvents, setAllEvents] = useState<Event[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("davveroId_cached_events");
        if (cached) return JSON.parse(cached) as Event[];
      } catch {}
    }
    return [];
  });
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [seminaryAvailableEvents, setSeminaryAvailableEvents] = useState<Event[]>([]);
  const [seminaryPastEvents, setSeminaryPastEvents] = useState<Event[]>([]);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedMem = localStorage.getItem("davveroId_cached_member");
        const memId = cachedMem ? JSON.parse(cachedMem)?.id : null;
        if (memId) {
          const cachedAtts = localStorage.getItem(`davveroId_cached_attendances_${memId}`);
          if (cachedAtts) return JSON.parse(cachedAtts) as Attendance[];
        }
      } catch {}
    }
    return [];
  });
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [downloadingCertKey, setDownloadingCertKey] = useState<string | null>(null);
  const isDownloading = Boolean(downloadingCertKey);

  // Garantir sessão anônima ativa do Firebase para leitura contínua de presenças e eventos (apenas online)
  useEffect(() => {
    if (!isOnline) return;
    if (!auth.currentUser) {
      loginAnon().catch((e) => console.warn("Notice loginAnon:", e));
    }
  }, [isOnline]);

  useEffect(() => {
    let unsubEvents: any;
    let unsubAttendances: any;
    let unsubCerts: any;
    if (member && isOnline) {
      const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
      unsubEvents = onSnapshot(qEvents, (snap) => {
        let evts = snap.docs.map((d) => {
          const e = d.data() as Event;
          const now = new Date().getTime();
          if (e.status === "aberto") {
            const checkDate = e.endDate ? new Date(e.endDate).getTime() : new Date(e.startDate).getTime();
            const GRACE_PERIOD = 24 * 60 * 60 * 1000; // 1 day
            if (checkDate + GRACE_PERIOD < now) {
               return { ...e, status: "encerrado" as any };
            }
          }
          return e;
        });
        evts = evts.filter((e) => e.status !== "deleted");
        const now = new Date().getTime();
        evts.sort((a, b) => {
          const timeA = new Date(a.startDate).getTime();
          const timeB = new Date(b.startDate).getTime();
          const aIsFuture = timeA >= now;
          const bIsFuture = timeB >= now;
          if (aIsFuture && bIsFuture) return timeA - timeB;
          if (!aIsFuture && !bIsFuture) return timeB - timeA;
          return aIsFuture ? -1 : 1;
        });
        setAllEvents(evts);
        try {
          localStorage.setItem("davveroId_cached_events", JSON.stringify(evts));
        } catch {}
        const hasPrivilegedRole = member.roles?.some(r => ["ADMIN", "COORDENADOR", "GERENTE", "REITOR", "VICE-REITOR", "DIRETOR ESPIRITUAL", "PADRE"].includes(r.toUpperCase()));

        const isCopa = (e: Event) => {
          const t = (e.title || "").toUpperCase();
          return t.includes("COPA JOÃO PAULO") || t.includes("COPA JOAO PAULO");
        };

        // Eventos acadêmicos gerais: inclui eventos acadêmicos gerais e eventos conjuntos como Copa João Paulo II
        setAvailableEvents(evts.filter((e) => e.status === "aberto" && !e.isDiocese && !e.dioceseId && (e as any).category !== "diocese" && (e as any).type !== "diocese" && (!e.isSeminary || e.isPublic || isCopa(e))));
        setPastEvents(evts.filter((e) => e.status === "encerrado" && !e.isDiocese && !e.dioceseId && (e as any).category !== "diocese" && (e as any).type !== "diocese" && (!e.isSeminary || e.isPublic || isCopa(e))));
        setSeminaryAvailableEvents(evts.filter((e) => e.status === "aberto" && (e.isSeminary || isCopa(e)) && (!e.seminaryId || e.seminaryId === member.seminary || hasPrivilegedRole)));
        setSeminaryPastEvents(evts.filter((e) => e.status === "encerrado" && (e.isSeminary || isCopa(e)) && (!e.seminaryId || e.seminaryId === member.seminary || hasPrivilegedRole)));
      }, (err) => {
        console.warn("Notice in StudentPortal events listener:", err?.message || err);
      });

      // Mapear todos os possíveis identificadores do membro (ID do doc, alphaCode, RA, etc.)
      const studentIdsToQuery = Array.from(
        new Set([
          member.id,
          member.alphaCode,
          (member as any).legacyId,
          (member as any).ra,
        ].filter(Boolean) as string[])
      );

      const qAttendances = studentIdsToQuery.length > 1
        ? query(
            collection(db, `artifacts/${appId}/public/data/attendances`),
            where("studentId", "in", studentIdsToQuery.slice(0, 10))
          )
        : query(
            collection(db, `artifacts/${appId}/public/data/attendances`),
            where("studentId", "==", member.id)
          );

      unsubAttendances = onSnapshot(qAttendances, (snap) => {
        const list = snap.docs.map(d => d.data() as Attendance);
        setMyAttendances((prev) => {
          const merged = [...list];
          // Manter qualquer registro de certificado vindo da coleção certificates
          prev.forEach((p) => {
            if (p.id?.startsWith("cert_") && !merged.some((m) => m.eventId === p.eventId)) {
              merged.push(p);
            }
          });
          try {
            localStorage.setItem(`davveroId_cached_attendances_${member.id}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }, (err) => {
        console.warn("Notice in StudentPortal attendances listener:", err?.message || err);
      });

      // Escutar também a coleção de certificados emitidos para resiliência máxima
      try {
        const qCerts = studentIdsToQuery.length > 1
          ? query(
              collection(db, `artifacts/${appId}/public/data/certificates`),
              where("studentId", "in", studentIdsToQuery.slice(0, 10))
            )
          : query(
              collection(db, `artifacts/${appId}/public/data/certificates`),
              where("studentId", "==", member.id)
            );

        unsubCerts = onSnapshot(qCerts, (snapCerts) => {
          const certDocs = snapCerts.docs.map((d) => d.data());
          if (certDocs.length > 0) {
            setMyAttendances((prev) => {
              const currentList = [...prev];
              let hasChanges = false;
              certDocs.forEach((c) => {
                if (c.eventId && !currentList.some((a) => a.eventId === c.eventId)) {
                  currentList.push({
                    id: `cert_${c.code || c.eventId}`,
                    eventId: c.eventId,
                    studentId: c.studentId || member.id,
                    status: "presente",
                    isOrganizer: Boolean(c.isOrganizer),
                    timestamp: c.issuedAt || new Date().toISOString(),
                  } as Attendance);
                  hasChanges = true;
                }
              });
              if (hasChanges) {
                try {
                  localStorage.setItem(`davveroId_cached_attendances_${member.id}`, JSON.stringify(currentList));
                } catch {}
                return currentList;
              }
              return prev;
            });
          }
        }, (err) => {
          console.warn("Notice in StudentPortal certificates listener:", err?.message || err);
        });
      } catch (certErr) {
        console.warn("Notice setting up certificates listener:", certErr);
      }

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubAttendances) unsubAttendances();
        if (unsubCerts) unsubCerts();
      };
    }
  }, [member?.id, isOnline]);

  useEffect(() => {
    if (member && pendingCertTarget) {
      let isMounted = true;
      const triggerPreview = (targetEv: Event) => {
        if (!isMounted) return;
        setActiveTab("certificates");
        setPreviewCertEvent({
          event: targetEv,
          type: pendingCertTarget.type
        });
        setPendingCertTarget(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_cert_action");
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("eventId");
            url.searchParams.delete("certEvent");
            url.searchParams.delete("certType");
            window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
          } catch {}
        }
      };

      if (allEvents.length > 0) {
        const found = allEvents.find(e => e.id === pendingCertTarget.eventId);
        if (found) {
          triggerPreview(found);
          return;
        }
      }

      // If not yet in allEvents list, fetch directly from Firestore
      const fetchDirectEvent = async () => {
        try {
          const evRef = doc(db, `artifacts/${appId}/public/data/events`, pendingCertTarget.eventId);
          const evSnap = await getDoc(evRef);
          if (evSnap.exists()) {
            const evData = { ...evSnap.data(), id: evSnap.id } as Event;
            triggerPreview(evData);
          }
        } catch (err) {
          console.warn("Direct event lookup failed for pending certificate", err);
        }
      };
      fetchDirectEvent();

      return () => {
        isMounted = false;
      };
    }
  }, [member, pendingCertTarget, allEvents]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("unsubscribeEmail") === "true" || params.get("unsubscribe") === "email") {
        const targetEmail = params.get("email");
        
        // Clean URL params
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("unsubscribeEmail");
          url.searchParams.delete("unsubscribe");
          url.searchParams.delete("email");
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
        } catch {}

        if (targetEmail) {
          const processUnsub = async () => {
            try {
              const q = query(
                collection(db, `artifacts/${appId}/public/data/students`),
                where("email", "==", targetEmail.trim())
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                for (const docSnap of snap.docs) {
                  await updateDoc(docSnap.ref, {
                    emailNotificationsEnabled: false,
                    emailUnsubscribedAt: new Date().toISOString()
                  });
                }
              }
              if (member && member.email?.toLowerCase().trim() === targetEmail.toLowerCase().trim()) {
                const updated = { ...member, emailNotificationsEnabled: false, emailUnsubscribedAt: new Date().toISOString() };
                setMember(updated);
                try {
                  localStorage.setItem("davvero_cached_member", JSON.stringify(updated));
                } catch {}
              }
              playSound("pop");
              showAlert(
                `Inscrição cancelada com sucesso! O e-mail (${targetEmail}) foi desativado e não receberá mais notificações automáticas de certificados e comunicados. Você pode reativá-las a qualquer momento na aba Minha Conta.`,
                { type: "info" }
              );
            } catch (e) {
              console.warn("Falha ao cancelar inscrição:", e);
            }
          };
          processUnsub();
        }
      }
    }
  }, [member]);

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return "---";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "---";
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "---";
    }
  };

  const handleEnroll = async (eventId: string) => {
    if (!member) {
      showAlert(
        "Ação Necessária: Por favor, vincule sua carteirinha ou faça login no portal 'MINHA ID' para se inscrever neste evento.",
        { type: 'warning' }
      );
      return;
    }
    setIsEnrollingInProgress(eventId);
    const safetyTimer = setTimeout(() => {
      setIsEnrollingInProgress((curr) => (curr === eventId ? null : curr));
    }, 8000);
    try {
      await enrollStudent({
        eventId,
        studentId: member.id,
        status: "inscrito",
        timestamp: new Date().toISOString(),
      });
      playSound('enroll');
    } catch (err) {
      console.error(err);
      showAlert("Erro ao realizar inscrição.", { type: 'error' });
    } finally {
      clearTimeout(safetyTimer);
      setIsEnrollingInProgress(null);
    }
  };

  const handleDownloadCertificate = async (
    event: Event,
    type: "participant" | "organizer",
  ) => {
    if (!member) return;

    setDownloadingCertKey(`${event.id}_${type}`);

    try {
      // Find the node
      const defaultNodeId = `cert-node-${type === "participant" ? "part" : "org"}-${event.id}`;
      let node = document.getElementById(defaultNodeId);
      if (!node && previewCertEvent && previewCertEvent.event.id === event.id && previewCertEvent.type === type) {
        node = document.getElementById("preview-cert-modal-node");
      }
      if (!node) {
        node = document.getElementById("preview-cert-modal-node");
      }
      if (!node) {
        throw new Error("Certificado não encontrado ou ainda em carregamento. Tente novamente.");
      }

      // Ensure all images (logos, signatures, backgrounds) inside the certificate node are fully loaded and decoded
      const imgElements = Array.from(node.querySelectorAll("img"));
      await Promise.all(
        imgElements.map((img) => {
          if (img.complete && img.naturalWidth !== 0) {
            return (img.decode ? img.decode() : Promise.resolve()).catch(() => Promise.resolve());
          }
          return new Promise<void>((resolve) => {
            const onFinish = () => {
              img.removeEventListener("load", onFinish);
              img.removeEventListener("error", onFinish);
              resolve();
            };
            img.addEventListener("load", onFinish);
            img.addEventListener("error", onFinish);
            setTimeout(onFinish, 1200); // 1.2s timeout fallback
          });
        })
      );

      // Ensure fonts and paint cycle
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      let canvas: HTMLCanvasElement;
      try {
        const { toCanvas } = await import("html-to-image");
        canvas = await toCanvas(node, {
          pixelRatio: 2,
          skipFonts: false,
          cacheBust: true,
        });
      } catch (errCanvas) {
        console.warn("toCanvas error, falling back to html2canvas", errCanvas);
        const html2canvas = (await import("html2canvas")).default;
        canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false,
        });
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(imgData, "JPEG", 0, 0, 297, 210);

      const fileName = `Certificado_${(member.name || "Aluno").replace(/\s+/g, "_")}_${(event.title || "Evento").replace(/\s+/g, "_")}.pdf`;

      // Save the file
      pdf.save(fileName);
      playSound('success');

      // Generate blob for direct viewing or sharing via DownloadSuccessModal
      try {
        const blob = pdf.output("blob");
        setDownloadedCertInfo({
          fileName,
          pdfBlob: blob,
          eventTitle: event.title,
          studentName: member.name,
          certCode: (event as any).certificateAuthCode || member.alphaCode,
        });
        setIsDownloadSuccessOpen(true);
      } catch (blobErr) {
        console.warn("Could not create blob for download modal:", blobErr);
      }
    } catch (e: any) {
      console.error("Download Error:", e);
      showAlert(
        `Erro ao gerar certificado: ${e.message || "Falha na geração do arquivo"}`,
        { type: 'error' }
      );
    } finally {
      setDownloadingCertKey(null);
    }
  };

  const [isUploadingCert, setIsUploadingCert] = useState(false);

  const handleUploadExternalCertificate = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    // Support files up to 25MB
    if (file.size > 25 * 1024 * 1024) {
      await showConfirm("O arquivo é muito grande. O limite máximo é 25MB.", { type: 'error' });
      return;
    }

    setIsUploadingCert(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let base64 = ev.target?.result as string;

        // If it's an image, compress it into an ultra-clean, compact payload (~60KB)
        if (file.type.startsWith("image/")) {
          try {
            base64 = await compressOriginalImage(base64, 1200, 0.82);
          } catch (compErr) {
            console.warn("Could not compress certificate image:", compErr);
          }
        }

        const newCert = {
          id: 'ext_cert_' + Date.now(),
          title: file.name.slice(0, 60),
          fileUrl: base64,
          uploadedAt: new Date().toISOString()
        };

        const memberRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
        const updatedCerts = [...(member.externalCertificates || []), newCert];
        
        await updateDoc(memberRef, {
          externalCertificates: updatedCerts
        });
        
        await showConfirm("Certificado anexado com sucesso!", { type: 'success' });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Erro ao anexar certificado:", error);
      await showConfirm("Ocorreu um erro ao anexar o certificado.", { type: 'error' });
    } finally {
      setIsUploadingCert(false);
      e.target.value = '';
    }
  };

  const handleDownloadExternalCertificate = (cert: { title: string; fileUrl: string }) => {
    try {
      if (!cert.fileUrl) return;

      // Handle base64 or standard URL
      if (cert.fileUrl.startsWith("data:")) {
        // Parse base64 to Blob to avoid browser blocking data URL direct navigation
        const parts = cert.fileUrl.split(";base64,");
        const contentType = parts[0].replace("data:", "");
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        const ext = contentType.includes("pdf") ? ".pdf" : contentType.includes("png") ? ".png" : ".jpg";
        const cleanTitle = (cert.title || "Certificado_Anexado").replace(/[^a-zA-Z0-9_-]/g, "_");
        a.download = cleanTitle.toLowerCase().endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } else {
        const a = document.createElement("a");
        a.href = cert.fileUrl;
        a.download = cert.title || "Certificado_Anexado";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e: any) {
      console.error("Erro ao baixar certificado anexado:", e);
      // Fallback: direct window.open
      window.open(cert.fileUrl, "_blank");
    }
  };

  const handleOpenExternalCertificate = (cert: { title: string; fileUrl: string }) => {
    try {
      if (!cert.fileUrl) return;
      if (cert.fileUrl.startsWith("data:")) {
        const parts = cert.fileUrl.split(";base64,");
        const contentType = parts[0].replace("data:", "");
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      } else {
        window.open(cert.fileUrl, "_blank");
      }
    } catch (e) {
      window.open(cert.fileUrl, "_blank");
    }
  };

  const handleDeleteExternalCertificate = async (certId: string) => {
    if (!member) return;
    
    if (await showConfirm("Tem certeza de que deseja excluir este certificado anexado?", { type: 'warning' })) {
      try {
        const memberRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
        const updatedCerts = (member.externalCertificates || []).filter(c => c.id !== certId);
        
        await updateDoc(memberRef, {
          externalCertificates: updatedCerts
        });
      } catch (error) {
        console.error("Erro ao excluir certificado:", error);
        await showConfirm("Ocorreu um erro ao excluir o certificado.", { type: 'error' });
      }
    }
  };

  useEffect(() => {
    if (bondedId && !member) {
      loadBondedMember(bondedId);
    }
  }, []);

  useEffect(() => {
    if (overrideCode && overrideCode !== member?.alphaCode) {
      loadBondedMember(overrideCode, true);
    }
  }, [overrideCode]);



  const loadBondedMember = async (id: string, isOverride = false) => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      if (!member) {
        try {
          const cached = localStorage.getItem("davveroId_cached_member") || localStorage.getItem("davvero_cached_member");
          if (cached) {
            setMember(JSON.parse(cached));
          }
        } catch {}
      }
      return;
    }

    // Apenas ativa a tela de carregamento bloqueante se NÃO tivermos os dados do membro em cache
    if (!member && !isOverride) {
      setIsLoading(true);
    }
    try {
      const dbRef = collection(db, `artifacts/${appId}/public/data/students`);
      
      // Try to fetch by doc.id first
      let foundMemberLocal: any = null;
      let foundDocId = "";
      
      try {
        const docRef = doc(db, `artifacts/${appId}/public/data/students`, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
           foundMemberLocal = docSnap.data();
           foundDocId = docSnap.id;
        }
      } catch (e) {
         // Ignore potential invalid doc id errors
      }

      if (!foundMemberLocal) {
        // Fallback to alphaCode search
        const q = query(dbRef, where("alphaCode", "==", id), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          foundMemberLocal = docSnap.data();
          foundDocId = docSnap.id;
        }
      }

      if (foundMemberLocal) {
        const fullMember = { ...foundMemberLocal, id: foundDocId } as Member;
        setMember(fullMember);
        try {
          localStorage.setItem("davveroId_cached_member", JSON.stringify(fullMember));
          localStorage.setItem("davvero_cached_member", JSON.stringify(fullMember));
        } catch {}
        if (isOverride) {
          setIsOverrideMode(true);
          setBondedId(id);
          setIsUnlocked(true);
          onOverrideConsumed?.();
        } else {
          // Exige autenticação por sessão: só desbloqueia se já tiver sido autenticado nesta sessão ativa
          const isAlreadyUnlockedInSession = sessionStorage.getItem("davveroId_unlocked") === "true";
          if (!isAlreadyUnlockedInSession) {
            setIsUnlocked(false);
            const hasPin = typeof localStorage !== "undefined" && !!localStorage.getItem(STUDENT_FALLBACK_PIN);
            setPinMode(hasPin ? "verify" : "none");
          } else {
            setIsUnlocked(true);
          }
        }
      } else {
        // Só desvincula se houver conexão ativa confirmando que a identidade não existe
        if (typeof navigator !== "undefined" && navigator.onLine) {
          setError("Identidade vinculada não encontrada.");
          if (!isOverride) {
            localStorage.removeItem(STUDENT_BOND_KEY);
            setBondedId(null);
          }
        }
      }
    } catch (err) {
      console.error(err);
      if (!member) {
        setError("Erro ao carregar sua identidade.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!bondedId) return;
    let isCancelled = false;
    let unsubListener: (() => void) | null = null;
    
    // First figure out if bondedId is a doc id or alphaCode
    const listenToMember = async () => {
       if (typeof navigator !== "undefined" && !navigator.onLine) return;
       let realDocId = member?.id || bondedId;
       if (!member?.id) {
         try {
           const dSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, bondedId));
           if (isCancelled) return;
           if (!dSnap.exists()) {
               // Must be alphaCode, find the doc
               const sm = await getDocs(query(collection(db, `artifacts/${appId}/public/data/students`), where("alphaCode", "==", bondedId), limit(1)));
               if (isCancelled) return;
               if (!sm.empty) {
                  realDocId = sm.docs[0].id;
               }
           }
         } catch(e) {}
       }

       if (isCancelled) return;
       const unsub = onSnapshot(doc(db, `artifacts/${appId}/public/data/students`, realDocId), (docSnap) => {
         if (docSnap.exists()) {
           setMember(prev => {
             const m = { ...prev, ...docSnap.data(), id: docSnap.id } as Member;
             try {
               localStorage.setItem("davveroId_cached_member", JSON.stringify(m));
               localStorage.setItem("davvero_cached_member", JSON.stringify(m));
             } catch {}
             return m;
           });
         }
       }, (err) => {
         console.warn("Notice in StudentPortal member listener:", err?.message || err);
       });

       if (isCancelled) {
         unsub();
       } else {
         unsubListener = unsub;
       }
    };
    
    listenToMember();

    return () => { 
      isCancelled = true;
      if (unsubListener) unsubListener(); 
    };
  }, [bondedId]);

  const linkIdentity = async () => {
    if (!alphaCode.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const cleanInput = alphaCode.trim();
      const onlyNumbers = cleanInput.replace(/\D/g, "");
      const isCPF = /^\d{11}$/.test(onlyNumbers);

      let foundMember = null;
      const usedField = "";

      const formattedCPF = onlyNumbers.length === 11 
        ? onlyNumbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
        : "";
      const formattedRA = onlyNumbers.length === 10
        ? onlyNumbers.replace(/(\d{4})(\d{5})(\d{1})/, "$1-$2.$3")
        : "";

      // Try searching in CPF, RA and alphaCode concurrently for faster lookup
      const searchValues = Array.from(new Set([cleanInput, cleanInput.toUpperCase(), onlyNumbers, formattedCPF, formattedRA])).filter(Boolean);
      
      const qCpf = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("cpf", "in", searchValues),
      );
      const qRa = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("ra", "in", searchValues),
      );
      const qAlpha = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("alphaCode", "in", searchValues),
      );

      const [snapCpf, snapRa, snapAlpha] = await Promise.all([
        getDocs(qCpf),
        getDocs(qRa),
        getDocs(qAlpha)
      ]);

      if (!snapCpf.empty) {
        // find active / non-deleted first
        const docs = snapCpf.docs;
        const active = docs.find((d) => !d.data().deletedAt) || docs[0];
        foundMember = { id: active.id, ...active.data() };
      } else if (!snapRa.empty) {
        const docs = snapRa.docs;
        const active = docs.find((d) => !d.data().deletedAt) || docs[0];
        foundMember = { id: active.id, ...active.data() };
      } else if (!snapAlpha.empty) {
        const docs = snapAlpha.docs;
        const active = docs.find((d) => !d.data().deletedAt) || docs[0];
        foundMember = { id: active.id, ...active.data() };
      }

      if (foundMember) {
        setMember(foundMember as Member);
        const idToStore = foundMember.alphaCode || foundMember.id;
        setBondedId(idToStore);

        setIsLoading(false); // Make sure the Acessando dados loading screen disappears

        // Start PrePinAnimation with slower progression bar
        setLinkMode(false);
        setPinMode("none");
        setIsPrePinAnimation(true);
        // We will manage the loading bar in the UI during this 3000ms delay
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setIsPrePinAnimation(false);

        localStorage.setItem(STUDENT_BOND_KEY, idToStore);
        localStorage.setItem("davveroId_cached_member", JSON.stringify(foundMember));
        localStorage.setItem("davvero_cached_member", JSON.stringify(foundMember));
        if (foundMember.id) localStorage.setItem("davveroId_student_doc_id", foundMember.id);
        if (foundMember.ra) localStorage.setItem(STUDENT_TRACK_KEY, foundMember.ra);

        const hasSavedPin = typeof localStorage !== "undefined" && !!localStorage.getItem(STUDENT_FALLBACK_PIN);
        if (hasSavedPin) {
          sessionStorage.setItem("davveroId_unlocked", "true");
          setIsUnlocked(true);
          setPinMode("none");
        } else {
          // Solicita imediatamente a criação do PIN de 4 dígitos para proteger a carteirinha
          setIsUnlocked(false);
          setPinMode("create");
          setPinInput("");
          setPinConfirm("");
          setError("Crie uma senha de 4 dígitos para proteger sua carteirinha.");
        }
      } else {
        setError("Identificação não encontrada. Verifique se o Código de Segurança, CPF ou RA estão corretos.");
      }
    } catch (err) {
      setError("Erro ao vincular identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterVisitor = async () => {
    if (!visitorName.trim() || !visitorCPF.trim()) {
      showAlert("Preencha o nome e o CPF.", { type: 'warning' });
      return;
    }
    setVisitorRegistering(true);
    try {
      const { registerVisitor } = await import("../lib/firebase");
      const newMember = await registerVisitor(visitorName.trim().toUpperCase(), visitorCPF.trim());
      if (newMember?.alphaCode) {
         setAlphaCode(newMember.alphaCode);
      }
      showAlert(`Visitante cadastrado com sucesso! Seu CPF já pode ser usado para login.`, { type: 'success' });
      setVisitorName("");
      setVisitorCPF("");
      setShowVisitorRegisterModal(false);
    } catch (e: any) {
      showAlert("Erro ao cadastrar visitante: " + e.message, { type: 'error' });
    } finally {
      setVisitorRegistering(false);
    }
  };

  const handleTrackRequest = async () => {
    if (!trackRa.trim()) return;
    setIsLoading(true);
    setError(null);
    setTrackStatusResult(null);
    try {
      const searchValue = trackRa.trim();
      const onlyNumbers = searchValue.replace(/\D/g, "");
      const formattedCPF = onlyNumbers.length === 11 
        ? onlyNumbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
        : searchValue;

      const qRa = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("ra", "==", searchValue),
      );
      
      const qCpf = query(
        collection(db, `artifacts/${appId}/public/data/students`),
        where("cpf", "in", Array.from(new Set([searchValue, onlyNumbers, formattedCPF])).filter(Boolean))
      );

      const [snapRa, snapCpf] = await Promise.all([getDocs(qRa), getDocs(qCpf)]);
      
      const docs = snapRa.docs.map((d) => d.data());
      if (!snapCpf.empty) {
        const existingRas = new Set(docs.map(d => d.ra));
        snapCpf.docs.forEach(d => {
           const data = d.data();
           if (!existingRas.has(data.ra)) {
              docs.push(data);
           }
        });
      }

      if (docs.length === 0) {
        setTrackStatusResult({
          status: "NOT_FOUND",
          msg: "Nenhum pedido encontrado para este RA/CPF.",
        });
      } else {
        // Find if any is not deleted, or take the last deleted if all are
        const activeDoc = docs.find((d) => !d.deletedAt) || docs[0];

        let statusText = "";
        let statusObj: "APPROVED" | "PENDING" | "REJECTED" | "INACTIVE" =
          "PENDING";

        const now = new Date();
        // Check validity date format (YYYY-MM-DD)
        const validityDate = activeDoc.validityDate
          ? new Date(`${activeDoc.validityDate}T23:59:59`)
          : null;
        const isExpired = validityDate && validityDate < now;

        if (activeDoc.deletedAt) {
          statusObj = "REJECTED";
          statusText =
            "Seu pedido foi reprovado ou as informações eram inválidas.";
        } else if (activeDoc.isApproved === false) {
          statusObj = "PENDING";
          statusText =
            "Seu pedido está em análise. Fique de olho no seu dispositivo ou retorno da secretaria.";
        } else if (activeDoc.isActive === false || isExpired) {
          statusObj = "INACTIVE";
          statusText =
            "Sua carteirinha encontra-se vencida ou desativada no sistema. Por favor, procure a secretaria ou o seminário para regularização.";
        } else {
          statusObj = "APPROVED";
          statusText =
            "Seu pedido foi aprovado! Você já pode vincular sua carteirinha usando o código de segurança recebido via E-mail.";
        }

        setTrackStatusResult({
          status: statusObj,
          msg: statusText,
          name: activeDoc.name,
        });
        // Enable background notifications for this track request
        localStorage.setItem(STUDENT_TRACK_KEY, trackRa.trim());
      }
    } catch (err) {
      setError("Erro ao buscar status do pedido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pinMode === "create") {
      if (pinInput.length === 4) {
        if (!pinConfirm) {
          setPinConfirm(pinInput);
          setPinInput("");
          setError("Confirme o PIN");
          playSound('notification');
        } else if (pinInput === pinConfirm) {
          localStorage.setItem(STUDENT_FALLBACK_PIN, pinInput);
          setIsGenerating(true);
          playSound('generating');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          sessionStorage.setItem("davveroId_unlocked", "true");
          setIsUnlocked(true);
          setIsGenerating(false);
          setPinMode("none");
          setError(null);
          playSound('login');
          scrollToCard();
        } else {
          setError("Os PINs não coincidem");
          setPinInput("");
          setPinConfirm("");
          playSound('error');
        }
      } else {
        setError("O PIN deve ter 4 dígitos");
        playSound('error');
      }
    } else if (pinMode === "verify") {
      const savedPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
      if (pinInput === savedPin) {
        setIsGenerating(true);
        playSound('generating');
        await new Promise((resolve) => setTimeout(resolve, 800));
        sessionStorage.setItem("davveroId_unlocked", "true");
        setIsUnlocked(true);
        setIsGenerating(false);
        setPinMode("none");
        setError(null);
        setPinInput("");
        playSound('login');
        scrollToCard();
      } else {
        setError("PIN Incorreto");
        setPinInput("");
        playSound('error');
      }
    }
  };

  const {
    isBiometricAuthenticating,
    setIsBiometricAuthenticating,
    handleBiometricAuth,
    handleCancelBiometric,
  } = useStudentBiometrics({
    member,
    onSuccess: async () => {
      setIsGenerating(true);
      sessionStorage.setItem("davveroId_unlocked", "true");
      playSound('generating');
      await new Promise((r) => setTimeout(r, 600));
      setIsUnlocked(true);
      setIsGenerating(false);
      setPinMode("none");
      playSound('login');
      scrollToCard();
    },
    onError: (msg) => setError(msg),
    onOpenIframeModal: () => setModalIframeBiometric(true),
  });

  const handleUnlockScreen = () => {
    const hasPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
    if (hasPin) {
      setPinMode("verify");
    } else {
      setPinMode("create");
    }
  };

  const handlePinResetAttempt = () => {
    if (!member) return;
    const inputClean = resetCodeStr.trim().replace(/\D/g, "");
    const memberCpfClean = (member.cpf || "").replace(/\D/g, "");
    const isCodeMatch = Boolean(member.alphaCode && resetCodeStr.trim().toUpperCase() === member.alphaCode.trim().toUpperCase());
    const isCpfMatch = Boolean(memberCpfClean && inputClean.length >= 11 && inputClean === memberCpfClean);
    const isRaMatch = Boolean(member.ra && resetCodeStr.trim().toUpperCase() === member.ra.trim().toUpperCase());

    if (isCodeMatch || isCpfMatch || isRaMatch) {
      // Reset pin
      localStorage.removeItem(STUDENT_FALLBACK_PIN);
      setPinMode("create");
      setPinInput("");
      setPinConfirm("");
      setModalPinReset(false);
      setResetCodeStr("");
      setError("Identidade confirmada! Crie uma nova senha de 4 dígitos.");
    } else {
      setError("Código ou CPF não corresponde a esta carteirinha.");
      playSound('error');
    }
  };

  const handleDirectCpfUnlock = () => {
    if (!member) return;
    const inputClean = resetCodeStr.trim().replace(/\D/g, "");
    const memberCpfClean = (member.cpf || "").replace(/\D/g, "");
    const isCodeMatch = Boolean(member.alphaCode && resetCodeStr.trim().toUpperCase() === member.alphaCode.trim().toUpperCase());
    const isCpfMatch = Boolean(memberCpfClean && inputClean.length >= 11 && inputClean === memberCpfClean);
    const isRaMatch = Boolean(member.ra && resetCodeStr.trim().toUpperCase() === member.ra.trim().toUpperCase());

    if (isCodeMatch || isCpfMatch || isRaMatch) {
      sessionStorage.setItem("davveroId_unlocked", "true");
      setIsUnlocked(true);
      setPinMode("none");
      setModalPinReset(false);
      setResetCodeStr("");
      setError(null);
      playSound('login');
      scrollToCard();
    } else {
      setError("Código ou CPF não corresponde a esta carteirinha.");
      playSound('error');
    }
  };

  const clearStudentSession = () => {
    try {
      localStorage.removeItem(STUDENT_BOND_KEY);
      localStorage.removeItem(STUDENT_TRACK_KEY);
      localStorage.removeItem("davveroId_student_doc_id");
      localStorage.removeItem(STUDENT_FALLBACK_PIN);
      localStorage.removeItem("student_biometric_credential_id");
      localStorage.removeItem("davveroId_student_identity");
      localStorage.removeItem("davveroId_cached_member");
      localStorage.removeItem("davvero_cached_member");
      localStorage.removeItem("davveroId_guest_name");
      localStorage.removeItem("davveroId_guest_email");
      localStorage.removeItem("davveroId_guest_phone");
      localStorage.removeItem("davveroId_my_attendances_cache");
      sessionStorage.removeItem("davveroId_unlocked");
      window.dispatchEvent(new CustomEvent("davveroId_student_logout"));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.warn("Error clearing student session:", e);
    }
  };

  const confirmUnlink = () => {
    if (isOverrideMode) return;
    playSound('logout');
    clearStudentSession();
    setBondedId(null);
    setMember(null);
    setIsUnlocked(false);
    setModalUnlinkOpen(false);
    setPinMode("none");
    if (onOverrideConsumed) onOverrideConsumed();
    window.location.reload();
  };

  if (isLoading && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative w-full max-w-[240px]">
          <div className="absolute -inset-4 bg-sky-500/20 dark:bg-sky-500/10 rounded-[2rem] blur-xl animate-pulse z-0" />
          <div className="relative bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-sky-900/40 rounded-3xl p-6 shadow-xl shadow-sky-500/10 z-10 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                  Acessando seus dados
                </h3>
              </div>
              <div className="space-y-2">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 1.0,
                      ease: "easeInOut",
                      repeat: Infinity,
                    }}
                    className="h-full bg-sky-500 relative"
                  >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse" />
                  </motion.div>
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 tracking-wider leading-relaxed">
                  Carregando...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bondedId && member) {
    if (!isUnlocked) {
      if (isPrePinAnimation && member) {
        return (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative w-full max-w-[240px]">
              <div className="absolute -inset-4 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-[2rem] blur-xl animate-pulse z-0" />
              <div className="relative bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/40 rounded-3xl p-6 shadow-xl shadow-emerald-500/10 z-10 space-y-6">
                <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <motion.h3
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter"
                    >
                      Identidade Localizada
                    </motion.h3>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-sm text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest leading-tight"
                    >
                      {member.name.split(" ")[0]}
                    </motion.p>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="h-full bg-emerald-500 relative"
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse" />
                      </motion.div>
                    </div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider leading-relaxed"
                    >
                      Preparando ambiente seguro e{" "}
                      <br className="hidden sm:block" /> aplicando camadas de
                      segurança...
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (isGenerating) {
        return (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative">
              <motion.div
                className="w-24 h-24 rounded-3xl border-4 border-slate-100 border-t-indigo-500 animate-spin"
                style={{ borderRadius: "2rem" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <CreditCard className="w-10 h-10 text-indigo-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Gerando Documento
              </h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                Criptografando dados e<br />
                aplicando selo de autenticidade
              </p>
            </div>
            <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
              />
            </div>
          </div>
        );
      }

      return (
        <StudentSecurityGate
          member={member}
          pinMode={pinMode}
          setPinMode={setPinMode}
          pinInput={pinInput}
          setPinInput={setPinInput}
          pinConfirm={pinConfirm}
          error={error}
          setError={setError}
          handlePinSubmit={handlePinSubmit}
          isBiometricAuthenticating={isBiometricAuthenticating}
          handleBiometricAuth={handleBiometricAuth}
          cancelBiometric={handleCancelBiometric}
          setIsBiometricAuthenticating={setIsBiometricAuthenticating}
          modalPinReset={modalPinReset}
          setModalPinReset={setModalPinReset}
          resetCodeStr={resetCodeStr}
          setResetCodeStr={setResetCodeStr}
          handlePinResetAttempt={handlePinResetAttempt}
          modalUnlinkOpen={modalUnlinkOpen}
          setModalUnlinkOpen={setModalUnlinkOpen}
          confirmUnlink={confirmUnlink}
          modalIframeBiometric={modalIframeBiometric}
          setModalIframeBiometric={setModalIframeBiometric}
          handleUnlockScreen={handleUnlockScreen}
          onDirectCpfUnlock={handleDirectCpfUnlock}
        />
      );
    }

    const currentTermsVersion = settings.termsVersion || 1;
    const userTermsVersion = member?.acceptedTermsVersion || 0;
    const needsToAcceptTerms = member && !isOverrideMode && isUnlocked && userTermsVersion < currentTermsVersion;

    return (
      <>
        {needsToAcceptTerms && (
          <TermsOfUseModal 
            mustAccept={true} 
            onAccept={async () => {
               try {
                  await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, member.id), {
                     acceptedTermsVersion: currentTermsVersion
                  });
               } catch (e) {
                  console.error(e);
                  showAlert("Erro", "Não foi possível aceitar os termos. Tente novamente.");
               }
            }} 
          />
        )}
        <Modal
          isOpen={modalUnlinkOpen}
          onClose={() => setModalUnlinkOpen(false)}
          title="Sair do Portal"
          confirmLabel="Sim, Sair"
          confirmVariant="danger"
          onConfirm={confirmUnlink}
        >
          Deseja desvincular sua carteirinha deste dispositivo? Esta ação
          encerrará sua sessão segura.
        </Modal>

        <div ref={portalContainerRef} className="w-full flex flex-col items-center animate-fade-in mt-6 max-w-sm sm:max-w-[600px] mx-auto">
          <StudentPortalHeader
            member={member}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOverrideMode={isOverrideMode}
            isPushSupported={isSupported}
            pushSubscription={subscription}
            onSubscribePush={subscribe}
            onLockSecurity={() => {
              sessionStorage.removeItem("davveroId_unlocked");
              setIsUnlocked(false);
              const hasPin = typeof localStorage !== "undefined" && !!localStorage.getItem(STUDENT_FALLBACK_PIN);
              setPinMode(hasPin ? "verify" : "none");
            }}
            onOpenUnlinkModal={() => setModalUnlinkOpen(true)}
            onScrollToCard={scrollToCard}
          />

          <div className="w-full mt-2">
            {activeTab === "id" && (
              <StudentCardTab
                member={member}
                cardRef={cardRef}
                onResetSession={() => {
                  playSound('logout');
                  clearStudentSession();
                  setMember(null);
                  setBondedId(null);
                  setIsUnlocked(false);
                  setPinMode("none");
                }}
                onOpenDNE={() => setModalDNEOpen(true)}
              />
            )}

            {activeTab === "events" && (
              <StudentEventsTab
                eventsSubTab={eventsSubTab}
                setEventsSubTab={setEventsSubTab}
                availableEvents={availableEvents}
                pastEvents={pastEvents}
                myAttendances={myAttendances}
                expandedPortalEvents={expandedPortalEvents}
                setExpandedPortalEvents={setExpandedPortalEvents}
                handleEnroll={handleEnroll}
                isEnrollingInProgress={isEnrollingInProgress}
              />
            )}

            {activeTab === "certificates" && (
              <StudentCertificatesTab
                member={member}
                settings={settings}
                allEvents={allEvents}
                myAttendances={myAttendances}
                certSearchTerm={certSearchTerm}
                setCertSearchTerm={setCertSearchTerm}
                certSemesterFilter={certSemesterFilter}
                setCertSemesterFilter={setCertSemesterFilter}
                certTypeFilter={certTypeFilter}
                setCertTypeFilter={setCertTypeFilter}
                downloadingCertKey={downloadingCertKey}
                handleDownloadCertificate={handleDownloadCertificate}
                setPreviewCertEvent={setPreviewCertEvent}
                handleDownloadExternalCertificate={handleDownloadExternalCertificate}
                handleOpenExternalCertificate={handleOpenExternalCertificate}
                handleDeleteExternalCertificate={handleDeleteExternalCertificate}
                handleUploadExternalCertificate={handleUploadExternalCertificate}
                isUploadingCert={isUploadingCert}
                formatDateTime={formatDateTime}
              />
            )}

            {activeTab === "academic" && <StudentAcademicTab />}

            {activeTab === "biblioteca" && <StudentLibraryTab />}

            {activeTab === "account" && member && (
              <StudentAccountTab
                member={member}
                setMember={setMember}
                onOpenEditModal={() => setShowAccountEditModal(true)}
                isPushSupported={isSupported}
                pushSubscription={subscription}
                pushPermission={permission}
                isSubscribingPush={isSubscribing}
                onTogglePush={handleTogglePush}
              />
            )}

            {activeTab === "seminary_events" && <StudentSeminaryTab />}
          </div>
        </div>

        {showAccountEditModal && member && (
          <SuggestEditModal 
            member={member} 
            onClose={() => setShowAccountEditModal(false)}
            onSubmitSuccess={() => {
              setShowAccountEditModal(false);
              alert("A sua sugestão de alteração foi enviada. Por favor, aguarde a aprovação do administrador."); 
            }}
          />
        )}

        <Modal
          isOpen={modalDNEOpen}
          onClose={() => setModalDNEOpen(false)}
          title="Transparência: Documento Nacional"
          confirmLabel="Prosseguir para UNE"
          onConfirm={() => {
            window.open("https://www.documentodoestudante.com.br/", "_blank");
            setModalDNEOpen(false);
          }}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              O <strong>DAVVERO System</strong> é seu documento institucional
              gratuito.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Para eventos de grande porte em nível nacional que exijam
              certificação digital <strong>ICP-Brasil</strong>, você pode
              solicitar a emissão física por uma entidade parceira como a UNE.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-widest mb-1">
                Nota Legal
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-500 leading-tight">
                Você será redirecionado para o site oficial do Documento do
                Estudante (Padrão ITI).
              </p>
            </div>
          </div>
        </Modal>

        {/* Certificate Preview Modal */}
        {previewCertEvent && member && (
          <CertificatePreviewModal
            previewCertEvent={previewCertEvent}
            member={member}
            onClose={() => setPreviewCertEvent(null)}
            onDownload={() => handleDownloadCertificate(previewCertEvent.event, previewCertEvent.type)}
            isDownloading={isDownloading}
            downloadingCertKey={downloadingCertKey}
          />
        )}

        {/* Hidden Render Container for Off-Screen PDF Capture */}
        <div 
          aria-hidden="true" 
          style={{ 
            position: "fixed", 
            left: "-9999px", 
            top: "-9999px", 
            width: "1122px", 
            height: "793px", 
            overflow: "hidden", 
            pointerEvents: "none", 
            zIndex: -9999,
            opacity: 1
          }}
        >
          {member && allEvents.map((ev) => {
            const att = myAttendances.find((a) => a.eventId === ev.id);
            if (!att) return null;
            const isReleased = ev.status === "encerrado" || isEventCertificateReleased(ev) || ev.isCertificateReleased === true;
            const isEligible = att.status === "presente" || att.status === "apto_para_certificado" || ev.allowAllRegisteredCertificates;
            const hasPart = isReleased && isEligible;
            const hasOrg = isReleased && att.isOrganizer === true;

            return (
              <React.Fragment key={ev.id}>
                {hasPart && (
                  <div>
                    <AsyncCertificateRenderer
                      event={ev}
                      member={member}
                      isOrganizer={false}
                    />
                  </div>
                )}
                {hasOrg && (
                  <div>
                    <AsyncCertificateRenderer
                      event={ev}
                      member={member}
                      isOrganizer={true}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center py-8 pb-32 sm:pb-40 space-y-8 w-full max-w-2xl mx-auto">
      <Modal
        isOpen={modalHelpOpen}
        onClose={() => setModalHelpOpen(false)}
        title="Instruções de Vínculo"
        onConfirm={() => {
          setLinkMode(true);
          setModalHelpOpen(false);
        }}
      >
        Para vincular sua Identidade Institucional a este dispositivo, digite o
        seu código único recebido da secretaria ou leia o seu QR code validado.
      </Modal>

      {pendingCertTarget && (
        <div className="w-full max-w-[320px] sm:max-w-sm mx-auto p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 shadow-md flex items-start gap-3">
          <Award className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-left">
            <h4 className="font-black text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              Certificado Pronto para Download 📜
            </h4>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-1 leading-relaxed">
              Faça login com seu CPF ou Código (ou use o <strong>Primeiro Acesso</strong>) para visualizar e baixar seu certificado automaticamente.
            </p>
          </div>
        </div>
      )}

      {!linkMode ? (
        <div className="flex flex-col items-center w-full max-w-[320px] sm:max-w-sm mx-auto space-y-4 pt-4 sm:pt-6">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex justify-center items-center mb-4">
            <User className="w-12 h-12 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter text-center leading-tight">
            Identidade Estudantil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4 leading-relaxed">
            Mantenha sua carteirinha salva de forma segura e offline no seu
            próprio celular.
          </p>

          <div className="pt-6 w-full flex flex-col gap-3">
            <button
              onClick={() => {
                playSound('click');
                setLinkMode(true);
              }}
              className="w-full btn-modern py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold tracking-wide shadow-lg flex items-center justify-center gap-3 active:scale-95"
            >
              <CreditCard className="w-5 h-5" /> Vincular Identidade
            </button>
            <button
              onClick={() => {
                playSound('click');
                setTrackMode(true);
                setLinkMode(true);
              }}
              className="w-full group relative overflow-hidden py-4 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900/80 border border-slate-200/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-bold tracking-wide shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all duration-300 hover:shadow-md hover:border-indigo-300/50 dark:hover:border-indigo-500/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
              <Clock className="w-5 h-5 text-indigo-500/70 group-hover:text-indigo-500 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300" />
              <span className="relative z-10 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Acompanhar Pedido</span>
            </button>
            <button
              onClick={() => {
                playSound('pop');
                setShowPublicReq(true);
              }}
              className="w-full btn-modern py-4 rounded-xl border-2 border-sky-300 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 font-bold transition-all flex items-center justify-center gap-2"
            >
              Primeiro Acesso? / Solicitar Nova ID
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center leading-relaxed px-2 mt-4">
              Para solicitar o seu <strong className="text-slate-700 dark:text-slate-200">Primeiro Acesso</strong>, clique no botão acima e preencha os seus dados.
            </p>
            <button
              onClick={() => setModalHelpOpen(true)}
              className="w-full py-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold flex items-center justify-center gap-2 active:scale-95 mt-2"
            >
              Como funciona?
            </button>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {trackMode ? (
            <motion.div
              key="track"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[320px] sm:max-w-sm mx-auto flex flex-col items-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl"
            >
              <Clock className="w-12 h-12 text-slate-400 mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
                Acompanhar Pedido
              </h3>
              <p className="text-xs text-slate-500 text-center mb-6">
                Digite o seu RA ou CPF (apenas números) para verificar o status
                da sua solicitação.
              </p>

              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Ex: 123456789"
                value={trackRa}
                onChange={(e) => setTrackRa(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
              />

              {error && (
                <p className="text-xs font-bold text-rose-500 uppercase mt-4 mb-2 text-center">
                  {error}
                </p>
              )}

              {trackStatusResult && (
                <div
                  className={`mt-6 w-full p-4 rounded-xl border-2 text-center flex flex-col items-center justify-center ${trackStatusResult.status === "APPROVED" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "border-rose-500 bg-rose-50 dark:bg-rose-900/10" : trackStatusResult.status === "NOT_FOUND" ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" : "border-amber-500 bg-amber-50 dark:bg-amber-900/10"}`}
                >
                  <h4
                    className={`text-sm font-black uppercase mb-1 ${trackStatusResult.status === "APPROVED" ? "text-emerald-700 dark:text-emerald-400" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "text-rose-700 dark:text-rose-400" : trackStatusResult.status === "NOT_FOUND" ? "text-slate-600 dark:text-slate-400" : "text-amber-700 dark:text-amber-400"}`}
                  >
                    {trackStatusResult.status === "APPROVED"
                      ? "Aprovado"
                      : trackStatusResult.status === "REJECTED"
                        ? "Reprovado / Removido"
                        : trackStatusResult.status === "INACTIVE"
                          ? "Desativada / Vencida"
                          : trackStatusResult.status === "NOT_FOUND"
                            ? "Não Encontrado"
                            : "Em Análise"}
                  </h4>
                  {trackStatusResult.name && (
                    <p className="text-xs font-bold text-slate-800 dark:text-white mb-2">
                      {trackStatusResult.name}
                    </p>
                  )}
                  <p
                    className={`text-[10px] leading-tight ${trackStatusResult.status === "APPROVED" ? "text-emerald-600 dark:text-emerald-500" : trackStatusResult.status === "REJECTED" || trackStatusResult.status === "INACTIVE" ? "text-rose-600 dark:text-rose-500" : trackStatusResult.status === "NOT_FOUND" ? "text-slate-500" : "text-amber-600 dark:text-amber-500"}`}
                  >
                    {trackStatusResult.msg}
                  </p>
                </div>
              )}

              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => {
                    playSound('click');
                    setLinkMode(false);
                    setTrackMode(false);
                    setTrackStatusResult(null);
                    setError(null);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    handleTrackRequest();
                  }}
                  className="flex-1 py-3 text-sm font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white shadow-sm" />
                  ) : (
                    "Consultar"
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[320px] sm:max-w-sm mx-auto flex flex-col items-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl relative overflow-hidden"
            >
              <QrCode className="w-12 h-12 text-slate-400 mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">
                Código de Uso ou CPF
              </h3>
              <p className="text-xs text-slate-500 text-center mb-6">
                Digite o seu código alfanumérico ou os 11 dígitos numéricos do
                seu CPF para carregar seus dados no dispositivo.
              </p>

              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Ex: XXXX-YYYY ou CPF"
                value={alphaCode}
                onChange={(e) => setAlphaCode(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-widest font-bold w-full py-4 px-6 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white uppercase focus:border-sky-500 transition-colors"
              />

              {error && (
                <div className="flex flex-col items-center gap-3 mt-4 w-full px-2">
                  <p className="text-xs font-bold text-rose-500 uppercase text-center w-full">
                    {error}
                  </p>
                  {(error.includes("não encontrada") || error.includes("não encontrado")) && (
                    <button
                      onClick={() => setShowPublicReq(true)}
                      className="w-full py-2.5 px-4 bg-sky-100 hover:bg-sky-500 hover:text-white text-sky-700 text-xs font-bold rounded-xl border border-sky-200 transition-colors uppercase tracking-wider shadow-sm"
                    >
                      Deseja fazer o primeiro acesso?
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-3 w-full mt-6">
                <button
                  onClick={() => {
                    playSound('click');
                    setLinkMode(false);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    linkIdentity();
                  }}
                  className="flex-1 py-3 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    "Buscar"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {showRegisterTypeSelection && (
        <Modal
          isOpen={showRegisterTypeSelection}
          onClose={() => setShowRegisterTypeSelection(false)}
          title="Tipo de Cadastro"
          hideFooter
        >
          <div className="flex flex-col gap-4 py-4">
            <button
              onClick={() => {
                setShowRegisterTypeSelection(false);
                setShowPublicReq(true);
              }}
              className="p-4 rounded-2xl border-2 border-sky-100 dark:border-sky-500/30 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-500/10 text-left transition-all group"
            >
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">Sou Aluno/Colaborador</h3>
              <p className="text-xs text-slate-500 mt-1">Solicitar identidade digital institucional e carteirinha da FAJOPA.</p>
            </button>
            <button
              onClick={() => {
                setShowRegisterTypeSelection(false);
                setShowVisitorRegisterModal(true);
              }}
              className="p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-500/30 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-left transition-all group"
            >
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Sou Visitante</h3>
              <p className="text-xs text-slate-500 mt-1">Cadastrar para entrada em eventos. (Não gera carteirinha física).</p>
            </button>
          </div>
        </Modal>
      )}

      {showVisitorRegisterModal && (
        <Modal
          isOpen={showVisitorRegisterModal}
          onClose={() => setShowVisitorRegisterModal(false)}
          title="Cadastro de Visitante"
          confirmLabel="Cadastrar"
          onConfirm={handleRegisterVisitor}
          isConfirmValid={!visitorRegistering}
        >
          <div className="space-y-4 py-4 w-full">
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-bold mb-4">Nota: Visitantes não geram a carteirinha.</p>
            <div className="w-full text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Nome Completo
              </label>
              <input
                type="text"
                placeholder="Seu nome"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value.toUpperCase())}
                className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              />
            </div>
            
            <div className="w-full text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                CPF
              </label>
              <input
                type="text"
                placeholder="Apenas números"
                value={visitorCPF}
                onChange={(e) => setVisitorCPF(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {showPublicReq && (
        <PublicRequestModal
          onClose={() => setShowPublicReq(false)}
          onSubmitSuccess={(createdMember) => {
            setShowPublicReq(false);
            if (createdMember) {
              if (createdMember.alphaCode) {
                setAlphaCode(createdMember.alphaCode);
              }
              if (createdMember.isApproved || createdMember.status === "VALID") {
                setMember(createdMember);
                try {
                  localStorage.setItem("davvero_cached_member", JSON.stringify(createdMember));
                } catch {}
              } else {
                setShowRegistrationSuccessModal(true);
              }
            } else {
              setShowRegistrationSuccessModal(true);
            }
          }}
        />
      )}

      {showRegistrationSuccessModal && (
        <RegistrationSuccessModal 
          isOpen={showRegistrationSuccessModal} 
          onClose={() => setShowRegistrationSuccessModal(false)}
        />
      )}

      {showApprovalModal && member && (
        <ApprovalSuccessModal
          isOpen={showApprovalModal}
          onClose={handleApprovalModalClose}
          memberName={member.name}
        />
      )}

      {isDownloadSuccessOpen && downloadedCertInfo && (
        <DownloadSuccessModal
          isOpen={isDownloadSuccessOpen}
          onClose={() => setIsDownloadSuccessOpen(false)}
          fileName={downloadedCertInfo.fileName}
          pdfBlob={downloadedCertInfo.pdfBlob}
          eventTitle={downloadedCertInfo.eventTitle}
          studentName={downloadedCertInfo.studentName}
          certCode={downloadedCertInfo.certCode}
          onReDownload={() => {
            if (downloadedCertInfo.pdfBlob) {
              const url = URL.createObjectURL(downloadedCertInfo.pdfBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = downloadedCertInfo.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }}
        />
      )}
    </div>
  );
});

export default StudentPortal;
