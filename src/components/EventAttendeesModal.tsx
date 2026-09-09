import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  CheckCircle,
  CheckCircle2,
  Trash2,
  Star,
  ScanLine,
  Mail,
  UserPlus,
  Plus,
  UserCheck,
  Sparkles,
  Clock,
  Shield,
  User,
  RotateCcw,
  UserX,
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  Printer,
  Download,
  FileText,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Users,
  CheckSquare,
  Layers,
  Sparkle,
  ShieldCheck,
  Building,
  GraduationCap,
  Loader2,
  Ban,
  Award
} from "lucide-react";
import type { Event, Attendance, Member, CheckInRecord, AttendanceWithMember } from "../types";
import {
  db,
  appId,
  unsubscribeFromEvent,
  updateAttendanceDetails,
  updateAttendanceStatus,
  removeAttendancePresence,
  enrollStudent
} from "../lib/firebase";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import Modal from "./Modal";
import CertificateEditor from "./CertificateEditor";
import EventQrCodeModal from "./EventQrCodeModal";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import { sendEmailNotification, getCompiledEmail } from "../lib/emailService";
import { getDavveroSvgHtml } from "./DavveroLogo";

interface EventAttendeesModalProps {
  event: Event;
  isAdmin?: boolean;
  onClose: () => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Helper seguro para calcular os dias oficiais do evento sem desvio de fuso horário
function getSafeEventDaysList(startDate?: string, endDate?: string): string[] {
  if (!startDate) return [];
  const cleanStart = startDate.split("T")[0];
  const cleanEnd = (endDate ? endDate.split("T")[0] : cleanStart);
  const [sy, sm, sd] = cleanStart.split("-").map(Number);
  const [ey, em, ed] = cleanEnd.split("-").map(Number);
  if (!sy || !sm || !sd) return [cleanStart];

  const days: string[] = [];
  const cur = new Date(sy, sm - 1, sd, 12, 0, 0); // 12h para evitar bordas de fuso horário / horário de verão
  const end = new Date(ey || sy, (em || sm) - 1, ed || sd, 12, 0, 0);
  let count = 0;
  while (cur <= end && count < 60) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    count++;
  }
  return days.length > 0 ? days : [cleanStart];
}

