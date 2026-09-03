import React, { useState, useEffect, memo, useRef } from "react";
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
  MailX
} from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toCanvas } from "html-to-image";
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
import { db, appId, enrollStudent } from "../lib/firebase";
import type { Member, Event, Attendance, CertificateTemplate } from "../types";
import VerificationResult from "./VerificationResult";
import Modal from "./Modal";
import PublicRequestModal from "./PublicRequestModal";
import RegistrationSuccessModal from "./RegistrationSuccessModal";
import ApprovalSuccessModal from "./ApprovalSuccessModal";
import EventsPage from "./EventsPage";
import SuggestEditModal from "./SuggestEditModal";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { CertificateRenderer } from "./CertificateRenderer";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import TermsOfUseModal from "./TermsOfUseModal";
import { playSound } from '../lib/sounds';
import { isWebAuthnSupported, registerBiometric, verifyBiometric } from "../lib/webauthn";
import { compressOriginalImage } from "../lib/cropUtils";

const AsyncCertificateRenderer = memo(
  ({
    event,
    member,
    isOrganizer,
    id,
  }: {
    event: Event;
    member: Member;
    isOrganizer?: boolean;
    id?: string;
  }) => {
    const [template, setTemplate] = useState<CertificateTemplate | undefined>(
      isOrganizer ? event.organizationCertificateTemplate : event.certificateTemplate
    );

    useEffect(() => {
      setTemplate(isOrganizer ? event.organizationCertificateTemplate : event.certificateTemplate);
    }, [event.id, isOrganizer, event.organizationCertificateTemplate, event.certificateTemplate]);

    useEffect(() => {
      let isMounted = true;
      const initialTemplate = isOrganizer ? event.organizationCertificateTemplate : event.certificateTemplate;
      if (!initialTemplate) return;

      const assetDocId = isOrganizer
        ? `cert_assets_org_${event.id}`
        : `cert_assets_${event.id}`;
      const docRef = doc(db, ASSETS_DOC_PATH(appId, assetDocId));

      const applyAssets = (assets: any) => {
        if (!assets || !isMounted) return;
        setTemplate((prev) =>
          prev
            ? {
                ...prev,
                ...(assets.backgroundImageUrl && {
                  backgroundImageUrl: assets.backgroundImageUrl,
                }),
                ...(assets.logoUrl && {
                  logoUrl: assets.logoUrl,
                }),
                ...(assets.logo2Url && {
                  logo2Url: assets.logo2Url,
                }),
                ...(assets.fajopaDirectorSignatureUrl && {
                  fajopaDirectorSignatureUrl:
                    assets.fajopaDirectorSignatureUrl,
                }),
                ...(assets.seminarRectorSignatureUrl && {
                  seminarRectorSignatureUrl:
                    assets.seminarRectorSignatureUrl,
                }),
                ...(assets.signature1Url && {
                  signature1Url: assets.signature1Url,
                }),
                ...(assets.signature2Url && {
                  signature2Url: assets.signature2Url,
                }),
                ...(assets.signature3Url && {
                  signature3Url: assets.signature3Url,
                }),
              }
            : prev,
        );
      };

      // 1. Immediate direct fetch for instantaneous rendering
      getDoc(docRef).then((snap) => {
        if (snap.exists()) {
          const snapData = snap.data();
          const assets = snapData?.data !== undefined ? snapData.data : snapData;
          applyAssets(assets);
        }
      }).catch((err) => console.warn("Notice loading cert assets directly", err));

      // 2. Realtime listener for live sync
      const unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const snapData = snap.data();
          const assets = snapData?.data !== undefined ? snapData.data : snapData;
          applyAssets(assets);
        }
      }, (err) => {
        console.warn("Notice in cert assets snapshot", err);
      });

      return () => {
        isMounted = false;
        unsub();
      };
    }, [event.id, isOrganizer, event.organizationCertificateTemplate, event.certificateTemplate]);

    if (!template) return null;
    return (
      <CertificateRenderer
        id={id || `cert-node-${isOrganizer ? "org" : "part"}-${event.id}`}
        event={event}
        template={template}
        member={member}
        isOrganizer={isOrganizer}
      />
    );
  },
);

const STUDENT_BOND_KEY = "davveroId_student_identity";
const STUDENT_TRACK_KEY = "davveroId_student_track_ra";
const STUDENT_FALLBACK_PIN = "student_fallback_pin";

interface StudentPortalProps {
  overrideCode?: string | null;
  onOverrideConsumed?: () => void;
}

