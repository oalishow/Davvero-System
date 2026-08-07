import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, CheckCircle, Clock, Trash2, Shield, ShieldAlert, Star, ScanLine } from "lucide-react";
import type { Event, Attendance, Member } from "../types";
import { db, appId, unsubscribeFromEvent, updateAttendanceDetails, updateAttendanceStatus, removeAttendancePresence } from "../lib/firebase";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import Modal from "./Modal";
import { useDialog } from "../context/DialogContext";

interface EventAttendeesModalProps {
  event: Event;
  onClose: () => void;
}

export default function EventAttendeesModal({
  event,
  onClose,
}: EventAttendeesModalProps) {
  const { showAlert } = useDialog();
  const [mounted, setMounted] = useState(false);
  const [attendees, setAttendees] = useState<
    (Attendance & { member?: Member })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "alunos" | "visitantes" | "organizacao">("all");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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

      if (currentAllM.length === 0) {
        const membersSnap = await getDocs(
          query(collection(db, `artifacts/${appId}/public/data/students`)),
        );
        const membersDict: Record<string, Member> = {};
        const allM: Member[] = [];
        membersSnap.docs.forEach((d) => {
          if (!d.id.startsWith("_")) {
            const mbr = { id: d.id, ...d.data() } as Member;
            if (mbr.deletedAt || mbr.isApproved === false || mbr.isActive === false) return; // Ignore deleted/unapproved/inactive
            membersDict[d.id] = mbr;
            allM.push(mbr);
          }
        });
        currentAllM = allM;
        currentMembersDict = membersDict;
        setAllMembers(allM);
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

  const handleRemove = async (eventId: string, studentId: string) => {
    setConfirmModal({
      isOpen: true,
      message: "Tem a certeza que deseja remover esta inscrição?",
      onConfirm: async () => {
        try {
          await unsubscribeFromEvent(eventId, studentId);
          loadData(); // Reload data to reflect change
        } catch (err) {
          showAlert("Erro ao remover inscrição.", { type: 'error' });
        }
      },
    });
  };

  const handleRemovePresence = async (attendanceId: string) => {
    try {
      // Remover a presença (todas as datas ou reverter para inscrito)
      await removeAttendancePresence(attendanceId);
      loadData();
      showAlert("Presença removida com sucesso.", { type: 'success' });
    } catch (err) {
      showAlert("Erro ao remover presença.", { type: 'error' });
    }
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

      const printContent = `
        <div class="text-center mb-6">
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

      const printContent = `
        <div class="text-center mb-6">
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

  const filteredAttendees = attendees.filter((a) => {
    if (activeTab === "organizacao") return false; // Handled separately below
    let matchTab = true;
    if (activeTab === "alunos") {
      matchTab = !a.member?.roles?.includes("VISITANTE");
    } else if (activeTab === "visitantes") {
      matchTab = !!a.member?.roles?.includes("VISITANTE");
    }

    if (!searchTerm) return matchTab;
    const term = searchTerm.toLowerCase();
    return matchTab && (
      a.member?.name.toLowerCase().includes(term) ||
      a.member?.ra?.toLowerCase().includes(term) ||
      (a.member as any)?.cpf?.includes(term) // in case visitors use cpf
    );
  });

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
        </div>

        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome, RA ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-sky-500 dark:focus:border-sky-500 text-slate-700 dark:text-slate-200"
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
            {activeTab !== "organizacao" && (
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
            )}
          </div>
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
              {filteredAttendees.map((a) => (
                <div
                  key={a.id}
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
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
                    {a.status === "presente" ||
                    a.status === "apto_para_certificado" ? (
                      <>
                        <div className="flex flex-col items-end gap-1">
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
                          onClick={() => handleRemovePresence(a.id)}
                          className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-500/20"
                          title="Remover apenas a presença"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(event.id, a.studentId)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20"
                          title="Remover inscrição/presença"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkPresent(a.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                          title="Marcar presença manualmente"
                        >
                          <ScanLine className="w-3.5 h-3.5" /> Fazer Check-in
                        </button>
                        <button
                          onClick={() => handleRemove(event.id, a.studentId)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20"
                          title="Remover inscrição"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
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
        title="Remover Inscrição"
        confirmLabel="Confirmar"
        confirmVariant="danger"
        onConfirm={confirmModal?.onConfirm}
      >
        <p className="text-slate-600 dark:text-slate-400">
          {confirmModal?.message}
        </p>
      </Modal>
    </div>,
    document.body
  );
}