export default function EventAttendeesModal({
  event,
  isAdmin = false,
  onClose,
}: EventAttendeesModalProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();
  const [mounted, setMounted] = useState(false);

  const isSystemAdmin = useMemo(() => {
    if (isAdmin) return true;
    if (typeof window !== "undefined") {
      if (localStorage.getItem("adminMasterLogged") === "true") return true;
      try {
        const cached = localStorage.getItem("davveroId_cached_member");
        if (cached) {
          const m = JSON.parse(cached) as Member;
          if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
            return true;
          }
        }
      } catch {}
    }
    return false;
  }, [isAdmin]);
  const currentAdminAuditName = useMemo(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("davveroId_cached_member");
        if (cached) {
          const m = JSON.parse(cached) as Member;
          if (m?.name) return `${m.name} (Administrador)`;
        }
        const adminEmail = localStorage.getItem("adminEmail");
        if (adminEmail) return `${adminEmail} (Administrador)`;
      } catch {}
    }
    return "Administrador (Manual)";
  }, []);

  // Modo Principal: "inscritos" (gestão de inscritos) vs "presencas" (controle detalhado de presenças e dias de check-in)
  const [mainView, setMainView] = useState<"inscritos" | "presencas">("inscritos");

  // Filtros e estados na aba de presenças
  const [selectedPresenceDay, setSelectedPresenceDay] = useState<string>("all");
  const [presenceFilterStatus, setPresenceFilterStatus] = useState<"all" | "present" | "absent">("all");
  const [presenceDateModalAttendee, setPresenceDateModalAttendee] = useState<(Attendance & { member?: Member; allDocIds?: string[] }) | null>(null);
  const [customPresenceDate, setCustomPresenceDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Modal e estado para Check-in de Todos de Uma Vez
  const [showBulkCheckInModal, setShowBulkCheckInModal] = useState(false);
  const [bulkCheckInTargetDay, setBulkCheckInTargetDay] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isExecutingBulkCheckIn, setIsExecutingBulkCheckIn] = useState(false);

  // Modal e estado para Desfazer / Remover Check-in de Todos
  const [showBulkResetModal, setShowBulkResetModal] = useState(false);
  const [bulkResetTargetDay, setBulkResetTargetDay] = useState<string>("all_days");
  const [isExecutingBulkReset, setIsExecutingBulkReset] = useState(false);

  const [attendees, setAttendees] = useState<
    (Attendance & { member?: Member; allDocIds?: string[] })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "alunos" | "visitantes" | "organizacao" | "inativos">("all");
  const [sortAttendeesBy, setSortAttendeesBy] = useState<'name-asc' | 'name-desc' | 'present-first' | 'pending-first'>('name-asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'pending'>('all');
  const [selectedAttendeeLetter, setSelectedAttendeeLetter] = useState<string>('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmVariant?: "primary" | "danger";
    onConfirm: () => void;
  } | null>(null);

  // States for Adding Participants (Admin Override)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Event>(event);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Dias oficiais do evento (ex: de 02/09 a 03/09 conforme o cadastro do evento)
  const officialEventDays = useMemo(() => {
    return getSafeEventDaysList(event.startDate, event.endDate);
  }, [event.startDate, event.endDate]);

  // Lista consolidada de dias do evento (dias oficiais + dias com check-ins gravados)
  const eventDays = useMemo(() => {
    const daysSet = new Set<string>(officialEventDays);
    attendees.forEach((a) => {
      if (a.checkInDates && Array.isArray(a.checkInDates)) {
        a.checkInDates.forEach((d) => {
          if (d && typeof d === "string" && d.length === 10) daysSet.add(d);
        });
      }
    });
    return Array.from(daysSet).sort();
  }, [officialEventDays, attendees]);

  // Data alvo para realização de check-in (prioriza o dia selecionado ou o primeiro dia do evento)
  const defaultEventCheckInDay = useMemo(() => {
    if (selectedPresenceDay !== "all") return selectedPresenceDay;
    if (officialEventDays.includes(todayStr)) return todayStr;
    if (officialEventDays.length > 0) return officialEventDays[0];
    return todayStr;
  }, [selectedPresenceDay, officialEventDays, todayStr]);
  const [addSearch, setAddSearch] = useState("");
  const [addTab, setAddTab] = useState<"members" | "visitor">("members");
  const [isAdding, setIsAdding] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    name: "",
    cpf: "",
    email: "",
    diocese: "",
    course: "Visitante",
  });

  // Estados para Remoção de Certificado pelo Administrador
  const [certRevokeTarget, setCertRevokeTarget] = useState<AttendanceWithMember | null>(null);
  const [isRevokingCert, setIsRevokingCert] = useState(false);

  // Real-time synchronization without quota delays
  useEffect(() => {
    setMounted(true);
    setLoading(true);

    let currentAttendances: Attendance[] = [];
    let currentMembersDict: Record<string, Member> = {};

    const recomputeAttendees = () => {
      // DEDUPLICAÇÃO E CONSOLIDAÇÃO:
      // Se a pessoa se inscreveu e também escaneou o QR code (ou foi registrada mais de uma vez),
      // mesclamos em um único registro do aluno, consolidando todas as datas de check-in (checkInDates).
      const mapByStudent = new Map<string, Attendance & { member?: Member; allDocIds?: string[] }>();

      currentAttendances.forEach((a: Attendance) => {
        let mbr = currentMembersDict[a.studentId];
        if (!mbr) {
          mbr = Object.values(currentMembersDict).find(
            (m) =>
              m.id === a.studentId ||
              m.alphaCode === a.studentId ||
              (m.ra && m.ra === a.studentId) ||
              ((a as any).memberRa && (a as any).memberRa === m.ra) ||
              ((m as any).cpf && (a as any).memberCpf === (m as any).cpf)
          );
        }

        const uniqueKey = mbr?.id || a.studentId || a.id;

        const currentDates = Array.isArray(a.checkInDates) ? [...a.checkInDates] : [];
        const currentRecords: CheckInRecord[] = Array.isArray(a.checkInRecords) ? [...a.checkInRecords] : [];
        currentDates.forEach((d) => {
          if (!currentRecords.some((r) => r.date === d)) {
            currentRecords.push({
              date: d,
              timestamp: a.timestamp || new Date().toISOString(),
              validatedBy: "self",
              validatorName: "Validação Registrada",
            });
          }
        });

        if (!mapByStudent.has(uniqueKey)) {
          mapByStudent.set(uniqueKey, {
            ...a,
            member: mbr,
            checkInDates: currentDates,
            checkInRecords: currentRecords,
            allDocIds: [a.id],
          });
        } else {
          // Consolida registro prévio com o novo (ex: escaneamento via QR code)
          const existing = mapByStudent.get(uniqueKey)!;
          const mergedDates = Array.from(
            new Set([
              ...(existing.checkInDates || []),
              ...currentDates,
            ])
          );

          const recordsMap = new Map<string, CheckInRecord>();
          (existing.checkInRecords || []).forEach((r) => recordsMap.set(r.date, r));
          currentRecords.forEach((r) => recordsMap.set(r.date, r));
          mergedDates.forEach((d) => {
            if (!recordsMap.has(d)) {
              recordsMap.set(d, {
                date: d,
                timestamp: existing.timestamp || a.timestamp || new Date().toISOString(),
                validatedBy: "self",
                validatorName: "Validação Registrada",
              });
            }
          });

          const isPresent =
            existing.status === "presente" ||
            a.status === "presente" ||
            mergedDates.length > 0;
          const isOrg = Boolean(existing.isOrganizer || a.isOrganizer);

          mapByStudent.set(uniqueKey, {
            ...existing,
            member: existing.member || mbr,
            status: isPresent ? "presente" : existing.status,
            isOrganizer: isOrg,
            checkInDates: mergedDates,
            checkInRecords: Array.from(recordsMap.values()),
            revokedParticipantCert: Boolean(existing.revokedParticipantCert || a.revokedParticipantCert),
            revokedOrgCert: Boolean(existing.revokedOrgCert || a.revokedOrgCert),
            allDocIds: Array.from(new Set([...(existing.allDocIds || [existing.id]), a.id])),
          });
        }
      });

      const consolidated = Array.from(mapByStudent.values());
      setAttendees(consolidated);
      setLoading(false);
    };

    // 1. Escuta em tempo real todas as presenças/inscrições deste evento
    const qAttendances = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("eventId", "==", event.id)
    );
    const unsubAtt = onSnapshot(
      qAttendances,
      (snap) => {
        currentAttendances = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Attendance))
          .filter((a) => a.status !== ("cancelado" as any));
        recomputeAttendees();
      },
      (err) => {
        console.error("Error listening to attendances in real time:", err);
        setLoading(false);
      }
    );

    // 2. Escuta em tempo real os dados de estudantes para atualização imediata
    const qStudents = query(collection(db, `artifacts/${appId}/public/data/students`));
    const unsubStudents = onSnapshot(
      qStudents,
      (snap) => {
        const dict: Record<string, Member> = {};
        const activeM: Member[] = [];
        snap.docs.forEach((d) => {
          if (!d.id.startsWith("_")) {
            const mbr = { id: d.id, ...d.data() } as Member;
            if (mbr.deletedAt) return;
            dict[d.id] = mbr;
            if (mbr.isActive !== false) {
              activeM.push(mbr);
            }
          }
        });
        currentMembersDict = dict;
        setAllMembers(activeM);
        recomputeAttendees();
      },
      (err) => {
        console.error("Error listening to students in real time:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubAtt();
      unsubStudents();
    };
  }, [event.id]);

  const loadData = async () => {
    // Mantido para compatibilidade com chamadas manuais pontuais
  };

  const handleCancelEnrollment = (eventId: string, studentId: string, memberName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancelar Inscrição",
      confirmVariant: "danger",
      message: `Tem a certeza que deseja cancelar a inscrição de "${memberName}" neste evento? O participante será removido da lista oficial.`,
      onConfirm: async () => {
        try {
          await unsubscribeFromEvent(eventId, studentId);
          await loadData();
          showAlert(`Inscrição de "${memberName}" cancelada com sucesso.`, { type: 'success' });
        } catch (err) {
          showAlert("Erro ao cancelar inscrição.", { type: 'error' });
        }
      },
    });
  };

  const handleCancelCheckIn = (attendanceId: string, memberName: string, docIds?: string[]) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancelar Check-in",
      confirmVariant: "primary",
      message: `Deseja cancelar o check-in de "${memberName}"? A presença será desfeita e o status retornará para "Inscrito".`,
      onConfirm: async () => {
        try {
          const targets = docIds && docIds.length > 0 ? docIds : [attendanceId];
          await Promise.all(
            targets.map((id) => removeAttendancePresence(id).catch(console.warn))
          );
          await loadData();
          showAlert(`Check-in de "${memberName}" cancelado com sucesso. Status revertido para inscrito.`, { type: 'success' });
        } catch (err) {
          showAlert("Erro ao cancelar check-in.", { type: 'error' });
        }
      },
    });
  };

  const handleRemove = async (eventId: string, studentId: string) => {
    handleCancelEnrollment(eventId, studentId, "este participante");
  };

  const handleRemovePresence = async (attendanceId: string, docIds?: string[]) => {
    handleCancelCheckIn(attendanceId, "este participante", docIds);
  };

  const handleMarkPresent = async (attendanceId: string, docIds?: string[], dateStr?: string) => {
    try {
      const targetDay = dateStr || defaultEventCheckInDay;
      const targets = docIds && docIds.length > 0 ? docIds : [attendanceId];
      await Promise.all(
        targets.map((id) =>
          updateAttendanceStatus(id, "presente", targetDay, {
            validatedBy: "admin",
            validatorName: currentAdminAuditName,
            timestamp: new Date().toISOString(),
          }).catch(console.warn)
        )
      );
      await loadData();
      const [y, m, d] = targetDay.split("-");
      showAlert(`Presença confirmada por ${currentAdminAuditName} para o dia ${d}/${m}/${y}.`, { type: 'success' });
    } catch (err) {
      showAlert("Erro ao marcar presença.", { type: 'error' });
    }
  };

  const handleAddPresenceDate = async (att: Attendance & { allDocIds?: string[] }, dateStr: string) => {
    if (!dateStr) return;
    try {
      const targets = att.allDocIds && att.allDocIds.length > 0 ? att.allDocIds : [att.id];
      await Promise.all(
        targets.map((id) =>
          updateAttendanceStatus(id, "presente", dateStr, {
            validatedBy: "admin",
            validatorName: currentAdminAuditName,
            timestamp: new Date().toISOString(),
          }).catch(console.warn)
        )
      );
      await loadData();
      const [y, m, d] = dateStr.split('-');
      showAlert(`Presença de "${att.member?.name || 'participante'}" confirmada por ${currentAdminAuditName} para o dia ${d}/${m}/${y}!`, { type: 'success' });
      setPresenceDateModalAttendee(null);
    } catch (err) {
      console.error("Erro ao adicionar data de presença:", err);
      showAlert("Erro ao adicionar data de presença.", { type: 'error' });
    }
  };

  const handleRemovePresenceDate = (att: Attendance & { allDocIds?: string[] }, dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const formatted = `${d}/${m}/${y}`;
    setConfirmModal({
      isOpen: true,
      title: "Remover Presença do Dia",
      confirmVariant: "danger",
      message: `Deseja remover o registro de presença de "${att.member?.name || 'participante'}" no dia ${formatted}?`,
      onConfirm: async () => {
        try {
          const targets = att.allDocIds && att.allDocIds.length > 0 ? att.allDocIds : [att.id];
          await Promise.all(
            targets.map((id) => removeAttendancePresence(id, dateStr).catch(console.warn))
          );
          await loadData();
          showAlert(`Presença do dia ${formatted} removida com sucesso.`, { type: 'success' });
        } catch (err) {
          console.error("Erro ao remover presença do dia:", err);
          showAlert("Erro ao remover data de presença.", { type: 'error' });
        }
      },
    });
  };

  const handleToggleOrganizer = async (eventId: string, studentId: string, currentStatus: boolean) => {
    try {
      await updateAttendanceDetails(eventId, studentId, { isOrganizer: !currentStatus });
      loadData();
    } catch (err) {
      showAlert("Erro ao atualizar status de organização.", { type: 'error' });
    }
  };

  const handleCheckInAll = () => {
    setBulkCheckInTargetDay(defaultEventCheckInDay);
    setShowBulkCheckInModal(true);
  };

  const handleExecuteBulkCheckIn = async () => {
    if (!bulkCheckInTargetDay) return;
    const targetAttendees = attendees.filter(
      (a) => a.member?.isActive !== false && !(a.checkInDates || []).includes(bulkCheckInTargetDay)
    );

    if (targetAttendees.length === 0) {
      showAlert("Todos os participantes ativos deste evento já possuem presença registrada para esta data!", { type: "info" });
      setShowBulkCheckInModal(false);
      return;
    }

    try {
      setIsExecutingBulkCheckIn(true);
      const auditPayload = {
        validatedBy: "admin" as const,
        validatorName: `${currentAdminAuditName} (Coletivo)`,
        timestamp: new Date().toISOString(),
      };

      const updatePromises = targetAttendees.map((a) => {
        const targets = a.allDocIds && a.allDocIds.length > 0 ? a.allDocIds : [a.id];
        return Promise.all(
          targets.map((docId) =>
            updateAttendanceStatus(docId, "presente", bulkCheckInTargetDay, auditPayload).catch((err) => {
              console.warn("Error in bulk check-in doc:", docId, err);
            })
          )
        );
      });

      await Promise.all(updatePromises);
      await loadData();
      const [y, m, d] = bulkCheckInTargetDay.split("-");
      showAlert(
        `Check-in de todos concluído com sucesso para o dia ${d}/${m}/${y}! (${targetAttendees.length} presenças confirmadas com carimbo de ${currentAdminAuditName}).`,
        { type: "success" }
      );
      setShowBulkCheckInModal(false);
    } catch (err) {
      console.error("Erro ao fazer check-in de todos:", err);
      showAlert("Ocorreu um erro ao processar o check-in em massa.", { type: "error" });
    } finally {
      setIsExecutingBulkCheckIn(false);
    }
  };

  const handleOpenBulkResetModal = () => {
    setBulkResetTargetDay(selectedPresenceDay !== "all" ? selectedPresenceDay : "all_days");
    setShowBulkResetModal(true);
  };

  const handleExecuteBulkReset = async () => {
    try {
      setIsExecutingBulkReset(true);
      const isAllDays = bulkResetTargetDay === "all_days";

      const targetAttendees = attendees.filter((a) => {
        if (isAllDays) {
          return (
            a.status === "presente" ||
            a.status === "apto_para_certificado" ||
            (a.checkInDates && a.checkInDates.length > 0)
          );
        } else {
          return a.checkInDates && a.checkInDates.includes(bulkResetTargetDay);
        }
      });

      if (targetAttendees.length === 0) {
        showAlert("Nenhum participante possui check-in para a opção selecionada.", { type: "info" });
        setShowBulkResetModal(false);
        return;
      }

      const updatePromises = targetAttendees.map((a) => {
        const targets = a.allDocIds && a.allDocIds.length > 0 ? a.allDocIds : [a.id];
        return Promise.all(
          targets.map((docId) =>
            removeAttendancePresence(docId, isAllDays ? undefined : bulkResetTargetDay).catch((err) => {
              console.warn("Error resetting bulk doc:", docId, err);
            })
          )
        );
      });

      await Promise.all(updatePromises);
      await loadData();

      if (isAllDays) {
        showAlert(
          `Todos os check-ins foram removidos com sucesso (${targetAttendees.length} participantes retornados para o status "Inscrito").`,
          { type: "success" }
        );
      } else {
        const [y, m, d] = bulkResetTargetDay.split("-");
        showAlert(
          `Presenças do dia ${d}/${m}/${y} removidas com sucesso de ${targetAttendees.length} participantes.`,
          { type: "success" }
        );
      }
      setShowBulkResetModal(false);
    } catch (err) {
      console.error("Erro ao remover check-ins em massa:", err);
      showAlert("Ocorreu um erro ao processar a remoção dos check-ins.", { type: "error" });
    } finally {
      setIsExecutingBulkReset(false);
    }
  };

  const handleEnrollMember = async (mbr: Member, markPresentImmediately: boolean = false) => {
    try {
      setIsAdding(true);
      const todayStr = new Date().toISOString().split("T")[0];
      await enrollStudent({
        eventId: event.id,
        studentId: mbr.id,
        status: markPresentImmediately ? "presente" : "inscrito",
        checkInDates: markPresentImmediately ? [todayStr] : [],
        timestamp: new Date().toISOString(),
      });
      await loadData();
      showAlert(
        `${mbr.name} foi inscrito(a) no evento com sucesso!${
          markPresentImmediately ? " Presença confirmada." : ""
        }`,
        { type: "success" }
      );
    } catch (err: any) {
      console.error("Erro ao adicionar aluno ao evento:", err);
      showAlert("Erro ao adicionar aluno ao evento: " + (err.message || ""), { type: "error" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEnrollNewVisitor = async (markPresentImmediately: boolean = false) => {
    if (!visitorForm.name.trim()) {
      showAlert("Por favor, preencha o nome do participante.", { type: "warning" });
      return;
    }
    try {
      setIsAdding(true);
      const newVisitorId = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newMember: Member = {
        id: newVisitorId,
        name: visitorForm.name.trim(),
        cpf: visitorForm.cpf.trim() || undefined,
        email: visitorForm.email.trim() || undefined,
        diocese: visitorForm.diocese.trim() || undefined,
        course: visitorForm.course.trim() || "Visitante",
        roles: ["VISITANTE"],
        isActive: true,
        registrationType: "quick",
        createdAt: new Date().toISOString(),
      };

      // Save visitor to students collection
      const { setDoc, doc } = await import("firebase/firestore");
      await setDoc(
        doc(db, `artifacts/${appId}/public/data/students`, newVisitorId),
        newMember
      );

      const todayStr = new Date().toISOString().split("T")[0];
      await enrollStudent({
        eventId: event.id,
        studentId: newVisitorId,
        status: markPresentImmediately ? "presente" : "inscrito",
        checkInDates: markPresentImmediately ? [todayStr] : [],
        timestamp: new Date().toISOString(),
      });

      // Update allMembers state and local list
      setAllMembers((prev) => [...prev, newMember]);
      await loadData();
      setVisitorForm({
        name: "",
        cpf: "",
        email: "",
        diocese: "",
        course: "Visitante",
      });
      setShowAddModal(false);
      showAlert(
        `Participante visitante ${newMember.name} cadastrado e inscrito com sucesso!${
          markPresentImmediately ? " Presença confirmada." : ""
        }`,
        { type: "success" }
      );
    } catch (err: any) {
      console.error("Erro ao cadastrar visitante:", err);
      showAlert("Erro ao cadastrar visitante: " + (err.message || ""), { type: "error" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleCertificateRevocation = async (
    attendee: AttendanceWithMember,
    revoke: boolean
  ) => {
    setIsRevokingCert(true);
    try {
      const studentId = attendee.member?.id || attendee.studentId;
      const certKey = `${event.id}_participant`;
      const certOrgKey = `${event.id}_organizer`;

      const { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc } = await import("firebase/firestore");

      // 1. Atualizar documento do aluno
      if (studentId) {
        const studentRef = doc(db, `artifacts/${appId}/public/data/students`, studentId);
        if (revoke) {
          await updateDoc(studentRef, {
            revokedCertKeys: arrayUnion(certKey, certOrgKey),
          }).catch(console.warn);
        } else {
          await updateDoc(studentRef, {
            revokedCertKeys: arrayRemove(certKey, certOrgKey),
          }).catch(console.warn);
        }
      }

      // 2. Atualizar documento(s) de presença
      const docIds =
        attendee.allDocIds && attendee.allDocIds.length > 0
          ? attendee.allDocIds
          : [attendee.id];

      for (const dId of docIds) {
        if (!dId) continue;
        const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, dId);
        if (revoke) {
          await updateDoc(attRef, {
            revokedParticipantCert: true,
            revokedOrgCert: attendee.isOrganizer ? true : false,
          }).catch(console.warn);
        } else {
          await updateDoc(attRef, {
            revokedParticipantCert: false,
            revokedOrgCert: false,
          }).catch(console.warn);
        }
      }

      // 3. Se for revogação, remove também da coleção de certificados emitidos se existir
      if (revoke && studentId) {
        const certsCol = collection(db, `artifacts/${appId}/public/data/certificates`);
        const q = query(
          certsCol,
          where("eventId", "==", event.id),
          where("studentId", "in", [studentId, attendee.studentId].filter(Boolean))
        );
        const snap = await getDocs(q).catch(() => null);
        if (snap && !snap.empty) {
          for (const docItem of snap.docs) {
            await deleteDoc(docItem.ref).catch(console.warn);
          }
        }
      }

      showAlert(
        revoke
          ? `Certificado de ${attendee.member?.name || "participante"} removido com sucesso!`
          : `Certificado de ${attendee.member?.name || "participante"} restaurado com sucesso!`,
        { type: "success" }
      );

      setCertRevokeTarget(null);
    } catch (err) {
      console.error("Erro ao alterar revogação de certificado:", err);
      showAlert("Falha ao atualizar status do certificado do participante.", { type: "error" });
    } finally {
      setIsRevokingCert(false);
    }
  };

  const handleNotifyOrganizersEmail = async () => {
    const organizers = attendees.filter(a => a.isOrganizer === true && a.member?.email);
    if (organizers.length === 0) {
      showAlert("Nenhum organizador com e-mail cadastrado foi localizado neste evento.", { type: "warning" });
      return;
    }

    try {
      setIsSendingEmails(true);
      let count = 0;
      const certHours = event.organizationHours ? String(event.organizationHours) : (event.hours ? String(event.hours) : "conforme regulamento");

      for (const org of organizers) {
        if (!org.member?.email) continue;

        const compiled = getCompiledEmail({
          templateKey: 'certificateAvailableOrganizer',
          customTemplates: settings.emailTemplates,
          vars: {
            name: org.member.name || 'Organizador(a)',
            eventTitle: event.title || 'Evento Acadêmico',
            eventDate: event.startDate ? new Date(event.startDate + "T12:00:00").toLocaleDateString("pt-BR") : 'Data do Evento',
            hours: certHours,
            email: org.member.email,
            ra: org.member.ra || ''
          },
          settings,
          buttonUrl: `${window.location.origin}/?view=student&tab=certificates&eventId=${event.id}&certType=organizer`
        });

        await sendEmailNotification({
          to: org.member.email,
          subject: compiled.subject,
          html: compiled.fullHtml
        }, settings.smtpConfig).catch(console.warn);

        count++;
      }

      showAlert(`Aviso de certificado disponível enviado com sucesso para ${count} organizador(es)!`, { type: "success" });
    } catch (err) {
      console.error(err);
      showAlert("Falha ao disparar e-mails para os organizadores.", { type: "error" });
    } finally {
      setIsSendingEmails(false);
    }
  };

  const printDocumentHtml = (title: string, contentHtml: string) => {
    const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <style>
      @media print {
        @page { size: auto; margin: 10mm; }
      }
      body { font-family: Arial, sans-serif; padding: 15px; font-size: 11px; color: #000; background: #fff; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1px solid black; padding: 6px 8px; text-align: left; }
      th { background-color: #f3f4f6; }
      .text-center { text-align: center; }
      .font-bold { font-weight: bold; }
      .uppercase { text-transform: uppercase; }
      .tracking-widest { letter-spacing: 0.1em; }
      .border-black { border-color: black; }
      .border-b-2 { border-bottom-width: 2px; }
      .border-dashed { border-style: dashed; border-color: black; opacity: 0.5; height: 26px; border-bottom-width: 1px; }
      .mb-6 { margin-bottom: 20px; }
      .mt-2 { margin-top: 8px; }
      .mt-8 { margin-top: 24px; }
      .pb-2 { padding-bottom: 8px; }
      .text-xl { font-size: 18px; }
      .text-sm { font-size: 13px; }
      .text-xs { font-size: 11px; }
      .inline-block { display: inline-block; }
      .px-2 { padding-left: 8px; padding-right: 8px; }
      .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
      .rounded { border-radius: 4px; }
      .bg-gray-200 { background-color: #e5e7eb; }
      .text-green-600 { color: #16a34a; }
      .bg-emerald-50 { background-color: #ecfdf5; }
      .text-emerald-800 { color: #065f46; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-700 { color: #374151; }
    </style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;

    try {
      let iframe = document.getElementById("davvero_print_frame") as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "davvero_print_frame";
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();
        setTimeout(() => {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        }, 300);
        return;
      }
    } catch (err) {
      console.warn("Iframe print error, falling back to window.open", err);
    }

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(fullHtml);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 300);
    } else {
      showAlert("Não foi possível abrir a impressão. Por favor, verifique bloqueadores de pop-up.", { type: "warning" });
    }
  };

  const handlePrint = (filterType: "all" | "alunos" | "visitantes") => {
    let toPrint = attendees;
    let titleAddon = "Geral";
    
    if (filterType === "alunos") {
      toPrint = attendees.filter(a => !a.member?.roles?.includes("VISITANTE"));
      titleAddon = "Categoria: Alunos / Seminaristas";
    } else if (filterType === "visitantes") {
      toPrint = attendees.filter(a => !!a.member?.roles?.includes("VISITANTE"));
      titleAddon = "Categoria: Visitantes";
    }

    if (!toPrint || toPrint.length === 0) {
      showAlert(`Nenhum participante encontrado na categoria selecionada (${titleAddon}) para impressão.`, { type: "warning" });
      return;
    }
  
    const parsedDaysList: { dateIso: string; displayStr: string }[] = [];
    if (event?.startDate && event?.endDate) {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate).getTime();
      if (end > start) {
        const numDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (numDays > 1 && numDays <= 30) {
          for (let i = 0; i < numDays; i++) {
            const realD = new Date(event.startDate + "T12:00:00");
            realD.setDate(realD.getDate() + i);
            const dateIso = realD.toISOString().split("T")[0];
            const properDayStr = `${String(realD.getDate()).padStart(2, '0')}/${String(realD.getMonth() + 1).padStart(2, '0')}`;
            parsedDaysList.push({ dateIso, displayStr: properDayStr });
          }
        }
      }
    }

    let daysHeader = `<th class="border border-black p-2 w-48 text-center">ASSINATURA DO INSCRITO</th>`;
    if (parsedDaysList.length > 1) {
      daysHeader = parsedDaysList
        .map((d) => `<th class="border border-black p-2 w-28 text-center text-[10px]">ASSINATURA<br/>${d.displayStr}</th>`)
        .join("");
    }

    const evaluateDaysRow = (sub: typeof toPrint[0]) => {
      if (parsedDaysList.length > 1) {
        return parsedDaysList
          .map((d) => {
            const hasSigned = (sub.checkInDates || []).includes(d.dateIso);
            if (hasSigned) {
              return `<td class="border border-black p-1 text-center bg-emerald-50"><div class="text-[9px] font-bold text-emerald-800">✓ PRESENTE</div><div class="text-[7px] text-gray-600 font-medium">Bipado: ${d.displayStr}</div></td>`;
            }
            return `<td class="border border-black p-2 align-bottom"><div class="w-full h-8 border-b border-black border-dashed opacity-50"></div></td>`;
          })
          .join("");
      }
      const isPresent = sub.status === "presente" || sub.status === "apto_para_certificado";
      if (isPresent) {
        const scannedDaysStr = (sub.checkInDates && sub.checkInDates.length > 0)
          ? sub.checkInDates.map(d => {
              const parts = d.split('-');
              return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
            }).join(", ")
          : (event.startDate ? new Date(event.startDate + "T12:00:00").toLocaleDateString("pt-BR") : "Confirmado");

        return `<td class="border border-black p-1 text-center bg-emerald-50">
          <div class="text-[9px] font-bold text-emerald-800">✓ ASSINATURA DIGITAL</div>
          <div class="text-[8px] text-gray-700 font-semibold">Dia(s) Presente: ${scannedDaysStr}</div>
        </td>`;
      }
      return `<td class="border border-black p-2 align-bottom"><div class="w-full h-8 border-b border-black border-dashed opacity-50"></div></td>`;
    };

    let trs = "";
    toPrint.forEach((sub, idx) => {
      const rolesText = [
        ...(sub.member?.roles || []),
        sub.member?.diocese ? `Diocese: ${sub.member?.diocese}` : ""
      ].filter(Boolean).join(" • ");

      trs += `
        <tr>
          <td class="border border-black p-2 text-center font-bold">${idx + 1}</td>
          <td class="border border-black p-2 uppercase font-semibold">${sub.member?.name || "Desconhecido"}</td>
          <td class="border border-black p-2 text-center">${sub.member?.ra || (sub.member as any)?.cpf || "-"}</td>
          <td class="border border-black p-2 text-[10px] uppercase">${rolesText}</td>
          ${evaluateDaysRow(sub)}
        </tr>
      `;
    });

    const davveoIconSvg = settings.instLogo 
      ? `<img src="${settings.instLogo}" style="width: 38px; height: 38px; object-fit: contain;" alt="Logo" />` 
      : getDavveroSvgHtml('#0f172a', 38);

    const printContent = `
      <div class="text-center mb-6">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
          ${davveoIconSvg}
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">${settings.instName || "DAVVERO SYSTEM"}</div>
            <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Gestão de Eventos Acadêmicos & Diocesanos</div>
          </div>
        </div>
        <h2 class="text-xl font-black uppercase tracking-widest border-b-2 border-black pb-2">
          Lista Oficial de Presença
        </h2>
        <p class="text-sm font-bold mt-2 uppercase">${event?.title}</p>
        <p class="text-xs font-semibold mt-1 bg-gray-200 inline-block px-2 py-0.5 rounded">${titleAddon}</p>
        <p class="text-xs mt-1">
          Data de Início: ${event?.startDate ? new Date(event.startDate + "T12:00:00").toLocaleDateString("pt-BR") : "N/D"}
        </p>
      </div>
      <table class="w-full border-collapse border border-black text-xs">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-black p-2 w-8 text-center">#</th>
            <th class="border border-black p-2 text-left">NOME DO INSCRITO</th>
            <th class="border border-black p-2 w-24 text-center">R.A. / CPF</th>
            <th class="border border-black p-2 text-left">VÍNCULO / DIOCESE</th>
            ${daysHeader}
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
      <div class="mt-8 pt-4 border-t border-black text-center text-[10px] uppercase tracking-widest">
        Documento Gerado pelo DAVVERO System • Faculdade João Paulo II (FAJOPA)
      </div>
    `;

    printDocumentHtml(`Lista de Presença - ${event?.title || "Evento"}`, printContent);
  };

  const handlePrintPresenceAuditList = (targetDay: string | "all") => {
    const isSingleDay = targetDay !== "all";
    const [y, m, d] = isSingleDay ? targetDay.split("-") : ["", "", ""];
    const formattedTargetDay = isSingleDay ? `${d}/${m}/${y}` : "Todos os Dias do Evento";

    let listToPrint = attendees.filter((a) => a.member?.isActive !== false);

    if (listToPrint.length === 0) {
      showAlert("Nenhum participante ativo encontrado para impressão da lista de presença.", { type: "warning" });
      return;
    }

    // Ordena alfabeticamente por nome
    listToPrint = [...listToPrint].sort((a, b) =>
      (a.member?.name || "").localeCompare(b.member?.name || "", "pt-BR")
    );

    let trs = "";
    let totalPresentInReport = 0;

    listToPrint.forEach((sub, idx) => {
      const rolesText = [
        ...(sub.member?.roles || []),
        sub.member?.course || "",
        sub.member?.diocese ? `Diocese: ${sub.member?.diocese}` : "",
      ].filter(Boolean).join(" • ");

      if (isSingleDay) {
        const isPresentOnDay = (sub.checkInDates || []).includes(targetDay);
        if (isPresentOnDay) totalPresentInReport++;

        const rec = sub.checkInRecords?.find((r) => r.date === targetDay);
        const timeStr = rec?.timestamp
          ? new Date(rec.timestamp).toLocaleString("pt-BR")
          : (isPresentOnDay ? "Horário registrado" : "-");
        const validator = rec?.validatorName || (rec?.validatedBy === "self" ? "Pelo Próprio Participante" : (isPresentOnDay ? "Pelo Administrador" : "-"));

        trs += `
          <tr>
            <td class="border border-black p-2 text-center font-bold">${idx + 1}</td>
            <td class="border border-black p-2 uppercase font-semibold text-xs">${sub.member?.name || "Desconhecido"}</td>
            <td class="border border-black p-2 text-center text-xs">${sub.member?.ra || (sub.member as any)?.cpf || "-"}</td>
            <td class="border border-black p-2 text-[10px] uppercase">${rolesText || "-"}</td>
            <td class="border border-black p-2 text-center font-bold text-xs ${isPresentOnDay ? 'text-emerald-800 bg-emerald-50' : 'text-gray-500'}">
              ${isPresentOnDay ? "✓ PRESENTE" : "PENDENTE / AUSENTE"}
            </td>
            <td class="border border-black p-2 text-center text-[10px] font-mono">${timeStr}</td>
            <td class="border border-black p-2 text-center text-[10px] font-semibold">${validator}</td>
            <td class="border border-black p-2 align-bottom">
              ${isPresentOnDay 
                ? '<div class="text-[9px] text-center font-bold text-emerald-800">VALIDAÇÃO CONFIRMADA</div>'
                : '<div class="w-full h-7 border-b border-black border-dashed opacity-50"></div>'
              }
            </td>
          </tr>
        `;
      } else {
        const totalDaysPresent = sub.checkInDates?.length || (sub.status === "presente" ? 1 : 0);
        if (totalDaysPresent > 0) totalPresentInReport++;

        const recordsDetail = (sub.checkInDates && sub.checkInDates.length > 0)
          ? sub.checkInDates.map((dStr) => {
              const [dy, dm, dd] = dStr.split("-");
              const rec = sub.checkInRecords?.find((r) => r.date === dStr);
              const timeStr = rec?.timestamp ? new Date(rec.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
              const who = rec?.validatedBy === "self" ? "Próprio" : "Admin";
              return `${dd}/${dm} (${who}${timeStr ? ` às ${timeStr}` : ''})`;
            }).join("; ")
          : "-";

        trs += `
          <tr>
            <td class="border border-black p-2 text-center font-bold">${idx + 1}</td>
            <td class="border border-black p-2 uppercase font-semibold text-xs">${sub.member?.name || "Desconhecido"}</td>
            <td class="border border-black p-2 text-center text-xs">${sub.member?.ra || (sub.member as any)?.cpf || "-"}</td>
            <td class="border border-black p-2 text-[10px] uppercase">${rolesText || "-"}</td>
            <td class="border border-black p-2 text-center font-bold text-xs ${totalDaysPresent > 0 ? 'text-emerald-800 bg-emerald-50' : 'text-gray-500'}">
              ${totalDaysPresent > 0 ? `PRESENTE (${totalDaysPresent} dia${totalDaysPresent > 1 ? 's' : ''})` : "SEM PRESENÇA"}
            </td>
            <td class="border border-black p-2 text-[10px]">${recordsDetail}</td>
            <td class="border border-black p-2 align-bottom">
              <div class="w-full h-7 border-b border-black border-dashed opacity-50"></div>
            </td>
          </tr>
        `;
      }
    });

    const davveoIconSvg = settings.instLogo 
      ? `<img src="${settings.instLogo}" style="width: 38px; height: 38px; object-fit: contain;" alt="Logo" />` 
      : getDavveroSvgHtml('#0f172a', 38);

    const printContent = `
      <div class="text-center mb-6">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
          ${davveoIconSvg}
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">${settings.instName || "DAVVERO SYSTEM"}</div>
            <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Gestão Oficial de Eventos e Controle de Frequência</div>
          </div>
        </div>
        <h2 class="text-xl font-black uppercase tracking-widest border-b-2 border-black pb-2">
          Lista Oficial de Presença e Validação de Check-in
        </h2>
        <p class="text-sm font-bold mt-2 uppercase">${event?.title}</p>
        <div style="display: flex; justify-content: center; gap: 15px; font-size: 11px; margin-top: 6px; font-weight: 600; color: #334155;">
          <span>Referência: <strong>${formattedTargetDay}</strong></span>
          <span>•</span>
          <span>Total Inscritos: <strong>${listToPrint.length}</strong></span>
          <span>•</span>
          <span>Presentes Confirmados: <strong>${totalPresentInReport}</strong></span>
          <span>•</span>
          <span>Emissão: <strong>${new Date().toLocaleString("pt-BR")}</strong></span>
        </div>
      </div>

      <table class="w-full border-collapse border border-black text-xs">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-black p-2 w-8 text-center">#</th>
            <th class="border border-black p-2 text-left">NOME DO PARTICIPANTE</th>
            <th class="border border-black p-2 w-24 text-center">R.A. / CPF</th>
            <th class="border border-black p-2 text-left">VÍNCULO / DIOCESE</th>
            <th class="border border-black p-2 text-center w-28">STATUS</th>
            ${isSingleDay ? `
              <th class="border border-black p-2 text-center w-36">CARIMBO (DATA/HORA)</th>
              <th class="border border-black p-2 text-center w-36">VALIDADO POR</th>
              <th class="border border-black p-2 text-center w-36">RUBRICA / ASSINATURA</th>
            ` : `
              <th class="border border-black p-2 text-left">DIAS & CARIMBOS DE AUDITORIA</th>
              <th class="border border-black p-2 text-center w-36">ASSINATURA / RUBRICA</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>

      <div style="margin-top: 35px; display: flex; justify-content: space-around; font-size: 10px; text-transform: uppercase;">
        <div style="text-align: center; width: 230px;">
          <div style="border-bottom: 1px solid black; margin-bottom: 5px;"></div>
          <strong>Coordenação do Evento</strong>
        </div>
        <div style="text-align: center; width: 230px;">
          <div style="border-bottom: 1px solid black; margin-bottom: 5px;"></div>
          <strong>Secretaria Acadêmica / Direção</strong>
        </div>
      </div>

      <div class="mt-8 pt-4 border-t border-black text-center text-[10px] uppercase tracking-widest">
        Documento Oficial Gerado pelo DAVVERO System • Faculdade João Paulo II (FAJOPA)
      </div>
    `;

    printDocumentHtml(`Lista de Presenca - ${formattedTargetDay} - ${event?.title || "Evento"}`, printContent);
  };

  const handleExportCSV = () => {
    let toPrint = attendees;
    if (activeTab === "alunos") {
      toPrint = attendees.filter(a => !a.member?.roles?.includes("VISITANTE"));
    } else if (activeTab === "visitantes") {
      toPrint = attendees.filter(a => !!a.member?.roles?.includes("VISITANTE"));
    }

    const rows = [
      ["#", "NOME", "RA/CPF", "VINCULO/DIOCESE", "STATUS", "DIAS PRESENTES"]
    ];

    toPrint.forEach((sub, idx) => {
      const rolesText = [
        ...(sub.member?.roles || []),
        sub.member?.diocese ? `Diocese: ${sub.member?.diocese}` : ""
      ].filter(Boolean).join(" - ");

      const status = sub.status === "presente" ? "Presente" : "Inscrito";
      const dias = (sub.checkInDates || []).join(" | ");

      rows.push([
        String(idx + 1),
        sub.member?.name || "Desconhecido",
        sub.member?.ra || (sub.member as any)?.cpf || "-",
        rolesText,
        status,
        dias
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + rows.map(e => e.map(item => `"${(item || '').replace(/"/g, '""')}"`).join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_presencas_${event.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    let toPrint = attendees;
    let titleAddon = "Geral";
    
    if (activeTab === "alunos") {
      toPrint = attendees.filter(a => !a.member?.roles?.includes("VISITANTE"));
      titleAddon = "Categoria: Alunos / Seminaristas";
    } else if (activeTab === "visitantes") {
      toPrint = attendees.filter(a => !!a.member?.roles?.includes("VISITANTE"));
      titleAddon = "Categoria: Visitantes";
    }

    if (!toPrint || toPrint.length === 0) {
      showAlert(`Nenhum participante encontrado na categoria selecionada (${titleAddon}) para o relatório.`, { type: "warning" });
      return;
    }

    let trs = "";
    toPrint.forEach((sub, idx) => {
      const rolesText = [
        ...(sub.member?.roles || []),
        sub.member?.diocese ? `Diocese: ${sub.member?.diocese}` : ""
      ].filter(Boolean).join(" • ");

      const status = (sub.status === "presente" || sub.status === "apto_para_certificado") ? "Presente" : "Inscrito";
      const dias = (sub.checkInDates && sub.checkInDates.length > 0)
        ? sub.checkInDates.map(d => {
            const parts = d.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
            return d;
          }).join(", ")
        : (status === "Presente" ? "Presença confirmada" : "-");

      trs += `
        <tr>
          <td class="border border-black p-2 text-center font-bold">${idx + 1}</td>
          <td class="border border-black p-2 uppercase font-semibold">${sub.member?.name || "Desconhecido"}</td>
          <td class="border border-black p-2 text-center">${sub.member?.ra || (sub.member as any)?.cpf || "-"}</td>
          <td class="border border-black p-2 text-[10px] uppercase">${rolesText}</td>
          <td class="border border-black p-2 text-center font-bold ${status === 'Presente' ? 'text-green-600' : ''}">${status}</td>
          <td class="border border-black p-2 text-center text-[10px] font-semibold">${dias}</td>
        </tr>
      `;
    });

    const davveoIconSvgNest = settings.instLogo 
      ? `<img src="${settings.instLogo}" style="width: 38px; height: 38px; object-fit: contain;" alt="Logo" />` 
      : getDavveroSvgHtml('#0f172a', 38);

    const printContent = `
      <div class="text-center mb-6">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
          ${davveoIconSvgNest}
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">${settings.instName || "DAVVERO SYSTEM"}</div>
            <div style="font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Gestão de Eventos Acadêmicos & Diocesanos</div>
          </div>
        </div>
        <h2 class="text-xl font-black uppercase tracking-widest border-b-2 border-black pb-2">
          Relatório Oficial de Presenças
        </h2>
        <p class="text-sm font-bold mt-2 uppercase">${event?.title}</p>
        <p class="text-xs font-semibold mt-1 bg-gray-200 inline-block px-2 py-0.5 rounded">${titleAddon}</p>
        <p class="text-xs mt-1">
          Data de Início: ${event?.startDate ? new Date(event.startDate + "T12:00:00").toLocaleDateString("pt-BR") : "N/D"}
        </p>
      </div>
      <table class="w-full border-collapse border border-black text-xs">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-black p-2 w-8 text-center">#</th>
            <th class="border border-black p-2 text-left">NOME DO INSCRITO</th>
            <th class="border border-black p-2 w-24 text-center">R.A. / CPF</th>
            <th class="border border-black p-2 text-left">VÍNCULO / DIOCESE</th>
            <th class="border border-black p-2 text-center w-20">STATUS</th>
            <th class="border border-black p-2 text-center w-32">DIAS PRESENTES</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
      <div class="mt-8 pt-4 border-t border-black text-center text-[10px] uppercase tracking-widest">
        Documento Gerado pelo DAVVERO System • Faculdade João Paulo II (FAJOPA)
      </div>
    `;

    printDocumentHtml(`Relatório de Presenças - ${event?.title || "Evento"}`, printContent);
  };

  const inactiveAttendees = useMemo(() => {
    return attendees.filter((a) => a.member?.isActive === false);
  }, [attendees]);

  // Contagem por letra inicial para os botões do índice alfabético dos inscritos
  const attendeeLetterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    attendees.forEach(a => {
      const firstLetter = (a.member?.name || "").trim().charAt(0).toUpperCase();
      if (firstLetter) {
        counts[firstLetter] = (counts[firstLetter] || 0) + 1;
      }
    });
    return counts;
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      if (activeTab === "organizacao") return false; // Handled separately below
      
      // Regra mandatória: Membros inativos NUNCA aparecem nas abas normais para fazer check-in
      if (activeTab !== "inativos" && a.member?.isActive === false) return false;
      if (activeTab === "inativos" && a.member?.isActive !== false) return false;

      let matchTab = true;
      if (activeTab === "alunos") {
        matchTab = !a.member?.roles?.includes("VISITANTE");
      } else if (activeTab === "visitantes") {
        matchTab = !!a.member?.roles?.includes("VISITANTE");
      }
      if (!matchTab) return false;

      if (statusFilter === "present" && a.status !== "presente") return false;
      if (statusFilter === "pending" && a.status === "presente") return false;

      if (selectedAttendeeLetter) {
        const firstLetter = (a.member?.name || "").trim().charAt(0).toUpperCase();
        if (firstLetter !== selectedAttendeeLetter) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (a.member?.name || "").toLowerCase().includes(term) ||
        (a.member?.ra || "").toLowerCase().includes(term) ||
        (a.member as any)?.cpf?.includes(term)
      );
    }).sort((a, b) => {
      if (sortAttendeesBy === 'name-asc') {
        return (a.member?.name || '').localeCompare(b.member?.name || '', 'pt-BR', { sensitivity: 'base' });
      }
      if (sortAttendeesBy === 'name-desc') {
        return (b.member?.name || '').localeCompare(a.member?.name || '', 'pt-BR', { sensitivity: 'base' });
      }
      if (sortAttendeesBy === 'present-first') {
        if (a.status === 'presente' && b.status !== 'presente') return -1;
        if (a.status !== 'presente' && b.status === 'presente') return 1;
        return (a.member?.name || '').localeCompare(b.member?.name || '', 'pt-BR');
      }
      if (sortAttendeesBy === 'pending-first') {
        if (a.status !== 'presente' && b.status === 'presente') return -1;
        if (a.status === 'presente' && b.status !== 'presente') return 1;
        return (a.member?.name || '').localeCompare(b.member?.name || '', 'pt-BR');
      }
      return 0;
    });
  }, [attendees, activeTab, statusFilter, selectedAttendeeLetter, searchTerm, sortAttendeesBy]);

  const filteredOrganization = allMembers.filter((mbr) => {
    if (activeTab !== "organizacao") return false;
    
    // Default to showing only existing organizers if no search term, or show matched members
    const attendance = attendees.find(a => a.studentId === mbr.id);
    const isOrganizer = !!attendance?.isOrganizer;
    
    if (!searchTerm) {
      return isOrganizer;
    }
    
    const term = searchTerm.toLowerCase();
    return (
      mbr.name.toLowerCase().includes(term) ||
      mbr.ra?.toLowerCase().includes(term) ||
      (mbr as any).cpf?.includes(term)
    );
  });

  const attendeesWithPresence = useMemo(() => {
    return attendees.filter(
      (a) =>
        a.status === "presente" ||
        a.status === "apto_para_certificado" ||
        (a.checkInDates && a.checkInDates.length > 0)
    );
  }, [attendees]);

  const todayCheckInCount = useMemo(() => {
    return attendees.filter((a) => a.checkInDates && a.checkInDates.includes(todayStr)).length;
  }, [attendees, todayStr]);

  const totalCheckInsCount = useMemo(() => {
    return attendees.reduce(
      (acc, a) => acc + (a.checkInDates?.length || (a.status === "presente" ? 1 : 0)),
      0
    );
  }, [attendees]);

  // Contagem de presenças por dia
  const presenceCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    eventDays.forEach((day) => {
      map[day] = attendees.filter((a) => a.checkInDates && a.checkInDates.includes(day)).length;
    });
    return map;
  }, [eventDays, attendees]);

  const filteredPresences = useMemo(() => {
    return attendees.filter((a) => {
      // Regra de inativos
      if (a.member?.isActive === false) return false;

      // Filtro de status de presença
      const isPresent =
        a.status === "presente" ||
        a.status === "apto_para_certificado" ||
        (a.checkInDates && a.checkInDates.length > 0);

      if (presenceFilterStatus === "present" && !isPresent) return false;
      if (presenceFilterStatus === "absent" && isPresent) return false;

      // Filtro por dia específico
      if (selectedPresenceDay !== "all") {
        if (!a.checkInDates || !a.checkInDates.includes(selectedPresenceDay)) {
          return false;
        }
      }

      // Filtro de busca
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (a.member?.name || "").toLowerCase().includes(term) ||
        (a.member?.ra || "").toLowerCase().includes(term) ||
        (a.member as any)?.cpf?.includes(term)
      );
    }).sort((a, b) => {
      const datesA = a.checkInDates?.length || 0;
      const datesB = b.checkInDates?.length || 0;
      if (datesB !== datesA) return datesB - datesA;
      return (a.member?.name || "").localeCompare(b.member?.name || "", "pt-BR");
    });
  }, [attendees, presenceFilterStatus, selectedPresenceDay, searchTerm]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm print:static print:bg-transparent print:p-0 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl lg:max-w-5xl border border-slate-200 dark:border-slate-700/50 flex flex-col h-[94dvh] sm:h-auto sm:max-h-[92vh] print:hidden overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              Inscritos & Presença
            </h3>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {event.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Alternador Principal: Lista de Inscritos vs Lista de Presenças */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 bg-slate-50/60 dark:bg-slate-900/40 shrink-0">
          <button
            type="button"
            onClick={() => setMainView("inscritos")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              mainView === "inscritos"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 bg-white/70 dark:bg-slate-800/60 rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Lista de Inscritos</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {attendees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainView("presencas")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              mainView === "presencas"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white/70 dark:bg-slate-800/60 rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lista de Presenças</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {attendeesWithPresence.length}
            </span>
          </button>
        </div>

        {mainView === "inscritos" ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 mx-3 sm:mx-4 mt-3 rounded-xl overflow-x-auto no-scrollbar shrink-0 gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`shrink-0 sm:flex-1 whitespace-nowrap px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Todos ({attendees.length})
          </button>
          <button
            onClick={() => setActiveTab("alunos")}
            className={`shrink-0 sm:flex-1 whitespace-nowrap px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
              activeTab === "alunos"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Alunos / Seminaristas
          </button>
          <button
            onClick={() => setActiveTab("visitantes")}
            className={`shrink-0 sm:flex-1 whitespace-nowrap px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
              activeTab === "visitantes"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Visitantes
          </button>
          <button
            onClick={() => setActiveTab("organizacao")}
            className={`shrink-0 sm:flex-1 whitespace-nowrap px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${
              activeTab === "organizacao"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
             title="Membros da equipe de organização deste evento"
          >
            Organização
          </button>
          {inactiveAttendees.length > 0 && (
            <button
              onClick={() => setActiveTab("inativos")}
              className={`shrink-0 sm:flex-1 whitespace-nowrap px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "inativos"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              }`}
              title="Participantes inscritos com cadastro inativo no sistema (check-in bloqueado)"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Inativos ({inactiveAttendees.length})</span>
            </button>
          )}
        </div>

        <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
          {/* Action Row 1: Check-in de Todos & Adicionar Participante */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={handleCheckInAll}
                disabled={loading || attendees.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 disabled:opacity-50 cursor-pointer"
                title="Confirmar presença de todos os inscritos com 1 clique"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Check-in Todos</span>
                {attendees.filter((a) => a.status !== "presente").length > 0 && (
                  <span className="bg-emerald-800 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-black ml-0.5">
                    {attendees.filter((a) => a.status !== "presente").length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setAddSearch("");
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                title="Adicionar alunos ou participantes ao evento mesmo com prazo encerrado"
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>+ Adicionar</span>
              </button>

              {isSystemAdmin && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                  title="Gerar cartaz oficial com QR Code para lista de presença e horários (Exclusivo Administradores)"
                >
                  <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Cartaz QR Code</span>
                  <span className="sm:hidden">QR</span>
                </button>
              )}
            </div>

            <div className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
              <span>Total: <strong className="text-slate-800 dark:text-white font-bold">{attendees.length}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {attendees.filter((a) => a.status === "presente").length} presentes
              </span>
            </div>
          </div>

          {/* Action Row 2: Search and Print/Report Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, RA ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 shrink-0">
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handlePrint("all")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-slate-800 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Lista de Presença Completa (Assinatura)"
                >
                  <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Tudo
                </button>
                <button
                  onClick={() => handlePrint("alunos")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-slate-800 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Apenas Alunos e Seminaristas (Assinatura)"
                >
                  Alunos
                </button>
                <button
                  onClick={() => handlePrint("visitantes")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-slate-800 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Apenas Visitantes (Assinatura)"
                >
                  Visitantes
                </button>
              </div>
              {activeTab !== "organizacao" ? (
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700 shrink-0">
                  <button
                    onClick={handleExportCSV}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-emerald-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0"
                    title="Exportar Relatório em CSV"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={handlePrintReport}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-sky-600 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-sky-700 transition-colors shrink-0"
                    title="Imprimir Relatório de Presenças"
                  >
                    <FileText className="w-3 h-3" /> Relatório
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700 shrink-0">
                  <button
                    onClick={handleNotifyOrganizersEmail}
                    disabled={isSendingEmails}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 disabled:opacity-50 shadow-xs"
                    title="Enviar e-mail para todos os membros da organização informando que o certificado está disponível"
                  >
                    <Mail className="w-3 h-3" />
                    {isSendingEmails ? "Enviando..." : "Avisar (E-mail)"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row 3: Alphabetical Sorting & Letter Filter for Attendees */}
          {activeTab !== "organizacao" && (
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Ordem Alfabética */}
                  <div className="relative">
                    <select
                      value={sortAttendeesBy}
                      onChange={(e) => setSortAttendeesBy(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="name-asc">A → Z</option>
                      <option value="name-desc">Z → A</option>
                      <option value="present-first">Presentes 1º</option>
                      <option value="pending-first">Pendentes 1º</option>
                    </select>
                  </div>

                  {/* Status Presença */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="all">Presença: Todos</option>
                      <option value="present">Presentes</option>
                      <option value="pending">Pendentes</option>
                    </select>
                  </div>

                  {(selectedAttendeeLetter || statusFilter !== "all" || sortAttendeesBy !== "name-asc" || searchTerm) && (
                    <button
                      onClick={() => {
                        setSelectedAttendeeLetter("");
                        setStatusFilter("all");
                        setSortAttendeesBy("name-asc");
                        setSearchTerm("");
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-sky-600 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md"
                    >
                      <RotateCcw className="w-3 h-3" /> Limpar
                    </button>
                  )}
                </div>

                <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Mostrando <strong>{filteredAttendees.length}</strong> de <strong>{attendees.length}</strong>
                </div>
              </div>

              {/* Barra de Letras A-Z */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
                <button
                  onClick={() => setSelectedAttendeeLetter("")}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold shrink-0 transition-all ${
                    selectedAttendeeLetter === ""
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  Todas
                </button>
                {ALPHABET.map((letter) => {
                  const count = attendeeLetterCounts[letter] || 0;
                  const isSelected = selectedAttendeeLetter === letter;
                  const hasItems = count > 0;
                  return (
                    <button
                      key={letter}
                      disabled={!hasItems}
                      onClick={() => setSelectedAttendeeLetter(isSelected ? "" : letter)}
                      className={`min-w-[22px] h-5 sm:h-6 px-1 rounded text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-0.5 shrink-0 transition-all ${
                        isSelected
                          ? "bg-sky-600 text-white"
                          : hasItems
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700"
                          : "opacity-25 text-slate-400 cursor-not-allowed"
                      }`}
                      title={hasItems ? `Letra ${letter}: ${count} inscrito(s)` : `Nenhum inscrito com letra ${letter}`}
                    >
                      <span>{letter}</span>
                      {hasItems && <span className={`text-[8px] ${isSelected ? "text-sky-100" : "text-slate-400"}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
            </div>
          ) : activeTab === "organizacao" ? (
            filteredOrganization.length === 0 ? (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8 font-medium">
                Nenhum membro encontrado. Use a busca para encontrar membros e adicioná-los à organização.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredOrganization.map((mbr) => {
                  const attendance = attendees.find(a => a.studentId === mbr.id);
                  const isOrganizer = !!attendance?.isOrganizer;
                  return (
                    <div
                      key={mbr.id}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${isOrganizer ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        {mbr?.photoUrl ? (
                          <img
                            src={mbr.photoUrl}
                            alt={mbr?.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xl font-bold">
                            {mbr?.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200">
                            {mbr?.name || "Aluno Excluído"}
                          </h4>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 flex flex-wrap gap-x-2 gap-y-1">
                            {mbr?.ra && <span>RA: {mbr.ra}</span>}
                            {(mbr as any)?.cpf && <span>CPF: {(mbr as any).cpf}</span>}
                            {mbr?.alphaCode && (
                              <span>ID: {mbr.alphaCode}</span>
                            )}
                            {mbr?.course && (
                              <span>
                                <span className="text-slate-300 dark:text-slate-600 px-1">
                                  •
                                </span>
                                {mbr.course}
                              </span>
                            )}
                            {mbr?.roles && mbr.roles.length > 0 && (
                              <span>
                                <span className="text-slate-300 dark:text-slate-600 px-1">
                                  •
                                </span>
                                {mbr.roles.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
                        <button
                          onClick={() => handleToggleOrganizer(event.id, mbr.id, isOrganizer)}
                          className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${
                            isOrganizer
                              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-500 hover:border-amber-200 dark:hover:border-amber-500/30"
                          }`}
                          title={isOrganizer ? "Remover da equipe de organização" : "Adicionar à equipe de organização"}
                        >
                          <Star className={`w-4 h-4 ${isOrganizer ? "fill-white" : ""}`} /> {isOrganizer ? "Organizador" : "Adicionar como Organizador"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredAttendees.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8 font-medium">
              Nenhum inscrito encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAttendees.map((a, index) => {
                const currentLetter = (a.member?.name || "").trim().charAt(0).toUpperCase();
                const prevMember = index > 0 ? filteredAttendees[index - 1] : null;
                const prevLetter = prevMember ? (prevMember.member?.name || "").trim().charAt(0).toUpperCase() : null;
                const showLetterDivider = (sortAttendeesBy === "name-asc" || sortAttendeesBy === "name-desc") && (!selectedAttendeeLetter) && (currentLetter !== prevLetter);

                return (
                  <React.Fragment key={a.id}>
                    {showLetterDivider && (
                      <div className="flex items-center gap-2 pt-2.5 pb-0.5 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
                        <span className="w-5 h-5 rounded-md bg-sky-600 text-white flex items-center justify-center font-mono text-[11px] font-black shadow-xs">
                          {currentLetter}
                        </span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                          Letra {currentLetter}
                        </span>
                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700/60" />
                      </div>
                    )}
                    <div
                      className="bg-white dark:bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-sky-300 dark:hover:border-sky-700/60 transition-all"
                    >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {a.member?.photoUrl ? (
                      <img
                        src={a.member.photoUrl}
                        alt={a.member?.name}
                        className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-sky-800 dark:text-sky-300 text-xl font-black shrink-0 border border-sky-100 dark:border-slate-600 shadow-2xs">
                        {a.member?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
                          {a.member?.name || "Aluno Excluído"}
                        </h4>
                        {a.isOrganizer && (
                          <span className="inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <Star className="w-3 h-3 fill-amber-500" /> Org
                          </span>
                        )}
                        {a.member?.isActive === false && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" /> Inativo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1.5 flex flex-wrap items-center gap-1.5">
                        {a.member?.ra && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            RA: <strong>{a.member.ra}</strong>
                          </span>
                        )}
                        {(a.member as any)?.cpf && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            CPF: <strong>{(a.member as any).cpf}</strong>
                          </span>
                        )}
                        {a.member?.alphaCode && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                            ID: {a.member.alphaCode}
                          </span>
                        )}
                        {a.member?.course && (
                          <span className="bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-300 font-semibold">
                            {a.member.course}
                          </span>
                        )}
                        {a.member?.diocese && (
                          <span className="bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/80 text-purple-800 dark:text-purple-300 font-semibold">
                            Diocese: {a.member.diocese}
                          </span>
                        )}
                        {a.member?.roles && a.member.roles.length > 0 && (
                          <span className="bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[11px]">
                            {a.member.roles.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleToggleOrganizer(event.id, a.studentId, !!a.isOrganizer)}
                      className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${
                        a.isOrganizer
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 hover:bg-amber-100"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-600 hover:bg-amber-50/50"
                      }`}
                      title={a.isOrganizer ? "Remover da equipe de organização" : "Adicionar à equipe de organização"}
                    >
                      <Star className={`w-4 h-4 ${a.isOrganizer ? "fill-amber-500" : ""}`} />
                      <span>{a.isOrganizer ? "Organizador" : "Org"}</span>
                    </button>
                    {a.member?.isActive === false ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          Cadastro Inativo
                        </span>
                        {a.status === "presente" && (
                          <button
                            onClick={() => handleCancelCheckIn(a.id, a.member?.name || "Participante")}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Cancelar Check-in: Reverte a presença deste membro inativo"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span>Desfazer Presença</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove este membro inativo do evento"
                        >
                          <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span>Remover</span>
                        </button>
                      </div>
                    ) : a.status === "presente" ||
                    a.status === "apto_para_certificado" ? (
                      <>
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle className="w-4 h-4" /> Presente
                          </span>
                          {a.checkInDates && a.checkInDates.length > 0 && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                              {a.checkInDates.length} dia{a.checkInDates.length > 1 ? 's' : ''}: {a.checkInDates.map(d => {
                                const [y,m,day] = d.split('-');
                                return `${day}/${m}`;
                              }).join(', ')}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleCancelCheckIn(a.id, a.member?.name || "Participante")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Check-in: Reverte a presença para inscrito caso tenha marcado por engano"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="hidden sm:inline">Desfazer Presença</span>
                        </button>

                        {/* Remover ou Restaurar Certificado do Aluno */}
                        {(() => {
                          const certKey = `${event.id}_participant`;
                          const isCertRevoked = a.revokedParticipantCert === true || (a.member as any)?.revokedCertKeys?.includes(certKey);
                          if (isCertRevoked) {
                            return (
                              <button
                                onClick={() => handleToggleCertificateRevocation(a, false)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                title="Restaurar certificado deste participante para este evento"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">Restaurar Certificado</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              onClick={() => setCertRevokeTarget(a)}
                              className="flex items-center gap-1.5 px-2.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title="Remover certificado deste participante para este evento"
                            >
                              <Award className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span className="hidden sm:inline">Remover Certificado</span>
                            </button>
                          );
                        })()}

                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove o participante do evento"
                        >
                          <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="hidden sm:inline">Remover</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkPresent(a.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                          title="Fazer Check-in manual / Confirmar presença"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Fazer Check-in</span>
                        </button>
                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove o participante do evento"
                        >
                          <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <span className="hidden sm:inline">Remover</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
          )}
        </div>
      </div>
        ) : (
          /* ======================================================== */
          /* ABA DEDICADA DE PRESENÇAS / CHECK-INS POR DIA */
          /* ======================================================== */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* 1. Métricas de Presença (Versão Compacta para Economizar Espaço no Smartphone) */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="bg-white dark:bg-slate-800 px-1 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs text-center flex flex-col justify-center">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Compareceram</span>
                <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                  <span className="text-xs sm:text-base font-black text-emerald-600 dark:text-emerald-400">{attendeesWithPresence.length}</span>
                  <span className="text-[10px] text-slate-400 font-medium">/{attendees.length}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 px-1 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs text-center flex flex-col justify-center">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Hoje</span>
                <div className="mt-0.5">
                  <span className="text-xs sm:text-base font-black text-sky-600 dark:text-sky-400">{todayCheckInCount}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 px-1 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs text-center flex flex-col justify-center">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Total</span>
                <div className="mt-0.5">
                  <span className="text-xs sm:text-base font-black text-indigo-600 dark:text-indigo-400">{totalCheckInsCount}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 px-1 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs text-center flex flex-col justify-center">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Pendentes</span>
                <div className="mt-0.5">
                  <span className="text-xs sm:text-base font-black text-amber-600 dark:text-amber-400">{attendees.length - attendeesWithPresence.length}</span>
                </div>
              </div>
            </div>

            {/* 2. Seletor de Dias do Evento (Compacto e com Indicação dos Dias Oficiais) */}
            {eventDays.length > 0 && (
              <div className="px-2 sm:px-3 py-1 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dias:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPresenceDay("all")}
                    className={`shrink-0 px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all cursor-pointer ${
                      selectedPresenceDay === "all"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    Todos ({attendeesWithPresence.length})
                  </button>
                  {eventDays.map((day) => {
                    const [y, m, d] = day.split("-");
                    const formatted = `${d}/${m}`;
                    const count = presenceCountByDay[day] || 0;
                    const isSelected = selectedPresenceDay === day;
                    const isOfficialDay = officialEventDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedPresenceDay(day)}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                        title={isOfficialDay ? `Dia oficial do evento (${formatted})` : `Data registrada (${formatted})`}
                      >
                        <span>{formatted}</span>
                        {isOfficialDay && (
                          <span className={`text-[8px] uppercase tracking-wider px-1 py-0.2 rounded font-black ${
                            isSelected ? "bg-emerald-800 text-white" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          }`}>
                            Oficial
                          </span>
                        )}
                        <span className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Barra de Controles e Filtros de Presença (Design Compacto e Prático) */}
            <div className="px-2 py-1.5 sm:px-3 sm:py-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 shrink-0 bg-white dark:bg-slate-900">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar presente por nome, RA ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 shrink-0">
                <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] sm:text-xs font-semibold w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setPresenceFilterStatus("all")}
                    className={`px-1.5 sm:px-2 py-1 rounded-md transition-all text-center cursor-pointer ${
                      presenceFilterStatus === "all"
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    Todos ({attendees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilterStatus("present")}
                    className={`px-1.5 sm:px-2 py-1 rounded-md transition-all text-center cursor-pointer ${
                      presenceFilterStatus === "present"
                        ? "bg-emerald-600 text-white shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    Presentes ({attendeesWithPresence.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilterStatus("absent")}
                    className={`px-1.5 sm:px-2 py-1 rounded-md transition-all text-center cursor-pointer ${
                      presenceFilterStatus === "absent"
                        ? "bg-amber-600 text-white shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    Ausentes ({attendees.length - attendeesWithPresence.length})
                  </button>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCheckInAll}
                    className="flex-1 sm:flex-initial justify-center px-2 sm:px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Fazer check-in de todos os participantes para o dia do evento"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Check-in Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenBulkResetModal}
                    className="flex-1 sm:flex-initial justify-center px-2 sm:px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Desfazer/remover check-ins caso o administrador tenha feito algo incorreto"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Desfazer Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintPresenceAuditList(selectedPresenceDay)}
                    className="flex-1 sm:flex-initial justify-center px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Imprimir lista oficial de presença com carimbos e auditoria"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span className="hidden xs:inline">Imprimir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="flex-1 sm:flex-initial justify-center px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] sm:text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Abrir QR Code para escaneamento de presença pelos participantes"
                  >
                    <ScanLine className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Lista de Participantes e Histórico de Presenças */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
              {filteredPresences.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-400">Nenhum registro de presença encontrado.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Tente ajustar os filtros de busca ou de dias do evento.</p>
                </div>
              ) : (
                filteredPresences.map((a, index) => {
                  const isPresent =
                    a.status === "presente" ||
                    a.status === "apto_para_certificado" ||
                    (a.checkInDates && a.checkInDates.length > 0);
                  const datesList = a.checkInDates && Array.isArray(a.checkInDates) ? a.checkInDates : [];
                  const hasToday = datesList.includes(todayStr);

                  return (
                    <div
                      key={a.studentId || a.id}
                      className={`p-3 sm:p-4.5 rounded-2xl border transition-all flex flex-col gap-3 ${
                        isPresent
                          ? "bg-white dark:bg-slate-800/90 border-emerald-300/80 dark:border-emerald-800/60 shadow-2xs"
                          : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60"
                      }`}
                    >
                      {/* Bloco Superior: Identificação do Aluno */}
                      <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0">
                        <div className="text-xs font-black text-slate-400 w-4 sm:w-5 text-right shrink-0 mt-1">
                          {index + 1}.
                        </div>

                        {a.member?.photoUrl ? (
                          <img
                            src={a.member.photoUrl}
                            alt={a.member.name}
                            className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-emerald-800 dark:text-emerald-300 text-lg sm:text-xl font-black shrink-0 border border-emerald-100 dark:border-slate-600 shadow-2xs">
                            {a.member?.name ? a.member.name.substring(0, 1).toUpperCase() : <User className="w-5 h-5 sm:w-6 sm:h-6" />}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h4 className="font-black text-sm sm:text-base md:text-lg text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
                              {a.member?.name || "Participante"}
                            </h4>

                            {a.isOrganizer && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                                <Star className="w-3 h-3 fill-amber-500" /> Org
                              </span>
                            )}

                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                                <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Presente ({datesList.length || 1}d)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 shrink-0">
                                <Clock className="w-3 h-3" /> Ausente
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 flex flex-wrap items-center gap-1 sm:gap-1.5">
                            {a.member?.ra && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                                RA: <strong>{a.member.ra}</strong>
                              </span>
                            )}
                            {(a.member as any)?.cpf && (
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                                CPF: <strong>{(a.member as any).cpf}</strong>
                              </span>
                            )}
                            {a.member?.course && (
                              <span className="bg-sky-50 dark:bg-sky-950/40 px-1.5 sm:px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-300 font-semibold truncate max-w-[160px] sm:max-w-none">
                                {a.member.course}
                              </span>
                            )}
                            {a.member?.diocese && (
                              <span className="bg-purple-50 dark:bg-purple-950/40 px-1.5 sm:px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/80 text-purple-800 dark:text-purple-300 font-semibold truncate max-w-[140px] sm:max-w-none">
                                {a.member.diocese}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bloco de Presenças Registradas & Auditoria (Clean e Responsivo para Smartphone) */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Presenças & Auditoria ({datesList.length})</span>
                        </div>

                        {datesList.length === 0 ? (
                          <div className="text-xs text-slate-400 italic py-0.5">
                            Nenhum check-in efetuado ainda neste evento.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                            {datesList.map((dateStr) => {
                              const [y, m, d] = dateStr.split("-");
                              const formatted = `${d}/${m}/${y}`;
                              const rec = a.checkInRecords?.find((r) => r.date === dateStr);
                              const isValidatedBySelf = rec?.validatedBy === "self";
                              const timeFormatted = rec?.timestamp
                                ? new Date(rec.timestamp).toLocaleString("pt-BR")
                                : null;

                              return (
                                <div
                                  key={dateStr}
                                  className="p-2 sm:p-2.5 bg-slate-50/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs flex flex-col gap-1.5 shadow-2xs"
                                >
                                  {/* Linha 1: Data e botão de remover */}
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-100 text-xs">
                                      <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <span>Dia {formatted}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePresenceDate(a, dateStr)}
                                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                      title={`Remover presença do dia ${formatted}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Linha 2: Tipo de validação e horário */}
                                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                    {isValidatedBySelf ? (
                                      <span
                                        className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60"
                                        title="Validado pelo próprio participante via QR Code"
                                      >
                                        <ScanLine className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>Auto QR</span>
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-100/90 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60"
                                        title="Validado por administrador"
                                      >
                                        <ShieldCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                        <span className="truncate max-w-[120px]">{rec?.validatorName || "Administrador"}</span>
                                      </span>
                                    )}

                                    {timeFormatted && (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium ml-auto"
                                        title={`Horário registrado: ${timeFormatted}`}
                                      >
                                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>{timeFormatted}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Bloco Inferior: Barra de Ações (Otimizada para Mobile e Desktop) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-2 sm:pt-2.5 border-t border-slate-100 dark:border-slate-800/80 justify-end">
                        {/* Botão + Adicionar Data */}
                        <button
                          type="button"
                          onClick={() => {
                            setPresenceDateModalAttendee(a);
                            setCustomPresenceDate(defaultEventCheckInDay);
                          }}
                          className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs"
                          title="Adicionar uma data de presença para este participante"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 dark:text-sky-400" />
                          <span>+ Data</span>
                        </button>

                        {/* Botões de Check-in específicos dos Dias do Evento */}
                        {(() => {
                          if (selectedPresenceDay !== "all") {
                            const hasSelected = datesList.includes(selectedPresenceDay);
                            if (hasSelected) return null;
                            const [sy, sm, sd] = selectedPresenceDay.split("-");
                            return (
                              <button
                                type="button"
                                onClick={() => handleMarkPresent(a.id, a.allDocIds, selectedPresenceDay)}
                                className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                                title={`Registrar presença para o dia ${sd}/${sm}/${sy} com carimbo de ${currentAdminAuditName}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>Check-in ({sd}/${sm})</span>
                              </button>
                            );
                          }

                          // Se visualizando todos os dias:
                          if (officialEventDays.length > 0) {
                            const pendingDays = officialEventDays.filter((d) => !datesList.includes(d));
                            if (pendingDays.length === 0) return null;

                            return pendingDays.slice(0, 2).map((pDay) => {
                              const [py, pm, pd] = pDay.split("-");
                              const isToday = pDay === todayStr;
                              return (
                                <button
                                  key={pDay}
                                  type="button"
                                  onClick={() => handleMarkPresent(a.id, a.allDocIds, pDay)}
                                  className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                                  title={`Registrar presença para o dia ${pd}/${pm}/${py} com carimbo de ${currentAdminAuditName}`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  <span>Check-in {isToday ? `Hoje (${pd}/${pm})` : `(${pd}/${pm})`}</span>
                                </button>
                              );
                            });
                          }

                          // Fallback caso não haja dias cadastrados no evento
                          if (!hasToday) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleMarkPresent(a.id, a.allDocIds, todayStr)}
                                className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                                title={`Registrar presença para a data de hoje`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>Check-in Hoje</span>
                              </button>
                            );
                          }
                          return null;
                        })()}

                        {/* Botão Desfazer / Remover Todas as Presenças do Participante */}
                        {isPresent && (
                          <button
                            type="button"
                            onClick={() => handleCancelCheckIn(a.id, a.member?.name || "Participante", a.allDocIds)}
                            className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Remover todas as presenças deste participante caso tenha havido erro de registro"
                          >
                            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400" />
                            <span>Desfazer Check-ins</span>
                          </button>
                        )}

                        {/* Gestão de Certificado no Evento: Remover ou Restaurar */}
                        {(() => {
                          const certKey = `${event.id}_participant`;
                          const isCertRevoked = a.revokedParticipantCert === true || (a.member as any)?.revokedCertKeys?.includes(certKey);

                          if (isCertRevoked) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleToggleCertificateRevocation(a, false)}
                                className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                title="Restaurar certificado do participante para este evento"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Restaurar Certificado</span>
                              </button>
                            );
                          }

                          if (isPresent) {
                            return (
                              <button
                                type="button"
                                onClick={() => setCertRevokeTarget(a)}
                                className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                title="Remover certificado deste participante para este evento"
                              >
                                <Award className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>Remover Certificado</span>
                              </button>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- ÁREA DE IMPRESSÃO (Oculta na tela, Visível apenas na impressora) --- */}
      <div
        id="print-area"
        className="hidden w-full text-black bg-white"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-2 border-black pb-2">
            Lista Oficial de Presença
          </h2>
          <p className="text-sm font-bold mt-2 uppercase">{event?.title}</p>
          <p className="text-xs mt-1">
            Data de Início:{" "}
            {event?.startDate
              ? new Date(event.startDate).toLocaleDateString("pt-BR")
              : "N/D"}
          </p>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-8 text-center">#</th>
              <th className="border border-black p-2 text-left">
                NOME DO INSCRITO
              </th>
              <th className="border border-black p-2 w-24 text-center">R.A.</th>
              <th className="border border-black p-2 text-left">
                VÍNCULO / DIOCESE
              </th>
              <th className="border border-black p-2 w-48 text-center">
                ASSINATURA DO ALUNO
              </th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((sub, idx) => (
              <tr key={sub.id || idx}>
                <td className="border border-black p-2 text-center font-bold">
                  {idx + 1}
                </td>
                <td className="border border-black p-2 uppercase font-semibold">
                  {sub.member?.name}
                </td>
                <td className="border border-black p-2 text-center">
                  {sub.member?.ra || (sub.member as any)?.cpf || "-"}
                </td>
                <td className="border border-black p-2 text-[10px] uppercase">
                  {sub.member?.roles?.join(", ")}{" "}
                  {sub.member?.diocese ? ` • ${sub.member?.diocese}` : ""}
                </td>
                <td className="border border-black p-2 align-bottom">
                  <div className="w-full h-8 border-b border-black border-dashed opacity-50"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-black text-center text-[10px] uppercase tracking-widest">
          Documento Gerado pelo DAVVERO System • Faculdade João Paulo II (FAJOPA)
        </div>
      </div>

      <Modal
        isOpen={!!confirmModal?.isOpen}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title || "Confirmação"}
        confirmLabel="Confirmar"
        confirmVariant={confirmModal?.confirmVariant || "danger"}
        onConfirm={confirmModal?.onConfirm}
      >
        <p className="text-slate-600 dark:text-slate-400">
          {confirmModal?.message}
        </p>
      </Modal>

      {/* --- MODAL ADICIONAR PARTICIPANTE (ADMIN OVERRIDE) --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    Adicionar Participante ao Evento
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Inscrição administrativa direta • Válida mesmo após término de prazos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800/60 p-1 mx-5 mt-4 rounded-xl">
              <button
                onClick={() => setAddTab("members")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  addTab === "members"
                    ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                Alunos / Membros Cadastrados
              </button>
              <button
                onClick={() => setAddTab("visitor")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  addTab === "visitor"
                    ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                Cadastrar Novo Visitante
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto">
              {addTab === "members" ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por Nome, RA, CPF, Curso ou Diocese..."
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {allMembers
                      .filter((m) => m.isActive !== false)
                      .filter((m) => {
                        if (!addSearch.trim()) return true;
                        const q = addSearch.toLowerCase();
                        return (
                          m.name?.toLowerCase().includes(q) ||
                          m.ra?.toLowerCase().includes(q) ||
                          m.cpf?.toLowerCase().includes(q) ||
                          m.course?.toLowerCase().includes(q) ||
                          m.diocese?.toLowerCase().includes(q) ||
                          m.seminary?.toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 40)
                      .map((mbr) => {
                        const isAlreadyEnrolled = attendees.some((a) => a.studentId === mbr.id);
                        return (
                          <div
                            key={mbr.id}
                            className="p-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {mbr.photoUrl ? (
                                <img
                                  src={mbr.photoUrl}
                                  alt={mbr.name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold shrink-0">
                                  {mbr.name?.substring(0, 1) || <User className="w-5 h-5" />}
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                  {mbr.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {mbr.ra ? `RA: ${mbr.ra}` : mbr.cpf ? `CPF: ${mbr.cpf}` : ""}
                                  {mbr.course ? ` • ${mbr.course}` : ""}
                                  {mbr.diocese ? ` • ${mbr.diocese}` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {isAlreadyEnrolled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Já Inscrito
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEnrollMember(mbr, false)}
                                    disabled={isAdding}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    Inscrever
                                  </button>
                                  <button
                                    onClick={() => handleEnrollMember(mbr, true)}
                                    disabled={isAdding}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Inscrever + Check-in
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Pe. João Silva"
                      value={visitorForm.name}
                      onChange={(e) =>
                        setVisitorForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        CPF ou Documento
                      </label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={visitorForm.cpf}
                        onChange={(e) =>
                          setVisitorForm((prev) => ({ ...prev, cpf: e.target.value }))
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
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
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Diocese / Instituição
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Diocese de Marília"
                        value={visitorForm.diocese}
                        onChange={(e) =>
                          setVisitorForm((prev) => ({ ...prev, diocese: e.target.value }))
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Categoria / Vínculo
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Visitante / Convidado"
                        value={visitorForm.course}
                        onChange={(e) =>
                          setVisitorForm((prev) => ({ ...prev, course: e.target.value }))
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleEnrollNewVisitor(false)}
                      disabled={isAdding || !visitorForm.name.trim()}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Inscrever Visitante
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnrollNewVisitor(true)}
                      disabled={isAdding || !visitorForm.name.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Cadastrar, Inscrever & Fazer Check-in
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <EventQrCodeModal
          event={currentEvent}
          initialMode="attendance"
          onClose={() => setShowQrModal(false)}
          onEventUpdated={(updated) => setCurrentEvent(updated)}
        />
      )}

      {presenceDateModalAttendee && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Adicionar Presença por Data
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {presenceDateModalAttendee.member?.name || "Participante"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPresenceDateModalAttendee(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {eventDays.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Dias do Evento (Selecione para registrar):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {eventDays.map((day) => {
                    const [y, m, d] = day.split("-");
                    const isAlreadyPresent = presenceDateModalAttendee.checkInDates?.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleAddPresenceDate(presenceDateModalAttendee, day)}
                        disabled={isAlreadyPresent}
                        className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all border ${
                          isAlreadyPresent
                            ? "bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                            : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-pointer"
                        }`}
                      >
                        <span>📅 {d}/{m}/{y}</span>
                        {isAlreadyPresent ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Presente</span>
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ou selecione outra data:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customPresenceDate}
                  onChange={(e) => setCustomPresenceDate(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddPresenceDate(presenceDateModalAttendee, customPresenceDate)}
                  disabled={!customPresenceDate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPresenceDateModalAttendee(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL DE CHECK-IN EM MASSA (TODOS DE UMA VEZ) --- */}
      {showBulkCheckInModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 dark:text-slate-100 text-base">
                    Check-in de Todos de Uma Vez
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Validação coletiva de presenças
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkCheckInModal(false)}
                disabled={isExecutingBulkCheckIn}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Selecione o dia do evento para o qual deseja registrar a presença de todos os participantes ativos. Cada registro receberá o <strong>carimbo do administrador</strong> e data/hora oficial no relatório.
            </p>

            {eventDays.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Dias do Evento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {eventDays.map((day) => {
                    const [y, m, d] = day.split("-");
                    const formatted = `${d}/${m}/${y}`;
                    const isSelected = bulkCheckInTargetDay === day;
                    const countPresent = attendees.filter((a) => a.checkInDates?.includes(day)).length;
                    const pendingCount = attendees.filter((a) => a.member?.isActive !== false && !a.checkInDates?.includes(day)).length;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setBulkCheckInTargetDay(day)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{formatted}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} ({countPresent} já presente{countPresent !== 1 ? 's' : ''})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Data do Check-in:
              </label>
              <input
                type="date"
                value={bulkCheckInTargetDay}
                onChange={(e) => setBulkCheckInTargetDay(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta ação registrará presença imediata para todos os participantes que ainda não possuem check-in na data escolhida, gerando o carimbo de validação com auditoria.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkCheckInModal(false)}
                disabled={isExecutingBulkCheckIn}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkCheckIn}
                disabled={!bulkCheckInTargetDay || isExecutingBulkCheckIn}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExecutingBulkCheckIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Check-in de Todos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE REMOÇÃO / DESFAZER CHECK-INS EM MASSA --- */}
      {showBulkResetModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 dark:text-slate-100 text-base">
                    Desfazer Check-ins em Massa
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Reverter presenças de participantes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkResetModal(false)}
                disabled={isExecutingBulkReset}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Caso tenha ocorrido algum erro no registro, você pode reverter as presenças. Os participantes afetados retornarão com segurança para o status de <strong>"Inscrito"</strong>.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecione o que deseja remover:
              </label>

              {/* Opção 1: Todos os dias do evento */}
              <button
                type="button"
                onClick={() => setBulkResetTargetDay("all_days")}
                className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  bulkResetTargetDay === "all_days"
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200"
                }`}
              >
                <div>
                  <div className="font-bold text-xs sm:text-sm">Remover TODOS os check-ins de TODOS os dias</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Zera todas as presenças registradas no evento ({attendeesWithPresence.length} participante{attendeesWithPresence.length !== 1 ? 's' : ''} com presença)
                  </div>
                </div>
                {bulkResetTargetDay === "all_days" && (
                  <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 ml-2" />
                )}
              </button>

              {/* Opções por dia individual */}
              {eventDays.map((day) => {
                const [y, m, d] = day.split("-");
                const count = presenceCountByDay[day] || 0;
                const isSelected = bulkResetTargetDay === day;
                const isOfficialDay = officialEventDays.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setBulkResetTargetDay(day)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>Remover apenas presenças do Dia {d}/{m}/{y}</span>
                        {isOfficialDay && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                            Oficial
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {count} participante{count !== 1 ? 's' : ''} com presença nesta data
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta ação atualizará o status dos participantes para <strong>"Inscrito"</strong>. Você poderá realizar novos check-ins a qualquer momento.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkResetModal(false)}
                disabled={isExecutingBulkReset}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkReset}
                disabled={isExecutingBulkReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExecutingBulkReset ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Remoção</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {certRevokeTarget && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Remover Certificado do Aluno?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Revogação do certificado para este evento
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Aluno:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {certRevokeTarget.member?.name || "Participante"}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Evento:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{event.title}</p>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700/50">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Situação:</span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  {certRevokeTarget.status === "apto_para_certificado" ? "Apto para certificado" : "Presença confirmada"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tem certeza de que deseja remover o certificado de <strong>{certRevokeTarget.member?.name || "participante"}</strong> deste evento? Ele não poderá mais visualizar nem baixar o documento. Você poderá restaurar a qualquer momento.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isRevokingCert}
                onClick={() => setCertRevokeTarget(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRevokingCert}
                onClick={() => handleToggleCertificateRevocation(certRevokeTarget, true)}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isRevokingCert ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Remoção</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