export default function StudentPortal({
  overrideCode,
  onOverrideConsumed,
}: StudentPortalProps) {
  const { settings } = useSettings();
  const { showAlert, showConfirm } = useDialog();
  const { isSupported, subscription, permission, isSubscribing, lastError, subscribe, unsubscribe } = usePushNotifications();
  const [bondedId, setBondedId] = useState<string | null>(
    localStorage.getItem(STUDENT_BOND_KEY),
  );
  const [member, setMember] = useState<Member | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem("davveroId_unlocked") === "true";
  });

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
        setActiveTab(e.detail.tab);
        if (e.detail.tab === "id") {
          scrollToCard();
        }
      }
    };
    window.addEventListener("openStudentTab", handleOpenStudentTab);
    return () => window.removeEventListener("openStudentTab", handleOpenStudentTab);
  }, []);
  const [eventsSubTab, setEventsSubTab] = useState<"upcoming" | "past">(
    "upcoming",
  );

  // Modal States
  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const [modalHelpOpen, setModalHelpOpen] = useState(false);
  const [modalPinReset, setModalPinReset] = useState(false);
  const [modalDNEOpen, setModalDNEOpen] = useState(false);
  const [showAccountEditModal, setShowAccountEditModal] = useState(false);
  const [showDeletionConfirmModal, setShowDeletionConfirmModal] = useState(false);
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

  const portalContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const scrollToCard = () => {
    // Dynamic adaptive scroll considering device screen size, viewport height and header elements
    setTimeout(() => {
      const el = cardRef.current || document.getElementById('student-carteirinha-container');
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const screenWidth = window.innerWidth;

        // Mobile devices need safe offset for top fixed banners / navigation
        let topOffset = 20;
        if (screenWidth < 640) {
          topOffset = 50; // Extra room for mobile header
        } else if (screenWidth < 768) {
          topOffset = 35;
        } else {
          topOffset = 20;
        }

        const targetY = Math.max(0, rect.top + scrollTop - topOffset);
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // Fallback PIN state
  const [pinMode, setPinMode] = useState<"create" | "verify" | "none">("none");
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
    if (isUnlocked && !isLoading && !isPrePinAnimation && bondedId && pinMode === "none") {
      if (window.innerWidth < 768 && !hasAutoScrolled.current) {
        scrollToCard();
        hasAutoScrolled.current = true;
      }
    }
  }, [isUnlocked, isLoading, isPrePinAnimation, bondedId, pinMode]);

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

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [seminaryAvailableEvents, setSeminaryAvailableEvents] = useState<Event[]>([]);
  const [seminaryPastEvents, setSeminaryPastEvents] = useState<Event[]>([]);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [isEnrollingInProgress, setIsEnrollingInProgress] = useState<
    string | null
  >(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let unsubEvents: any;
    let unsubAttendances: any;
    if (member) {
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
        const hasPrivilegedRole = member.roles?.some(r => ["ADMIN", "COORDENADOR", "GERENTE", "REITOR", "VICE-REITOR", "DIRETOR ESPIRITUAL", "PADRE"].includes(r.toUpperCase()));

        setAvailableEvents(evts.filter((e) => e.status === "aberto" && !e.isSeminary));
        setPastEvents(evts.filter((e) => e.status === "encerrado" && !e.isSeminary));
        setSeminaryAvailableEvents(evts.filter((e) => e.status === "aberto" && e.isSeminary && (!e.seminaryId || e.seminaryId === member.seminary || hasPrivilegedRole)));
        setSeminaryPastEvents(evts.filter((e) => e.status === "encerrado" && e.isSeminary && (!e.seminaryId || e.seminaryId === member.seminary || hasPrivilegedRole)));
      });

      const qAttendances = query(
        collection(db, `artifacts/${appId}/public/data/attendances`),
        where("studentId", "==", member.id)
      );
      unsubAttendances = onSnapshot(qAttendances, (snap) => {
        const list = snap.docs.map(d => d.data() as Attendance);
        setMyAttendances(list);
      });

      return () => {
        if (unsubEvents) unsubEvents();
        if (unsubAttendances) unsubAttendances();
      };
    }
  }, [member]);

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

  const [isUpdatingEmailPref, setIsUpdatingEmailPref] = useState(false);

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

  const handleToggleEmailNotifications = async () => {
    if (!member) return;
    setIsUpdatingEmailPref(true);
    try {
      const currentVal = member.emailNotificationsEnabled !== false; // default true
      const newVal = !currentVal;
      const docRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
      await updateDoc(docRef, {
        emailNotificationsEnabled: newVal,
        ...(newVal ? {} : { emailUnsubscribedAt: new Date().toISOString() })
      });
      const updatedMember = {
        ...member,
        emailNotificationsEnabled: newVal,
        ...(newVal ? {} : { emailUnsubscribedAt: new Date().toISOString() })
      };
      setMember(updatedMember);
      try {
        localStorage.setItem("davvero_cached_member", JSON.stringify(updatedMember));
      } catch {}
      playSound("success");
      showAlert(
        newVal
          ? "Notificações por e-mail ativadas com sucesso! Você receberá avisos sobre certificados liberados e avisos acadêmicos."
          : "Notificações por e-mail desativadas. Você não receberá mais comunicados automáticos por e-mail.",
        { type: "success" }
      );
    } catch (err) {
      console.error(err);
      playSound("error");
      showAlert("Erro ao atualizar preferência de e-mail.", { type: "error" });
    } finally {
      setIsUpdatingEmailPref(false);
    }
  };

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
      setIsEnrollingInProgress(null);
    }
  };

  const handleDownloadCertificate = async (
    event: Event,
    type: "participant" | "organizer",
  ) => {
    if (!member) return;

    setIsDownloading(true);

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
        canvas = await toCanvas(node, {
          pixelRatio: 2,
          skipFonts: false,
          cacheBust: true,
        });
      } catch (errCanvas) {
        console.warn("toCanvas error, falling back to html2canvas", errCanvas);
        canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false,
        });
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

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

      // On mobile devices, offer to open the certificate as well
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      if (isMobile) {
        setTimeout(async () => {
          if (
            await showConfirm(
              "Certificado descarregado com sucesso! Deseja abrir o arquivo agora?",
              { type: 'success' }
            )
          ) {
            const blob = pdf.output("blob");
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, "_blank");
          }
        }, 1000);
      }
    } catch (e: any) {
      console.error("Download Error:", e);
      showAlert(
        `Erro ao gerar certificado: ${e.message || "Falha na geração do arquivo"}`,
        { type: 'error' }
      );
    } finally {
      setIsDownloading(false);
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
    setIsLoading(true);
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
        setMember({ ...foundMemberLocal, id: foundDocId } as Member);
        if (isOverride) {
          setIsOverrideMode(true);
          setBondedId(id);
          setIsUnlocked(true);
          onOverrideConsumed?.();
        } else {
          // If the user has a PIN, require them to unlock, ONLY if they are not already unlocked in this session
          const isAlreadyUnlockedInSession = sessionStorage.getItem("davveroId_unlocked") === "true";
          if ((localStorage.getItem(STUDENT_FALLBACK_PIN) || localStorage.getItem("student_biometric_credential_id")) && !isAlreadyUnlockedInSession) {
            setIsUnlocked(false);
          } else {
            setIsUnlocked(true);
          }
        }
      } else {
        setError("Identidade vinculada não encontrada.");
        if (!isOverride) {
          localStorage.removeItem(STUDENT_BOND_KEY);
          setBondedId(null);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar sua identidade.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!bondedId) return;
    
    // First figure out if bondedId is a doc id or alphaCode
    const listenToMember = async () => {
       let realDocId = bondedId;
       try {
         const dSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, bondedId));
         if (!dSnap.exists()) {
             // Must be alphaCode, find the doc
             const sm = await getDocs(query(collection(db, `artifacts/${appId}/public/data/students`), where("alphaCode", "==", bondedId), limit(1)));
             if (!sm.empty) {
                realDocId = sm.docs[0].id;
             }
         }
       } catch(e) {}

       const unsub = onSnapshot(doc(db, `artifacts/${appId}/public/data/students`, realDocId), (docSnap) => {
         if (docSnap.exists()) {
           setMember(prev => {
             const m = { ...prev, ...docSnap.data(), id: docSnap.id } as Member;
             localStorage.setItem("davveroId_cached_member", JSON.stringify(m));
             return m;
           });
         }
       });
       return unsub;
    };
    
    let unsubscribe: any = null;
    listenToMember().then(u => { unsubscribe = u; });

    return () => { if (unsubscribe) unsubscribe(); };
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
        if (foundMember.id) localStorage.setItem("davveroId_student_doc_id", foundMember.id);
        if (foundMember.ra) localStorage.setItem(STUDENT_TRACK_KEY, foundMember.ra);
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
      const newMember = await registerVisitor(visitorName.trim(), visitorCPF.trim());
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
          await new Promise((resolve) => setTimeout(resolve, 3000));
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
        await new Promise((resolve) => setTimeout(resolve, 3000));
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

  const handleBiometricAuth = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      const credId = localStorage.getItem("student_biometric_credential_id");
      if (credId) {
        await verifyBiometric(credId);
        playSound('generating');
        playSound('generating');
        await new Promise(r => setTimeout(r, 3000));
        setIsUnlocked(true);
        setIsGenerating(false);
        setPinMode("none");
        playSound('login');
        scrollToCard();
      } else {
        if (!member) {
          setIsGenerating(false);
          return;
        }
        const newCredId = await registerBiometric(member.email || "aluno@fajopa", member.name);
        localStorage.setItem("student_biometric_credential_id", newCredId);
        playSound('generating');
        await new Promise(r => setTimeout(r, 3000));
        setIsUnlocked(true);
        setIsGenerating(false);
        setPinMode("none");
        playSound('login');
        scrollToCard();
      }
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      const errorMsg = e.message || "";
      const isFrameError =
        e.name === "SecurityError" ||
        e.name === "NotAllowedError" ||
        errorMsg.includes("publickey-credentials") || 
        errorMsg.includes("feature is not enabled") ||
        errorMsg.includes("Permissions Policy") ||
        errorMsg.includes("iframes");

      if (isFrameError) {
        setError("BIOMETRIA RESTRITA NO IFRAME. CLIQUE EM 'ABRIR PORTAL' OU COPIE O LINK DE COMPARTILHAMENTO, OU USE SEU PIN NUMÉRICO.");
      } else {
        setError(e.message || "FALHA NA BIOMETRIA");
      }
      playSound('error');
    }
  };

  const handleUnlockScreen = () => {
    const hasPin = localStorage.getItem(STUDENT_FALLBACK_PIN);
    if (hasPin) {
      setPinMode("verify");
    } else {
      setPinMode("create");
    }
  };

  const handlePinResetAttempt = () => {
    if (!member || !member.alphaCode) return;
    if (resetCodeStr.toUpperCase() === member.alphaCode.toUpperCase()) {
      // Reset pin
      localStorage.removeItem(STUDENT_FALLBACK_PIN);
      setPinMode("create");
      setPinInput("");
      setPinConfirm("");
      setModalPinReset(false);
      setResetCodeStr("");
      setError("Crie uma nova senha de 4 dígitos.");
    } else {
      setError("Código incorreto.");
    }
  };

  const confirmUnlink = () => {
    if (isOverrideMode) return;
    playSound('logout');
    localStorage.removeItem(STUDENT_BOND_KEY);
    localStorage.removeItem(STUDENT_TRACK_KEY);
    localStorage.removeItem("davveroId_student_doc_id");
    localStorage.removeItem(STUDENT_FALLBACK_PIN);
    localStorage.removeItem("student_biometric_credential_id");
    localStorage.removeItem("davveroId_student_identity"); // clear the specific key requested if its different
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

      if (pinMode !== "none") {
        const title =
          pinMode === "create"
            ? !pinConfirm
              ? "Criar Senha/PIN (4 dígitos)"
              : "Confirme a Senha"
            : "Digite sua Senha/PIN";
        return (
          <div className="flex flex-col items-center py-20 px-4 text-center space-y-6 animate-fade-in max-w-[320px] sm:max-w-sm mx-auto h-full">
            <Modal
              isOpen={modalPinReset}
              onClose={() => setModalPinReset(false)}
              title="Esqueci minha senha"
              confirmLabel="Redefinir Senha"
              onConfirm={handlePinResetAttempt}
            >
              <p className="mb-4">
                Para redefinir sua senha, informe seu código de uso (presente na
                sua aprovação de cadastro ou verso da carteirinha em PDF):
              </p>
              <input
                type="text"
                placeholder="Seu código de uso"
                autoCapitalize="characters"
                value={resetCodeStr}
                onChange={(e) => setResetCodeStr(e.target.value.toUpperCase())}
                className="input-modern w-full rounded-xl py-3 px-4 text-center font-bold tracking-widest text-lg"
              />
            </Modal>

            <Lock className="w-12 h-12 text-sky-500" />
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
              {title}
            </h2>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePinSubmit();
              }}
              className="text-center text-4xl tracking-[1em] font-black w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-900 dark:text-white placeholder-slate-300 ml-[0.5em]"
              placeholder="••••"
            />
            {error && (
              <p className="text-xs text-rose-500 font-bold uppercase">
                {error}
              </p>
            )}
            <button
              onClick={handlePinSubmit}
              className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95"
            >
              Confirmar
            </button>
            {isWebAuthnSupported() && (
              <button
                onClick={handleBiometricAuth}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-5 h-5" />
                {localStorage.getItem("student_biometric_credential_id") ? "Usar Biometria" : "Cadastrar Biometria"}
              </button>
            )}
            <div className="flex flex-col gap-2 mt-4 w-full">
              {pinMode === "verify" && (
                <button
                  onClick={() => {
                    setModalPinReset(true);
                    setError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-sky-600 font-bold w-full p-2"
                >
                  Esqueci minha senha
                </button>
              )}
              <button
                onClick={() => {
                  setPinMode("none");
                  setModalUnlinkOpen(true);
                }}
                className="text-xs text-rose-400 hover:text-rose-600 font-bold w-full p-2"
              >
                Cancelar e Remover Conta
              </button>
            </div>
          </div>
        );
      }

      return (
        <>
          <Modal
            isOpen={modalUnlinkOpen}
            onClose={() => setModalUnlinkOpen(false)}
            title="Remover Vínculo"
            confirmLabel="Sim, Remover"
            confirmVariant="danger"
            onConfirm={confirmUnlink}
          >
            Deseja remover sua identidade institucional deste dispositivo? Você
            precisará do código de segurança para vincular novamente.
          </Modal>

          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-8 animate-fade-in relative max-w-[320px] sm:max-w-sm mx-auto h-full min-h-[60vh]">
            <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] rounded-3xl -z-10" />
            <div className="w-24 h-24 bg-sky-100 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
              <Lock className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                Acesso Bloqueado
              </h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Use sua senha para desbloquear a sua carteirinha.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleUnlockScreen}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5" />
                {localStorage.getItem(STUDENT_FALLBACK_PIN)
                  ? "Digitar Senha / PIN"
                  : "Criar Senha de Acesso"}
              </button>

              {isWebAuthnSupported() && (
                <button
                  onClick={handleBiometricAuth}
                  className="w-full py-4 bg-sky-100 hover:bg-sky-200 text-sky-700 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 dark:text-sky-300 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-5 h-5" />
                  {localStorage.getItem("student_biometric_credential_id") ? "Acessar com Biometria" : "Habilitar Biometria"}
                </button>
              )}
            </div>
            {error && (
              <p className="text-[10px] text-rose-500 font-bold uppercase">
                {error}
              </p>
            )}
            <button
              onClick={() => setModalUnlinkOpen(true)}
              className="text-xs text-rose-400 hover:text-rose-600 font-bold transition-colors"
            >
              Desvincular Carteirinha
            </button>
          </div>
        </>
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
          {isSupported && !subscription && !isOverrideMode && (
             <div className="w-full mb-6 no-print">
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      <div className="bg-sky-500 p-2.5 rounded-xl text-white shadow-md">
                         <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Não perca nada!</h4>
                         <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Ative as notificações em segundo plano para receber avisos importantes, mesmo com o app fechado. Não gasta bateria.</p>
                      </div>
                   </div>
                   <button
                      onClick={() => {
                        playSound('click');
                        subscribe();
                      }}
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 whitespace-nowrap"
                   >
                      Ativar Notificações
                   </button>
                </div>
             </div>
          )}
          <div className="w-full flex justify-between items-center mb-6 px-2 no-print print:hidden">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Acesso Seguro Ativo
            </span>
            <div className="flex gap-1">
              {!isOverrideMode && (
                <>
                  {isSupported && !subscription && (
                    <button
                      onClick={() => {
                        playSound('click');
                        subscribe();
                      }}
                      className="p-2 text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 transition-colors animate-pulse relative"
                      title="Ativar Notificações"
                    >
                      <Bell className="w-5 h-5" />
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                    </button>
                  )}
                  {isSupported && subscription && (
                    <button
                      className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors cursor-default"
                      title="Notificações Ativas"
                    >
                      <BellRing className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      playSound('logout');
                      setIsUnlocked(false);
                    }}
                    className="p-2 text-slate-400 hover:text-sky-500 transition-colors"
                    title="Bloquear Proteção"
                  >
                    <Lock className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      setModalUnlinkOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Sair / Desvincular"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
              {isOverrideMode && (
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center bg-amber-500/10 px-2 py-1 rounded-full">
                  MODO VISUALIZAÇÃO
                </span>
              )}
            </div>
          </div>
          {/* TAB NAVIGATION */}
          <div className="w-full mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2 no-print print:hidden mb-4">
            <button
              onClick={() => {
                playSound('click');
                setActiveTab("id");
                scrollToCard();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "id"
                  ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Minha ID</span>
            </button>
            <button
              onClick={() => {
                playSound('click');
                setActiveTab("events");
              }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "events"
                  ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Eventos</span>
            </button>
            <button
              onClick={() => {
                playSound('click');
                setActiveTab("certificates");
              }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "certificates"
                  ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Certificados</span>
            </button>
            <button
              onClick={() => {
                playSound('click');
                setActiveTab("academic");
              }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "academic"
                  ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Acadêmico</span>
              <span className="sm:hidden">Acad.</span>
            </button>

            {(member?.roles?.some(r => ["SEMINARISTA", "PADRE", "REITOR", "VICE-REITOR", "PSICÓLOGA", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL"].includes(r.toUpperCase()))) && (
              <button
                onClick={() => setActiveTab("seminary_events")}
                className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                  activeTab === "seminary_events"
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                } ${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
              >
                <CalendarHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Eventos Seminário</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("biblioteca")}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "biblioteca"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Biblioteca</span>
            </button>
            <button
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                activeTab === "account"
                  ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              } ${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Conta</span>
            </button>
          </div>

          <div className="w-full mt-2">
            {activeTab === "id" && (
              <motion.div
                ref={cardRef}
                id="student-carteirinha-container"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <VerificationResult
                  member={member}
                  status={(!member.isApproved && member.isApproved !== undefined) || member.isApproved === false ? "PENDING" : (member.isActive ? "VALID" : "INACTIVE")}
                  onReset={() => {
                    playSound('logout');
                    localStorage.removeItem(STUDENT_BOND_KEY);
                    localStorage.removeItem(STUDENT_FALLBACK_PIN);
                    setMember(null);
                    setBondedId(null);
                    setIsUnlocked(false);
                    setPinMode("none");
                  }}
                  isMyID={true}
                />

                <div className="px-4 py-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                    Esta é a sua Identidade Estudantil oficial. Use o QR Code
                    acima para validar sua presença em eventos e garantir seu
                    acesso aos benefícios estudantis.
                  </p>
                </div>

                <div className="px-4 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-center no-print print:hidden">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3 leading-tight">
                    Validade Nacional
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-4 px-4 leading-relaxed font-medium">
                    O DAVVERO System é seu documento institucional. Para eventos
                    nacionais que exijam o padrão ITI com certificação
                    ICP-Brasil, você pode solicitar o DNE oficial.
                  </p>
                  <button
                    onClick={() => setModalDNEOpen(true)}
                    className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                  >
                    Solicitar Documento Nacional (DNE)
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "events" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* SUB-TABS for Events */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/30 rounded-2xl mb-6">
                  <button
                    onClick={() => setEventsSubTab("upcoming")}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      eventsSubTab === "upcoming"
                        ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Próximos
                  </button>
                  <button
                    onClick={() => setEventsSubTab("past")}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      eventsSubTab === "past"
                        ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Histórico
                  </button>
                </div>

                {eventsSubTab === "upcoming" ? (
                  <>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-sky-500" /> Próximos
                        Eventos
                      </h3>
                    </div>

                    {availableEvents.length > 0 ? (
                      <div className="space-y-4">
                        {availableEvents.map((event) => {
                          const isEnrolled = myAttendances.some(
                            (a) => a.eventId === event.id,
                          );
                          const isPastDeadline = event.registrationDeadline
                            ? new Date() > new Date(event.registrationDeadline)
                            : false;
                          const isPaused = event.isRegistrationPaused === true;

                          const canEnroll = !isPastDeadline && !isPaused;

                          let cannotEnrollReason = "";
                          if (isPaused) cannotEnrollReason = "Inscrições Pausadas";
                          else if (isPastDeadline) cannotEnrollReason = "Inscrições Encerradas";
                          return (
                            <div
                              key={event.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                                    event.format === "presencial"
                                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                      : event.format === "hibrido"
                                      ? "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400"
                                      : "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400"
                                  }`}
                                >
                                  {event.format === "presencial"
                                    ? "Presencial"
                                    : event.format === "hibrido"
                                    ? "Híbrido"
                                    : "Online"}
                                </span>
                                {isEnrolled && (
                                  <span className="text-[9px] font-black uppercase px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Inscrito
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1 leading-tight">
                                {event.title}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                                {event.description}
                              </p>

                              <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight mb-4">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  {new Date(event.startDate).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </div>
                                {event.hours && (
                                  <div className="flex items-center gap-1.5">
                                    <LogOut className="w-3.5 h-3.5 rotate-180" />
                                    {event.hours}H
                                  </div>
                                )}
                              </div>
                              {!isEnrolled ? (
                                canEnroll ? (
                                  <button
                                    onClick={() => handleEnroll(event.id)}
                                    disabled={isEnrollingInProgress === event.id}
                                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                                  >
                                    {isEnrollingInProgress === event.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      "Inscrever-se Agora"
                                    )}
                                  </button>
                                ) : (
                                  <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold border border-slate-200 dark:border-slate-700/50 text-center text-xs flex items-center justify-center gap-2">
                                    {cannotEnrollReason}
                                  </div>
                                )
                              ) : (
                                <div className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-500 rounded-2xl font-bold border border-emerald-100 dark:border-emerald-900/30 text-center text-xs">
                                  Inscrição confirmada
                                </div>
                              )}

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
                                        <Download className="w-4 h-4" /> Baixar conteúdo
                                      </a>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <ExternalLink className="w-4 h-4" /> Abrir Link Conteúdo
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
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                          Nenhum evento aberto
                        </p>
                        <p className="text-xs text-slate-500">
                          No momento não há inscrições abertas para novos
                          eventos.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" /> Eventos
                        Encerrados
                      </h3>
                    </div>

                    {pastEvents.filter((e) =>
                      myAttendances.some((a) => a.eventId === e.id),
                    ).length > 0 ? (
                      <div className="space-y-4">
                        {pastEvents
                          .filter((e) =>
                            myAttendances.some((a) => a.eventId === e.id),
                          )
                          .map((event) => (
                            <div
                              key={event.id}
                              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-5 shadow-sm"
                            >
                              <h4 className="font-bold text-slate-700 dark:text-white text-sm mb-1 leading-tight">
                                {event.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 uppercase font-bold">
                                {new Date(event.startDate).toLocaleDateString(
                                  "pt-BR",
                                )}{" "}
                                •{" "}
                                {event.format === "presencial"
                                  ? "Presencial"
                                  : event.format === "hibrido"
                                  ? "Híbrido"
                                  : "Online"}
                              </p>
                              <div className="flex items-center gap-2">
                                {myAttendances.find(
                                  (a) => a.eventId === event.id,
                                )?.status === "presente" ||
                                myAttendances.find(
                                  (a) => a.eventId === event.id,
                                )?.status === "apto_para_certificado" ? (
                                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Presença
                                    Confirmada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 font-medium">
                                    <LogOut className="w-3 h-3" /> Evento
                                    Finalizado
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
                                        <Download className="w-4 h-4" /> Baixar conteúdo
                                      </a>
                                      <a
                                        href={event.schedulePdfUrl.startsWith("http") ? event.schedulePdfUrl : `https://${event.schedulePdfUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                                      >
                                        <ExternalLink className="w-4 h-4" /> Abrir Link Conteúdo
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
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                          Sem histórico
                        </p>
                        <p className="text-xs text-slate-500">
                          Você ainda não participou ou não possui histórico em
                          eventos encerrados.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "certificates" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* FAJOPA Plus & Davvero Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl shadow-lg flex flex-col justify-between items-start text-white relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 opacity-10">
                       <ShieldCheck className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-3">
                        Validação de Certificados
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5" /> FAJOPA Plus
                      </h3>
                      <p className="text-xs text-emerald-50 max-w-sm mb-6 leading-relaxed">
                        Acesse a validação e autenticidade oficial de certificados da rede FAJOPA Plus.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const targetUrl = settings.certificateValidationUrl || "https://plus.fajopa.org/validar";
                        window.open(targetUrl, '_blank');
                      }}
                      className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-xs shadow-md flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Validar no FAJOPA Plus
                    </button>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between items-start relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05]">
                         <ShieldCheck className="w-32 h-32 text-slate-900 dark:text-white" />
                      </div>
                      <div className="relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-black uppercase tracking-widest mb-3">
                          Nativo & Verificável
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                          <ShieldCheck className="w-5 h-5 text-sky-500" /> DAVVERO System
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                          Seus certificados oficiais gerados diretamente pela plataforma, com código QR e validação digital instantânea.
                        </p>
                      </div>
                      <button
                         onClick={() => {
                            const el = document.getElementById("davvero-certificates-list");
                            if(el) el.scrollIntoView({behavior: 'smooth'});
                         }}
                         className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-xs flex items-center justify-center gap-2"
                      >
                         Ver Certificados Oficiais Abaixo
                      </button>
                  </div>
                </div>

                <div id="davvero-certificates-list">
                  <>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Certificados de Eventos Concluídos
                      </h3>
                    </div>

                    {allEvents.filter((e) => {
                      const attendance = myAttendances.find((a) => a.eventId === e.id);
                      if (!attendance) return false;
                      const hasPartCert = (e.status === "encerrado" || e.status === "aberto") && e.certificateTemplate?.isApproved === true && (attendance.status === "presente" || attendance.status === "apto_para_certificado");
                      const hasOrgCert = (e.status === "encerrado" || e.status === "aberto") && e.organizationCertificateTemplate?.isApproved === true && attendance.isOrganizer === true;
                      return hasPartCert || hasOrgCert;
                    }).length > 0 ? (
                      <div className="space-y-4">
                        {allEvents.filter((e) => {
                            if (e.status !== "encerrado" && e.status !== "aberto") return false;
                            const attendance = myAttendances.find((a) => a.eventId === e.id);
                            if (!attendance) return false;
                            const hasPartCert = e.certificateTemplate?.isApproved === true && (attendance.status === "presente" || attendance.status === "apto_para_certificado");
                            const hasOrgCert = e.organizationCertificateTemplate?.isApproved === true && attendance.isOrganizer === true;
                            return hasPartCert || hasOrgCert;
                          })
                          .map((event) => {
                            const startStr = new Date(event.startDate).toLocaleDateString("pt-BR");
                            const endStr = event.endDate ? new Date(event.endDate).toLocaleDateString("pt-BR") : startStr;
                            const periodText = startStr === endStr ? startStr : `${startStr} a ${endStr}`;
                            const formatText = event.format === "online" ? "Online" : event.format === "hibrido" ? "Híbrido" : "Presencial";
                            const attendance = myAttendances.find((a) => a.eventId === event.id);
                            const hasPartCert = event.certificateTemplate?.isApproved === true && (attendance?.status === "presente" || attendance?.status === "apto_para_certificado");
                            const hasOrgCert = event.organizationCertificateTemplate?.isApproved === true && attendance?.isOrganizer === true;

                            return (
                              <div key={event.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 text-left shadow-sm flex flex-col gap-3">
                                <div>
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-snug mb-1">{event.title}</h4>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">{formatText}</span>
                                    <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">{periodText}</span>
                                    <span className="text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">{event.hours || 0} horas</span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row gap-2">
                                  {hasPartCert && (
                                    <div className="flex-1 flex gap-2">
                                      <button 
                                        onClick={() => handleDownloadCertificate(event, "participant")} 
                                        disabled={isDownloading}
                                        className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                      >
                                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /> Baixar Certificado (PDF)</>}
                                      </button>
                                      <button 
                                        onClick={() => setPreviewCertEvent({ event, type: "participant" })}
                                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                        title="Visualizar Certificado"
                                      >
                                        <Eye className="w-4 h-4" /> Visualizar
                                      </button>
                                    </div>
                                  )}
                                  {hasOrgCert && (
                                    <div className="flex-1 flex gap-2">
                                      <button 
                                        onClick={() => handleDownloadCertificate(event, "organizer")} 
                                        disabled={isDownloading}
                                        className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                      >
                                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /> Baixar Organização (PDF)</>}
                                      </button>
                                      <button 
                                        onClick={() => setPreviewCertEvent({ event, type: "organizer" })}
                                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                        title="Visualizar Certificado de Organização"
                                      >
                                        <Eye className="w-4 h-4" /> Visualizar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Nenhum certificado disponível</p>
                        <p className="text-xs text-slate-500">Os certificados aparecem aqui após a confirmação da sua participação e aprovação do modelo pelo administrador.</p>
                      </div>
                    )}

                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">Certificados Anexados</h3>
                      </div>
                      <div className="space-y-4">
                        {(member?.externalCertificates && member.externalCertificates.length > 0) ? (
                          <div className="space-y-3">
                            {member.externalCertificates.map(cert => (
                              <div key={cert.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-4">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate mb-1">{cert.title}</h4>
                                  <p className="text-[9px] text-slate-500 uppercase">{formatDateTime(cert.uploadedAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleDownloadExternalCertificate(cert)}
                                    className="p-2 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                                    title="Baixar Certificado"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenExternalCertificate(cert)}
                                    className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                    title="Visualizar Certificado"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExternalCertificate(cert.id)}
                                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                                    title="Excluir Certificado"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Nenhum certificado anexado</p>
                          </div>
                        )}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-dashed border-sky-300 dark:border-sky-700 text-center">
                           <label className="cursor-pointer text-xs font-bold text-sky-600 dark:text-sky-400 flex flex-col items-center justify-center gap-2 hover:text-sky-500 transition-colors py-2">
                             {isUploadingCert ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                             <span>{isUploadingCert ? "Anexando..." : "Anexar Novo Certificado (PDF ou Imagem)"}</span>
                             <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadExternalCertificate} disabled={isUploadingCert} />
                           </label>
                        </div>
                      </div>
                    </div>
                  </>
                </div>
              </motion.div>
            )}

            {activeTab === "academic" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[500px]">
                  <div className="p-4 bg-sky-50 dark:bg-sky-900/30 rounded-full text-sky-600 dark:text-sky-400 mb-6">
                    <GraduationCap className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-widest leading-tight mb-4 px-2 break-words max-w-full text-center">
                    Portal Acadêmico
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 px-4">
                    Por medidas de segurança do Sistema Integrado FAJOPA (Sophia), o portal não permite visualização integrada. Por favor, acesse o sistema através do botão abaixo usando seu navegador comum.
                  </p>
                  <a
                    href="https://portal.sophia.com.br/SophiA_107/Acesso.aspx?escola=9087"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex sm:inline-flex flex-wrap items-center justify-center gap-2 px-4 sm:px-8 py-4 w-full sm:w-auto bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95 text-xs sm:text-sm uppercase tracking-wider text-center"
                  >
                    Acessar o portal do aluno
                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  </a>
                </div>
              </motion.div>
            )}



            {activeTab === "biblioteca" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[500px]">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 mb-6">
                    <Library className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-widest leading-tight mb-4 px-2 break-words max-w-full text-center">
                    Biblioteca Pessoal
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 px-4">
                    Por medidas de segurança, o Acervo Digital Institucional não permite visualização integrada. Por favor, acesse o sistema através do botão abaixo usando seu navegador comum.
                  </p>
                  <a
                    href="https://biblioteca.sophia.com.br/1291/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex sm:inline-flex flex-wrap items-center justify-center gap-2 px-4 sm:px-8 py-4 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95 text-xs sm:text-sm uppercase tracking-wider text-center"
                  >
                    Abrir no Navegador
                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  </a>
                </div>
              </motion.div>
            )}

            {activeTab === "account" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-700 shadow-xl bg-white">
                        <img 
                            src={member?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.name || 'User')}&background=e2e8f0&color=475569&size=200`} 
                            alt={member?.name} 
                            className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-1">
                        {member?.name}
                      </h3>
                      <p className="text-sm font-semibold text-slate-500 mb-1">{member?.email || 'Nenhum e-mail cadastrado'}</p>
                      
                      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mt-3">
                         {member?.roles?.map((r, i) => (
                           <span key={i} className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                             {r}
                           </span>
                         ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <button 
                           onClick={() => setShowAccountEditModal(true)}
                           className="btn-modern px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                        >
                            <User className="w-4 h-4 inline-block -mt-0.5 mr-1" />
                            Editar Informações
                        </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">RA / Matrícula</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.ra}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CPF</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.cpf}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data de Nascimento</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.birthdate}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Curso</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.course || '-'}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diocese</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.diocese || '-'}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seminário</p>
                       <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{member?.seminary || '-'}</p>
                     </div>
                  </div>

                   <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Mail className="w-4 h-4 text-sky-500" /> Notificações por E-mail
                    </h4>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            E-mail Cadastrado: <span className="font-mono text-sky-600 dark:text-sky-400">{member?.email || 'Nenhum e-mail vinculado'}</span>
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5">
                            {member?.emailNotificationsEnabled === false ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                                <MailX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> E-mails Desativados (Opt-out)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                <MailCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Ativo para Receber Notificações
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {member?.emailNotificationsEnabled === false
                              ? "Você optou por não receber e-mails automáticos. Novos certificados liberados e avisos do sistema não serão enviados para sua caixa de entrada."
                              : "Você receberá avisos quando novos certificados forem liberados, atualizações de carteirinha e comunicados acadêmicos."}
                          </p>
                        </div>

                        <div className="flex-shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            disabled={isUpdatingEmailPref || !member?.email}
                            onClick={() => {
                              playSound('pop');
                              handleToggleEmailNotifications();
                            }}
                            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 ${
                              member?.emailNotificationsEnabled === false
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                                : "bg-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {isUpdatingEmailPref ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Atualizando...</span>
                              </>
                            ) : member?.emailNotificationsEnabled === false ? (
                              <>
                                <MailCheck className="w-4 h-4" />
                                <span>Ativar E-mails</span>
                              </>
                            ) : (
                              <>
                                <MailX className="w-4 h-4" />
                                <span>Desativar E-mails</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <BellRing className="w-4 h-4 text-sky-500" /> Serviço de Notificações Push
                    </h4>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Status Atual
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                            {!isSupported ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Não Suportado
                              </span>
                            ) : permission === "denied" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Erro (Bloqueado)
                              </span>
                            ) : subscription || (permission === "granted" && typeof window !== "undefined" && localStorage.getItem("davvero_push_subscribed") === "true") ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Conectado e Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Pendente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {subscription || (permission === "granted" && typeof window !== "undefined" && localStorage.getItem("davvero_push_subscribed") === "true")
                              ? "Seu dispositivo está ativo e apto a receber comunicados urgentes e avisos em tempo real."
                              : permission === "denied"
                              ? "Você bloqueou as notificações. Libere a permissão nas configurações do seu navegador para receber comunicados."
                              : "Ative as notificações para receber avisos importantes da secretaria."}
                          </p>
                        </div>
                        {isSupported && (
                          <div className="flex-shrink-0 w-full sm:w-auto">
                            {!(subscription || (permission === "granted" && typeof window !== "undefined" && localStorage.getItem("davvero_push_subscribed") === "true")) && permission !== "denied" ? (
                              <button
                                type="button"
                                disabled={isSubscribing}
                                onClick={() => {
                                  playSound('click');
                                  handleTogglePush();
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                              >
                                {isSubscribing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Conectando...</span>
                                  </>
                                ) : (
                                  <span>Ativar Notificações</span>
                                )}
                              </button>
                            ) : (subscription || (permission === "granted" && typeof window !== "undefined" && localStorage.getItem("davvero_push_subscribed") === "true")) ? (
                              <button
                                type="button"
                                disabled={isSubscribing}
                                onClick={() => {
                                  playSound('click');
                                  handleTogglePush();
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 disabled:opacity-60 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                              >
                                {isSubscribing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Processando...</span>
                                  </>
                                ) : (
                                  <span>Desativar</span>
                                )}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Trash2 className="w-4 h-4" /> Zona de Perigo (LGPD)
                    </h4>
                    {member?.deletionRequested ? (
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4 rounded-xl">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                          Sua solicitação de exclusão de dados foi recebida e está aguardando a aprovação do administrador.
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeletionConfirmModal(true)}
                        className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm"
                      >
                         <Trash2 className="w-4 h-4" /> Solicitar Exclusão de Conta (LGPD)
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <Modal
              isOpen={showDeletionConfirmModal}
              onClose={() => setShowDeletionConfirmModal(false)}
              title="Exclusão de Conta"
              confirmLabel="Confirmar"
              confirmVariant="danger"
              onConfirm={async () => {
                 try {
                   if (!member) return;
                   // Request deletion
                   await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, member.id), { deletionRequested: true, deletionRequestedAt: new Date().toISOString() });
                   setShowDeletionConfirmModal(false);
                   await showAlert("Solicitação Enviada", "Sua solicitação de exclusão foi enviada com sucesso ao administrador.");
                 } catch(e) {
                   console.error(e);
                   await showAlert("Erro", "Erro ao solicitar a exclusão de dados.");
                 }
              }}
            >
              <div className="flex flex-col items-center justify-center mb-6 text-red-500">
                 <Trash2 className="w-12 h-12 p-3 bg-red-100 dark:bg-red-900/50 rounded-full border border-red-200 dark:border-red-800" />
              </div>
              Você tem certeza que deseja solicitar a exclusão da sua conta? Isto enviará um pedido ao administrador e seus dados serão movidos para a lixeira após aprovação, em conformidade com a LGPD.
            </Modal>

            {activeTab === "seminary_events" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <EventsPage renderSeminary={true} />
              </motion.div>
            )}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-500" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Prévia do Certificado ({previewCertEvent.type === "participant" ? "Participação" : "Organização"})
                  </h3>
                </div>
                <button
                  onClick={() => setPreviewCertEvent(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Responsive container with scale transform to fit the certificate */}
              <div className="w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950/60 rounded-2xl p-2 sm:p-4 overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[320px]">
                <div className="w-full max-w-full overflow-x-auto flex justify-center py-2">
                  <div style={{ transform: "scale(0.55)", transformOrigin: "top center", height: "460px", width: "1122px" }}>
                    <AsyncCertificateRenderer
                      id="preview-cert-modal-node"
                      event={previewCertEvent.event}
                      member={member}
                      isOrganizer={previewCertEvent.type === "organizer"}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setPreviewCertEvent(null)}
                  className="py-3 px-6 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    handleDownloadCertificate(previewCertEvent.event, previewCertEvent.type);
                  }}
                  disabled={isDownloading}
                  className="py-3 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /> Baixar Certificado em PDF</>}
                </button>
              </div>
            </div>
          </div>
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
            const hasPart = (ev.status === "encerrado" || ev.status === "aberto") && ev.certificateTemplate?.isApproved === true && (att.status === "presente" || att.status === "apto_para_certificado");
            const hasOrg = (ev.status === "encerrado" || ev.status === "aberto") && ev.organizationCertificateTemplate?.isApproved === true && att.isOrganizer === true;

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
    </div>
  );
}
