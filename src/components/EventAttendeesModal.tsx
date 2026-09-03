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
  Filter
} from "lucide-react";
import type { Event, Attendance, Member } from "../types";
import {
  db,
  appId,
  unsubscribeFromEvent,
  updateAttendanceDetails,
  updateAttendanceStatus,
  removeAttendancePresence,
  enrollStudent
} from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
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

// Global in-memory cache to prevent repeated student reads from exhausting Firebase quota
interface CachedStudentsLookup {
  timestamp: number;
  membersDict: Record<string, Member>;
  activeMembers: Member[];
}
let globalStudentsLookupCache: CachedStudentsLookup | null = null;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
  const [attendees, setAttendees] = useState<
    (Attendance & { member?: Member })[]
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

  const loadData = async () => {
    try {
      setLoading(true);
      const attendancesSnap = await getDocs(
        query(
          collection(db, `artifacts/${appId}/public/data/attendances`),
          where("eventId", "==", event.id)
        )
      );
      const eventAttendances = attendancesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Attendance))
        .filter((a) => a.status !== ("cancelado" as any));

      let currentAllM = allMembers;
      let currentMembersDict: Record<string, Member> = {};

      // Check global in-memory cache to save Firebase quota (valid for 2 minutes)
      const nowMs = Date.now();
      if (globalStudentsLookupCache && nowMs - globalStudentsLookupCache.timestamp < 120000) {
        currentMembersDict = globalStudentsLookupCache.membersDict;
        currentAllM = globalStudentsLookupCache.activeMembers;
        setAllMembers(currentAllM);
      } else if (currentAllM.length === 0) {
        const membersSnap = await getDocs(
          query(collection(db, `artifacts/${appId}/public/data/students`)),
        );
        const membersDict: Record<string, Member> = {};
        const allM: Member[] = [];
        membersSnap.docs.forEach((d) => {
          if (!d.id.startsWith("_")) {
            const mbr = { id: d.id, ...d.data() } as Member;
            if (mbr.deletedAt) return; // Only ignore deleted
            membersDict[d.id] = mbr;
            if (mbr.isActive !== false) {
              allM.push(mbr); // Inactive members will NOT appear in the list for check-in / adding
            }
          }
        });
        currentAllM = allM;
        currentMembersDict = membersDict;
        setAllMembers(allM);
        globalStudentsLookupCache = {
          timestamp: nowMs,
          membersDict,
          activeMembers: allM,
        };
      } else {
        currentAllM.forEach((mbr) => {
          currentMembersDict[mbr.id!] = mbr;
        });
      }

      const enriched = eventAttendances.map((a: Attendance) => ({
        ...a,
        member: currentMembersDict[a.studentId],
      }));

      setAttendees(enriched);
    } catch (err) {
      console.error("Failed to load attendees", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [event.id]);

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

  const handleCancelCheckIn = (attendanceId: string, memberName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Cancelar Check-in",
      confirmVariant: "primary",
      message: `Deseja cancelar o check-in de "${memberName}"? A presença será desfeita e o status retornará para "Inscrito".`,
      onConfirm: async () => {
        try {
          await removeAttendancePresence(attendanceId);
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

  const handleRemovePresence = async (attendanceId: string) => {
    handleCancelCheckIn(attendanceId, "este participante");
  };

  const handleMarkPresent = async (attendanceId: string) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      await updateAttendanceStatus(attendanceId, "presente", todayStr);
      loadData();
      showAlert("Presença registrada via painel.", { type: 'success' });
    } catch (err) {
      showAlert("Erro ao marcar presença.", { type: 'error' });
    }
  };

  const handleToggleOrganizer = async (eventId: string, studentId: string, currentStatus: boolean) => {
    try {
      await updateAttendanceDetails(eventId, studentId, { isOrganizer: !currentStatus });
      loadData();
    } catch (err) {
      showAlert("Erro ao atualizar status de organização.", { type: 'error' });
    }
  };

  const handleCheckInAll = async () => {
    const unconfirmed = attendees.filter((a) => a.status !== "presente" && a.member?.isActive !== false);
    if (unconfirmed.length === 0) {
      showAlert("Todos os participantes ativos deste evento já estão com presença confirmada!", { type: "info" });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const todayFormatted = new Date().toLocaleDateString("pt-BR");

    setConfirmModal({
      isOpen: true,
      title: "Check-in de Todos",
      confirmVariant: "primary",
      message: `Deseja realizar o check-in e confirmar a presença de TODOS os ${unconfirmed.length} participante(s) pendente(s) com a data de hoje (${todayFormatted})?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const updatePromises = unconfirmed.map((a) =>
            updateAttendanceStatus(a.id, "presente", todayStr).catch((err) => {
              console.warn("Error updating individual attendance:", a.id, err);
            })
          );
          await Promise.all(updatePromises);
          await loadData();
          showAlert(
            `Check-in de todos realizado com sucesso! (${unconfirmed.length} presenças confirmadas).`,
            { type: "success" }
          );
        } catch (err) {
          console.error("Erro ao fazer check-in de todos:", err);
          showAlert("Ocorreu um erro ao processar o check-in em massa.", { type: "error" });
        } finally {
          setLoading(false);
        }
      },
    });
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
  
    // We update the DOM directly before printing inside the invisible area, or just dynamically build HTML
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      let daysHeader = `<th class="border border-black p-2 w-48 text-center">ASSINATURA DO INSCRITO</th>`;
      let evaluateDaysRow = () => `<td class="border border-black p-2 align-bottom"><div class="w-full h-8 border-b border-black border-dashed opacity-50"></div></td>`;

      if (event?.startDate && event?.endDate) {
        const start = new Date(event.startDate).getTime();
        const end = new Date(event.endDate).getTime();
        // If event spans more than 1 day
        if (end > start) {
          // Normalize to handle timezones slightly better by using simple math on ms, rough estimate:
          const numDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
          if (numDays > 1 && numDays <= 30) {
            daysHeader = "";
            let daysDataTemplate = "";
            for (let i = 0; i < numDays; i++) {
              const d = new Date(start + i * (1000 * 60 * 60 * 24));
              const dayStr = `${String(d.getDate() + 1).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
              // +1 to date conceptually, but wait, `new Date(event.startDate)` parses YYYY-MM-DD as UTC midnight.
              // So `d` will be the correct dates UTC. To be safe with `getDate()`, we can just use setUTCDate or similar, actually let's just parse properly.
              // For simplicity:
              const realD = new Date(event.startDate);
              realD.setDate(realD.getDate() + i);
              const properDayStr = `${String(realD.getDate()).padStart(2,'0')}/${String(realD.getMonth()+1).padStart(2,'0')}`;
              
              daysHeader += `<th class="border border-black p-2 w-28 text-center text-[10px]">ASSINATURA DO INSCRITO<br/>${properDayStr}</th>`;
              daysDataTemplate += `<td class="border border-black p-2 align-bottom"><div class="w-full h-8 border-b border-black border-dashed opacity-50"></div></td>`;
            }
            evaluateDaysRow = () => daysDataTemplate;
          }
        }
      }

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
            ${evaluateDaysRow()}
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

      printWindow.document.write(`
        <html>
          <head>
            <title>Lista de Presença</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f3f4f6; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .uppercase { text-transform: uppercase; }
              .tracking-widest { letter-spacing: 0.1em; }
              .border-black { border-color: black; }
              .border-b-2 { border-bottom-width: 2px; }
              .border-dashed { border-style: dashed; border-color: black; opacity: 0.5; height: 30px; border-bottom-width: 1px; }
              .mb-6 { margin-bottom: 24px; }
              .mt-2 { margin-top: 8px; }
              .mt-8 { margin-top: 32px; }
              .pb-2 { padding-bottom: 8px; }
              .text-xl { font-size: 20px; }
              .text-sm { font-size: 14px; }
              .text-xs { font-size: 12px; }
              .inline-block { display: inline-block; }
              .px-2 { padding-left: 8px; padding-right: 8px; }
              .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
              .rounded { border-radius: 4px; }
              .bg-gray-200 { background-color: #e5e7eb; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      // Allow images or styles to load briefly before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
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

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      let trs = "";
      toPrint.forEach((sub, idx) => {
        const rolesText = [
          ...(sub.member?.roles || []),
          sub.member?.diocese ? `Diocese: ${sub.member?.diocese}` : ""
        ].filter(Boolean).join(" • ");

        const status = sub.status === "presente" ? "Presente" : "Inscrito";
        const dias = (sub.checkInDates || []).map(d => {
             const parts = d.split('-');
             if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
             return d;
        }).join(", ");

        trs += `
          <tr>
            <td class="border border-black p-2 text-center font-bold">${idx + 1}</td>
            <td class="border border-black p-2 uppercase font-semibold">${sub.member?.name || "Desconhecido"}</td>
            <td class="border border-black p-2 text-center">${sub.member?.ra || (sub.member as any)?.cpf || "-"}</td>
            <td class="border border-black p-2 text-[10px] uppercase">${rolesText}</td>
            <td class="border border-black p-2 text-center font-bold ${sub.status === 'presente' ? 'text-green-600' : ''}">${status}</td>
            <td class="border border-black p-2 text-center text-[10px]">${dias || "-"}</td>
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

      printWindow.document.write(`
        <html>
          <head>
            <title>Relatório de Presenças</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f3f4f6; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .uppercase { text-transform: uppercase; }
              .tracking-widest { letter-spacing: 0.1em; }
              .border-black { border-color: black; }
              .border-b-2 { border-bottom-width: 2px; }
              .mb-6 { margin-bottom: 24px; }
              .mt-2 { margin-top: 8px; }
              .mt-8 { margin-top: 32px; }
              .pb-2 { padding-bottom: 8px; }
              .text-xl { font-size: 20px; }
              .text-sm { font-size: 14px; }
              .text-xs { font-size: 12px; }
              .inline-block { display: inline-block; }
              .px-2 { padding-left: 8px; padding-right: 8px; }
              .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
              .rounded { border-radius: 4px; }
              .bg-gray-200 { background-color: #e5e7eb; }
              .text-green-600 { color: #16a34a; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      // Allow images or styles to load briefly before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
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

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm px-4 print:static print:bg-transparent print:p-0 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[95vh] print:hidden my-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              Inscritos
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {event.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 mx-4 mt-4 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 min-w-[100px] py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveTab("alunos")}
            className={`flex-1 min-w-[100px] py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === "alunos"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Alunos / Seminaristas
          </button>
          <button
            onClick={() => setActiveTab("visitantes")}
            className={`flex-1 min-w-[100px] py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === "visitantes"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Visitantes
          </button>
          <button
            onClick={() => setActiveTab("organizacao")}
            className={`flex-1 min-w-[100px] py-2 text-sm font-bold rounded-lg transition-colors ${
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
              className={`flex-1 min-w-[110px] py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
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

        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          {/* Action Row 1: Check-in de Todos & Adicionar Participante */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCheckInAll}
                disabled={loading || attendees.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 disabled:opacity-50 cursor-pointer"
                title="Confirmar presença de todos os inscritos com 1 clique"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Check-in de Todos</span>
                {attendees.filter((a) => a.status !== "presente").length > 0 && (
                  <span className="bg-emerald-800 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-black ml-0.5">
                    {attendees.filter((a) => a.status !== "presente").length} pendente(s)
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setAddSearch("");
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                title="Adicionar alunos ou participantes ao evento mesmo com prazo encerrado"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Adicionar Participante</span>
              </button>

              {isSystemAdmin && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                  title="Gerar cartaz oficial com QR Code para lista de presença e horários (Exclusivo Administradores)"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Cartaz QR Code</span>
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Total: <strong className="text-slate-800 dark:text-white font-bold">{attendees.length}</strong> inscritos</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {attendees.filter((a) => a.status === "presente").length} presentes
              </span>
            </div>
          </div>

          {/* Action Row 2: Search and Print/Report Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, RA ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase mr-1 whitespace-nowrap">Listas:</div>
                <button
                  onClick={() => handlePrint("all")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Lista de Presença Completa (Assinatura)"
                >
                  Tudo
                </button>
                <button
                  onClick={() => handlePrint("alunos")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Apenas Alunos e Seminaristas (Assinatura)"
                >
                  Alunos
                </button>
                <button
                  onClick={() => handlePrint("visitantes")}
                  className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                  title="Apenas Visitantes (Assinatura)"
                >
                  Visitantes
                </button>
              </div>
              {activeTab !== "organizacao" ? (
                <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mr-1 whitespace-nowrap">Relatórios:</div>
                  <button
                    onClick={handleExportCSV}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0"
                    title="Exportar Relatório em CSV"
                  >
                    <span className="hidden sm:inline">Normal</span> CSV
                  </button>
                  <button
                    onClick={handlePrintReport}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-700 transition-colors shrink-0"
                    title="Imprimir Relatório de Presenças"
                  >
                    Imprimir
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleNotifyOrganizersEmail}
                    disabled={isSendingEmails}
                    className="print:hidden whitespace-nowrap flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 disabled:opacity-50 shadow-xs"
                    title="Enviar e-mail para todos os membros da organização informando que o certificado está disponível"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isSendingEmails ? "Enviando..." : "Avisar Certificado (E-mail)"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Row 3: Alphabetical Sorting & Letter Filter for Attendees */}
          {activeTab !== "organizacao" && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ordem Alfabética */}
                  <div className="relative">
                    <select
                      value={sortAttendeesBy}
                      onChange={(e) => setSortAttendeesBy(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="name-asc">Ordem Alfabética (A → Z)</option>
                      <option value="name-desc">Ordem Alfabética (Z → A)</option>
                      <option value="present-first">Presentes primeiro</option>
                      <option value="pending-first">Pendentes primeiro</option>
                    </select>
                  </div>

                  {/* Status Presença */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="all">Presença: Todos</option>
                      <option value="present">Apenas Presentes</option>
                      <option value="pending">Apenas Pendentes</option>
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
                      <RotateCcw className="w-3 h-3" /> Limpar filtros
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Mostrando <strong>{filteredAttendees.length}</strong> de <strong>{attendees.length}</strong>
                </div>
              </div>

              {/* Barra de Letras A-Z */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  onClick={() => setSelectedAttendeeLetter("")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 transition-all ${
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
                      className={`min-w-[24px] h-6 px-1 rounded text-[11px] font-bold flex items-center justify-center gap-0.5 shrink-0 transition-all ${
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30">
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
                      className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                    >
                  <div className="flex items-center gap-3">
                    {a.member?.photoUrl ? (
                      <img
                        src={a.member.photoUrl}
                        alt={a.member?.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xl font-bold">
                        {a.member?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">
                        {a.member?.name || "Aluno Excluído"}
                      </h4>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 flex flex-wrap gap-x-2 gap-y-1">
                        {a.member?.ra && <span>RA: {a.member.ra}</span>}
                        {(a.member as any)?.cpf && <span>CPF: {(a.member as any).cpf}</span>}
                        {a.member?.alphaCode && (
                          <span>ID: {a.member.alphaCode}</span>
                        )}
                        {a.member?.course && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            {a.member.course}
                          </span>
                        )}
                        {a.member?.roles && a.member.roles.length > 0 && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            {a.member.roles.join(", ")}
                          </span>
                        )}
                        {a.member?.diocese && (
                          <span>
                            <span className="text-slate-300 dark:text-slate-600 px-1">
                              •
                            </span>
                            Diocese: {a.member.diocese}
                          </span>
                        )}
                        {a.member?.isActive === false && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" /> Inativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0 flex-wrap">
                    <button
                      onClick={() => handleToggleOrganizer(event.id, a.studentId, !!a.isOrganizer)}
                      className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold ${
                        a.isOrganizer
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-500"
                      }`}
                      title={a.isOrganizer ? "Remover da equipe de organização" : "Adicionar à equipe de organização"}
                    >
                      <Star className={`w-3.5 h-3.5 ${a.isOrganizer ? "fill-amber-500" : ""}`} /> Org
                    </button>
                    {a.member?.isActive === false ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg border border-rose-300 dark:border-rose-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          Cadastro Inativo
                        </span>
                        {a.status === "presente" && (
                          <button
                            onClick={() => handleCancelCheckIn(a.id, a.member?.name || "Participante")}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Cancelar Check-in: Reverte a presença deste membro inativo"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="hidden sm:inline">Cancelar Check-in</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove este membro inativo do evento"
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span className="hidden sm:inline">Cancelar Inscrição</span>
                        </button>
                      </div>
                    ) : a.status === "presente" ||
                    a.status === "apto_para_certificado" ? (
                      <>
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" /> Presente
                          </span>
                          {a.checkInDates && a.checkInDates.length > 0 && (
                            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                              Dia(s): {a.checkInDates.map(d => {
                                const [y,m,day] = d.split('-');
                                return `${day}/${m}`;
                              }).join(', ')}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleCancelCheckIn(a.id, a.member?.name || "Participante")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Check-in: Reverte a presença para inscrito caso tenha marcado por engano"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="hidden sm:inline">Cancelar Check-in</span>
                        </button>
                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove o participante do evento"
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span className="hidden sm:inline">Cancelar Inscrição</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkPresent(a.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                          title="Fazer Check-in manual / Confirmar presença"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Fazer Check-in</span>
                        </button>
                        <button
                          onClick={() => handleCancelEnrollment(event.id, a.studentId, a.member?.name || "Participante")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Cancelar Inscrição: Remove o participante do evento"
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span className="hidden sm:inline">Cancelar Inscrição</span>
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
    </div>,
    document.body
  );
}
