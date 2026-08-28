import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, appId, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { Member, AVAILABLE_SEMINARIES } from "../types";
import { getDoc, getDocs, limit, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Car, Trash2, Calendar, Search, Edit2, Fingerprint, FileDown, CheckCircle2, KeyRound, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import EditDobloModal from "./EditDobloModal";
import RecycleBinModal from "./RecycleBinModal";

interface DobloLog {
  deletedAt?: string;
  deletedBy?: string;
  id: string;
  name: string;
  seminary?: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  departureKm: number;
  arrivalKm: number;
  destination: string;
  timestamp: any;
  authorId?: string;
  biometricSignature?: boolean;
}

export default function DobloControl({ currentUser: initialCurrentUser, isAdmin: initialIsAdmin }: { currentUser: Member | null; isAdmin: boolean }) {
  const checkAdminStatus = (userAuth?: any, mem?: Member | null, propAdmin?: boolean): boolean => {
    if (propAdmin) return true;
    if (userAuth && !userAuth.isAnonymous) return true;
    if (typeof window !== "undefined") {
      if (
        localStorage.getItem("adminMasterLogged") === "true" ||
        sessionStorage.getItem("adminMasterLogged") === "true"
      ) {
        return true;
      }
      const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
      if (cachedMemberStr) {
        try {
          const m = JSON.parse(cachedMemberStr) as Member;
          if (
            m.roles &&
            m.roles.some((r) =>
              [
                "admin",
                "administrador",
                "diretoria",
                "gestão",
                "gestao",
                "comunicação",
                "comunicacao",
                "secretaria",
                "reitor",
                "vice-reitor",
                "padre",
                "bispo"
              ].includes(r.toLowerCase().trim())
            )
          ) {
            return true;
          }
        } catch (e) {}
      }
    }
    if (
      mem &&
      mem.roles &&
      mem.roles.some((r) =>
        [
          "admin",
          "administrador",
          "diretoria",
          "gestão",
          "gestao",
          "comunicação",
          "comunicacao",
          "secretaria",
          "reitor",
          "vice-reitor",
          "padre",
          "bispo"
        ].includes(r.toLowerCase().trim())
      )
    ) {
      return true;
    }
    return false;
  };

  const [currentUser, setCurrentUser] = useState<Member | null>(initialCurrentUser);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => checkAdminStatus(auth.currentUser, initialCurrentUser, initialIsAdmin));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAdmin(true);
      } else {
        setIsAdmin(checkAdminStatus(user, currentUser, initialIsAdmin));
      }
    });
    return () => unsub();
  }, [currentUser, initialIsAdmin]);

  useEffect(() => {
    if (initialCurrentUser) {
      setCurrentUser(initialCurrentUser);
      setIsAdmin(checkAdminStatus(auth.currentUser, initialCurrentUser, initialIsAdmin));
    } else {
      const loadBonded = async () => {
        const bondedId = localStorage.getItem("davveroId_student_identity");
        if (bondedId) {
          try {
            let found = null;
            try {
              const docSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, bondedId));
              if (docSnap.exists()) found = { id: docSnap.id, ...docSnap.data() } as Member;
            } catch (e) {}
            if (!found) {
              const q = query(collection(db, `artifacts/${appId}/public/data/students`), where("alphaCode", "==", bondedId), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) {
                found = { id: snap.docs[0].id, ...snap.docs[0].data() } as Member;
              }
            }
            if (found) {
              setCurrentUser(found);
              setIsAdmin(checkAdminStatus(auth.currentUser, found, initialIsAdmin));
            }
          } catch (err) {}
        }
      };
      loadBonded();
    }
  }, [initialCurrentUser, initialIsAdmin]);
  const { showAlert, showConfirm } = useDialog();
  const [logs, setLogs] = useState<DobloLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState(currentUser?.name || "");
  const [seminary, setSeminary] = useState(currentUser?.seminary || "");

  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name);
    if (currentUser?.seminary) setSeminary(currentUser.seminary);
  }, [currentUser?.name, currentUser?.seminary]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().substring(0, 5);
  });
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureKm, setDepartureKm] = useState("");
  const [arrivalKm, setArrivalKm] = useState("");
  const [destination, setDestination] = useState("");
  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");
  const [editingLog, setEditingLog] = useState<DobloLog | null>(null);
  const [biometricSignature, setBiometricSignature] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // get ISO week
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    const q = query(
      collection(db, `artifacts/${appId}/public/data/doblo_logs`),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DobloLog));
      setLogs(fetchedLogs);
      
      if (fetchedLogs.length > 0) {
        // Find the most recent log (assuming they are sorted by date desc)
        // Since orderBy is date desc, the first one is the most recent date. 
        // We might want to sort by date + time to be safe.
        const sorted = [...fetchedLogs].sort((a, b) => {
           const timeA = new Date(a.date + 'T' + (a.arrivalTime || a.departureTime || '00:00')).getTime();
           const timeB = new Date(b.date + 'T' + (b.arrivalTime || b.departureTime || '00:00')).getTime();
           return timeB - timeA;
        });
        
        const latestLog = sorted[0];
        setDepartureKm((prev) => prev ? prev : (latestLog.arrivalKm || latestLog.departureKm || "").toString());
      }
      
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !date || !departureTime || !departureKm.trim() || !destination.trim()) {
      showAlert("Preencha os campos obrigatórios (nome, data, hora, km de saída e local).", { type: "error" });
      return;
    }

    const cleanDepKm = departureKm.toString().replace(",", ".");
    const numDepKm = parseFloat(cleanDepKm);
    if (isNaN(numDepKm) || numDepKm < 0) {
      showAlert("Informe um Km de saída válido.", { type: "error" });
      return;
    }

    let numArrKm: number | null = null;
    if (arrivalKm && arrivalKm.toString().trim() !== "") {
      const cleanArrKm = arrivalKm.toString().replace(",", ".");
      numArrKm = parseFloat(cleanArrKm);
      if (isNaN(numArrKm) || numArrKm < 0) {
        showAlert("Informe um Km de chegada válido ou deixe em branco.", { type: "error" });
        return;
      }
    }

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/doblo_logs`), {
        name: name.trim(),
        seminary: seminary || "",
        date,
        departureTime,
        arrivalTime: arrivalTime || "",
        departureKm: numDepKm,
        arrivalKm: numArrKm,
        destination: destination.trim(),
        timestamp: serverTimestamp(),
        authorId: currentUser?.id || "public",
        biometricSignature
      });
      setDepartureTime("");
      setArrivalTime("");
      setDestination("");
      setBiometricSignature(false);
      // When saving a record, if it has an arrivalKm, set the new departureKm to it. Otherwise keep current departureKm
      if (numArrKm !== null) {
        setDepartureKm(numArrKm.toString());
        showAlert("Registro completo salvo com sucesso!", { type: "success" });
      } else {
        showAlert("Registro de saída salvo! Lembre-se de voltar e editar o registro para preencher a chegada após a viagem.", { type: "info" });
      }
      setArrivalKm("");
    } catch (err: any) {
      console.error("Erro ao adicionar registro doblo:", err);
      handleFirestoreError(err, OperationType.CREATE, `artifacts/${appId}/public/data/doblo_logs`);
      showAlert("Erro ao salvar o registro.", { type: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (await showConfirm("Deseja realmente apagar este registro?")) {
      try {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/doblo_logs`, id), { deletedAt: new Date().toISOString(), deletedBy: currentUser?.name || "Admin" });
        showAlert("Registro movido para a lixeira.", { type: "info" });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `artifacts/${appId}/public/data/doblo_logs/${id}`);
        showAlert("Erro ao excluir o registro.", { type: "error" });
      }
    }
  };

  // filter
  const filteredLogs = logs.filter(log => {
    if (log.deletedAt) return false;
    if (viewMode === "monthly") {
      return log.date.startsWith(selectedMonth);
    } else {
      // rough week filter (simplified: match year and week using JS Date logic or just let them pick a week range)
      // Since HTML input type="week" returns YYYY-Www format, let's just parse it.
      const logDate = new Date(log.date + 'T12:00:00');
      const start = new Date(logDate.getFullYear(), 0, 1);
      const days = Math.floor((logDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((logDate.getDay() + 1 + days) / 7);
      const logWeekStr = `${logDate.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
      return logWeekStr === selectedWeek;
    }
  });

  
  
  const handlePinSubmit = () => {
    const savedPin = localStorage.getItem("student_fallback_pin");
    if (!savedPin) {
      setPinError("Você não tem um PIN cadastrado no perfil.");
      return;
    }
    if (pinInput === savedPin) {
      setBiometricSignature(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError("");
      showAlert("Assinatura com PIN confirmada!", { type: "success" });
    } else {
      setPinError("PIN Incorreto");
    }
  };

  const handleBiometry = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);
        
        await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "Controle Doblô" },
            user: {
              id: userId,
              name: currentUser?.name || name || "Usuário",
              displayName: currentUser?.name || name || "Usuário"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            },
            timeout: 60000
          }
        });
        setBiometricSignature(true);
        showAlert("Assinatura digital confirmada!", { type: "success" });
      } catch (err) {
        console.error(err);
        showAlert("Não foi possível confirmar a biometria/senha da tela.", { type: "error" });
      }
    } else {
      showAlert("Seu dispositivo não suporta biometria.", { type: "warning" });
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório de Uso da Doblô - ${viewMode === 'monthly' ? selectedMonth : selectedWeek}`, 14, 15);
    
    autoTable(doc, {
      startY: 25,
      head: [['Data', 'Condutor', 'Seminário', 'Destino', 'Saída', 'Chegada', 'Km Total', 'Assinado']],
      body: filteredLogs.map(log => {
        const [y, m, d] = log.date.split("-");
        const dateStr = `${d}/${m}`;
        const kmDiff = log.arrivalKm ? (log.arrivalKm - log.departureKm).toFixed(1) : "-";
        return [
          dateStr,
          log.name,
          log.seminary || "-",
          log.destination || "-",
          `${log.departureTime} (${log.departureKm} km)`,
          log.arrivalTime ? `${log.arrivalTime} (${log.arrivalKm} km)` : "-",
          kmDiff !== "-" ? `${kmDiff} km` : "-",
          log.biometricSignature ? "Sim" : "Não"
        ];
      }),
    });
    
    doc.save('doblo_relatorio.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 mb-4">
            <Car className="w-4 h-4 text-emerald-500" />
            Novo Registro de Uso
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Nome do Condutor</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Seminário / Origem</label>
              <select value={seminary} onChange={e => setSeminary(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500">
                 <option value="">Selecione...</option>
                 {AVAILABLE_SEMINARIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Destino / Local</label>
              <input type="text" value={destination} onChange={e => setDestination(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Hora de Saída</label>
              <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Km de Saída</label>
              <input type="number" step="0.1" value={departureKm} onChange={e => setDepartureKm(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 mb-2" />
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-widest transition-colors shadow-sm">
                Salvar Saída
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Hora de Chegada</label>
              <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Km de Chegada</label>
              <input type="number" step="0.1" value={arrivalKm} onChange={e => setArrivalKm(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
              <div className="flex flex-col">
                 {!currentUser && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mb-2">Não está logado? Você pode colocar o seu nome ou logar na página inicial.</p>
                 )}
                 {biometricSignature ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">
                       <CheckCircle2 className="w-4 h-4" /> Assinado Digitalmente
                    </div>
                 ) : (
                    <div className="flex gap-2">
                       <button type="button" onClick={handleBiometry} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                          <Fingerprint className="w-4 h-4" /> Biometria
                       </button>
                       <button type="button" onClick={() => { setShowPinModal(true); setPinInput(""); setPinError(""); }} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                          <KeyRound className="w-4 h-4" /> PIN
                       </button>
                    </div>
                 )}
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto transform hover:-translate-y-0.5">
                Salvar Chegada / Completo
              </button>
            </div>
          </form>
        </div>


      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Histórico da Doblô
          </h3>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowRecycleBin(true)} className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                <Trash2 className="w-4 h-4" /> Lixeira
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                <FileDown className="w-4 h-4" /> PDF
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">
            <div className="flex">
              <button onClick={() => setViewMode("monthly")} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${viewMode === "monthly" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Mês</button>
              <button onClick={() => setViewMode("weekly")} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${viewMode === "weekly" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Semana</button>
            </div>
            {viewMode === "monthly" ? (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none font-bold" />
            ) : (
              <input type="week" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none font-bold" />
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 italic flex flex-col items-center">
            <Search className="w-10 h-10 mb-2 opacity-50" />
            Nenhum registro encontrado para este período.
          </div>
        ) : (
                    <div className="space-y-8">
            {(Object.entries(
              filteredLogs.reduce((acc, log) => {
                const sem = log.seminary || "Outros / Sem Seminário";
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(log);
                return acc;
              }, {} as Record<string, DobloLog[]>)
            ) as [string, DobloLog[]][]).map(([seminaryName, groupLogs]) => (
              <div key={seminaryName} className="overflow-hidden">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 px-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Car className="w-4 h-4 text-emerald-500" />
                  {seminaryName}
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-xs">{groupLogs.length}</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Data</th>
                        <th className="px-4 py-3">Condutor / Destino</th>
                        <th className="px-4 py-3 text-center">Saída</th>
                        <th className="px-4 py-3 text-center">Chegada</th>
                        <th className="px-4 py-3 text-right">Km Total</th>
                        {(isAdmin || currentUser) && <th className="px-4 py-3 rounded-r-xl">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {groupLogs.map(log => {
                        const [y, m, d] = (log.date || "").split("-");
                        const dateStr = d && m ? `${d}/${m}` : (log.date || "-");
                        const kmDiff = (log.arrivalKm !== undefined && log.arrivalKm !== null && !isNaN(Number(log.arrivalKm)))
                          ? (Number(log.arrivalKm) - Number(log.departureKm || 0)).toFixed(1)
                          : "-";
                        const isAuthor = currentUser && (
                          log.authorId === currentUser.id ||
                          log.name?.toLowerCase().trim() === currentUser.name?.toLowerCase().trim()
                        );
                        const canEdit = isAdmin || isAuthor || !log.arrivalKm;
                        const canDelete = isAdmin || isAuthor;
                        
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{dateStr}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{log.name}</div>
                              <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={log.destination}>{log.destination || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium text-emerald-600 dark:text-emerald-400">{log.departureTime}</div>
                              <div className="text-[10px] text-slate-500">{log.departureKm} km</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium text-slate-700 dark:text-slate-300">{log.arrivalTime || "-"}</div>
                              <div className="text-[10px] text-slate-500">{log.arrivalKm !== undefined && log.arrivalKm !== null ? `${log.arrivalKm} km` : "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-white">
                              {kmDiff !== "-" ? `${kmDiff} km` : ""}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canEdit && (
                                <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-600 p-1 mr-2" title="Editar">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-600 p-1" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editingLog && (
         <EditDobloModal 
           log={editingLog} 
           onClose={() => setEditingLog(null)} 
           onSuccess={() => showAlert("Registro atualizado com sucesso!", { type: "success" })}
         />
      )}

      {showRecycleBin && <RecycleBinModal onClose={() => setShowRecycleBin(false)} initialTab="doblo" />}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-500" />
                Assinar com PIN
              </h3>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="****"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center text-3xl tracking-[1em] font-black bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-4 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all dark:text-white"
              />
              {pinError && <p className="text-rose-500 text-xs font-bold text-center">{pinError}</p>}
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
