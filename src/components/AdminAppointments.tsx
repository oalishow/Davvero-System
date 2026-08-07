import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { Member, Availability, Appointment, AVAILABLE_SEMINARIES } from "../types";
import { Calendar, Clock, Plus, Trash2, User, ChevronLeft, ChevronRight, CheckCircle, MapPin, MessageSquare, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import ImportWhatsappModal from "./ImportWhatsappModal";
import DeleteAvailabilitiesModal from "./DeleteAvailabilitiesModal";
import EditAppointmentModal from "./EditAppointmentModal";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";

export default function AdminAppointments() {
  const { showAlert, showConfirm } = useDialog();
  const { settings: cloudSettings } = useSettings();
  const [professionals, setProfessionals] = useState<Member[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedProfId, setSelectedProfId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [seminary, setSeminary] = useState(AVAILABLE_SEMINARIES[0]);
  
  const [creationMode, setCreationMode] = useState<"single" | "batch">("single");
  const [batchEndTime, setBatchEndTime] = useState("");
  const [batchDuration, setBatchDuration] = useState("60"); // minutos

  const [allStudents, setAllStudents] = useState<Member[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ avail: Availability, appt: Appointment | null } | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<{current: number, total: number} | null>(null);

  const normalizeString = (str: string) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\s+/g, ' ').trim();
  };
  
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterProfessional, setFilterProfessional] = useState("");

  useEffect(() => {
    // Load professionals (members with specific roles, or let admin select from all members)
    const loadMembers = async () => {
      try {
        const q = query(collection(db, `artifacts/${appId}/public/data/students`), where("isActive", "==", true));
        const snap = await getDocs(q);
        
        // Merge custom professionals from settings
        const customProfs: Member[] = [];
        if (cloudSettings.seminariesConfig) {
          Object.values(cloudSettings.seminariesConfig).forEach((semConfig: any) => {
            if (semConfig.professionals) {
              semConfig.professionals.forEach((p: any) => {
                customProfs.push({
                  id: p.id,
                  name: p.name,
                  roles: [p.role],
                  photoUrl: p.photoUrl || undefined,
                  isActive: true,
                } as Member);
              });
            }
          });
        }

        const membersList: Member[] = cloudSettings.professionals ? [] : [...DEFAULT_PROFESSIONALS];
        if (cloudSettings.professionals) {
          cloudSettings.professionals.forEach((p: any) => {
            const m = {
              id: p.id,
              name: p.name,
              roles: [p.role],
              photoUrl: p.photoUrl || undefined,
              isActive: true,
            } as Member;
            if (!membersList.some(existing => existing.name.toLowerCase() === m.name.toLowerCase())) {
              membersList.push(m);
            }
          });
        }
        customProfs.forEach(cp => {
          if (!membersList.some(m => m.name.toLowerCase() === cp.name.toLowerCase())) {
            membersList.push(cp);
          }
        });
        
        const loadedAllStudents: Member[] = [];
        snap.forEach(d => {
          const m = { ...d.data(), id: d.id } as Member;
          if (m.deletedAt || m.isApproved === false) return; // Ignore deleted or unapproved
          loadedAllStudents.push(m);
        });
        
        // Sort alphabetically
        membersList.sort((a,b) => a.name.localeCompare(b.name));
        setProfessionals(membersList);
        setAllStudents(loadedAllStudents);
      } catch(e) {
        console.error(e);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    const qAvail = query(
      collection(db, `artifacts/${appId}/public/data/availabilities`)
    );
    const unsubAvail = onSnapshot(qAvail, (snap) => {
      const avails: Availability[] = [];
      snap.forEach(d => avails.push({ ...d.data(), id: d.id } as Availability));
      
      avails.sort((a, b) => b.date.localeCompare(a.date));
      setAvailabilities(avails);
    });

    const qAppt = query(
      collection(db, `artifacts/${appId}/public/data/appointments`)
    );
    const unsubAppt = onSnapshot(qAppt, (snap) => {
      const appts: Appointment[] = [];
      snap.forEach(d => appts.push({ ...d.data(), id: d.id } as Appointment));
      setAppointments(appts);
      setLoading(false);
    });

    return () => {
      unsubAvail();
      unsubAppt();
    };
  }, []);

  // Auto-link unmatched appointments when students are loaded
  useEffect(() => {
    if (allStudents.length === 0 || appointments.length === 0 || professionals.length === 0) return;
    


    const runAutoLink = async () => {
      const unmatched = appointments.filter(a => a.memberId === "unmatched" && a.studentName && a.studentName !== "Desconhecido");
      if (unmatched.length === 0) return;
      
      let updatedCount = 0;
      
      for (const appt of unmatched) {
         const prof = professionals.find(p => p.id === appt.professionalId);
         const normalizedParam = normalizeString(appt.studentName);
         
         const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
         let cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
         
         if (cleanParam === 'ferreira') cleanParam = 'joao victor ferreira';
         if (cleanParam === 'giovane') cleanParam = 'giovane silva';
         if (cleanParam === 'gabriel r') cleanParam = 'gabriel roberto';
         if (cleanParam === 'leonardo') cleanParam = 'leonardo religioso';
         
         const nameParts = cleanParam.split(' ').filter(p => p.length > 0);
         
         let bestMatch = null;
         let bestScore = -1;
         
         for (const s of allStudents) {
             const normName = normalizeString(s.name);
             const sParts = normName.split(' ').filter(p => p.length > 0);
             let score = -1;
             
             if (normName === cleanParam) {
                score = 100;
             } else if (nameParts.length > 0 && sParts.length > 0) {
                let partsMatched = 0;
                let isFirstMatch = sParts[0] === nameParts[0];
                let hasMismatchedParts = false;
                
                for (const p of nameParts) {
                   if (sParts.some(sp => sp === p || (p.length === 1 && sp.startsWith(p)))) {
                      partsMatched++;
                   } else {
                      hasMismatchedParts = true;
                   }
                }
                
                if (partsMatched === nameParts.length && !hasMismatchedParts) {
                   score = 70;
                   if (isFirstMatch) score += 10;
                   if (sParts.length === nameParts.length) score += 10;
                } else if (partsMatched > 0) {
                   score = 20 + (partsMatched * 10);
                   if (isFirstMatch) score += 5;
                   if (hasMismatchedParts) score -= 15;
                } else if (normName.includes(cleanParam)) {
                   score = 10;
                }
             }
             
             if (score > 0) {
                if (hasReligiosoHint || appt.studentName.toLowerCase().includes('leonardo')) {
                   if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                       score += 50;
                   } else {
                       score -= 20;
                   }
                } else if (appt.studentName.toLowerCase().includes('ferreira')) {
                   if (s.diocese && s.diocese.toUpperCase().includes('MARILIA')) {
                       score += 50;
                   } else {
                       score -= 20;
                   }
                } else {
                   if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
                      score += 15;
                   } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
                      score += 5;
                   }
                   if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                       score += 2;
                   }
                }
                
                if (score > bestScore) {
                   bestScore = score;
                   bestMatch = s;
                }
             }
         }
         
         if (bestMatch && bestScore > 20) {
             try {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, appt.id), {
                   memberId: bestMatch.id,
                   studentName: bestMatch.name
                });
                updatedCount++;
             } catch(e) {
                console.error("Error auto linking", e);
             }
         }
      }
      
      if (updatedCount > 0) {
         console.log(`Auto-linked ${updatedCount} appointments`);
      }
    };
    runAutoLink();
  }, [allStudents, appointments, professionals]);

  const forceResync = async () => {
    if (appointments.length === 0) return;
    setLoading(true);
    let updatedCount = 0;
    
    for (const appt of appointments) {
       if (!appt.studentName || appt.studentName === 'Desconhecido' || appt.studentName.trim() === '') continue;
       
       const prof = professionals.find(p => p.id === appt.professionalId);
       const normalizedParam = normalizeString(appt.studentName);
       
       const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
       let cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
       
       if (cleanParam === 'ferreira') cleanParam = 'joao victor ferreira';
       if (cleanParam === 'giovane') cleanParam = 'giovane silva';
       if (cleanParam === 'gabriel r') cleanParam = 'gabriel roberto';
       if (cleanParam === 'leonardo') cleanParam = 'leonardo religioso';
       
       const nameParts = cleanParam.split(' ').filter(p => p.length > 0);
       
       let bestMatch = null;
       let bestScore = -1;
       
       for (const s of allStudents) {
           const normName = normalizeString(s.name);
           const sParts = normName.split(' ').filter(p => p.length > 0);
           let score = -1;
           
           if (normName === cleanParam) {
              score = 100;
           } else if (nameParts.length > 0 && sParts.length > 0) {
              let partsMatched = 0;
              let isFirstMatch = sParts[0] === nameParts[0];
              let hasMismatchedParts = false;
              
              for (const p of nameParts) {
                 if (sParts.some(sp => sp === p || (p.length === 1 && sp.startsWith(p)))) {
                    partsMatched++;
                 } else {
                    hasMismatchedParts = true;
                 }
              }
              
              if (partsMatched === nameParts.length && !hasMismatchedParts) {
                 score = 70;
                 if (isFirstMatch) score += 10;
                 if (sParts.length === nameParts.length) score += 10;
              } else if (partsMatched > 0) {
                 score = 20 + (partsMatched * 10);
                 if (isFirstMatch) score += 5;
                 if (hasMismatchedParts) score -= 15;
              } else if (normName.includes(cleanParam)) {
                 score = 10;
              }
           }
           
           if (score > 0) {
              if (hasReligiosoHint || appt.studentName.toLowerCase().includes('leonardo')) {
                 if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                     score += 50;
                 } else {
                     score -= 20;
                 }
              } else if (appt.studentName.toLowerCase().includes('ferreira')) {
                 if (s.diocese && s.diocese.toUpperCase().includes('MARILIA')) {
                     score += 50;
                 } else {
                     score -= 20;
                 }
              } else {
                 if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
                    score += 15;
                 } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
                    score += 5;
                 }
                 if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                     score += 2;
                 }
              }
              
              if (score > bestScore) {
                 bestScore = score;
                 bestMatch = s;
              }
           }
       }
       
       const newMemberId = bestMatch ? bestMatch.id : "unmatched";
       
       if (appt.memberId !== newMemberId) {
          try {
             await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, appt.id), {
                memberId: newMemberId
             });
             updatedCount++;
          } catch (e) {
             console.error(e);
          }
       }
    }
    setLoading(false);
    showAlert(`Re-sincronização concluída! ${updatedCount} atendimentos foram corrigidos.`, 'success');
  };

  const handleCreateAvailability = async () => {
    if (!selectedProfId || !date || !startTime) {
      showAlert("Selecione profissional, data e hora de início.", { type: "warning", title: "Aviso" });
      return;
    }
    const prof = professionals.find(p => p.id === selectedProfId);
    if (!prof) return;

    try {
      if (creationMode === "single") {
        let calcEndTime = endTime;
        if (!calcEndTime) {
           let h = parseInt(startTime.split(':')[0]) + 1;
           let m = startTime.split(':')[1];
           calcEndTime = h.toString().padStart(2, '0') + ':' + m;
        }

        await addDoc(collection(db, `artifacts/${appId}/public/data/availabilities`), {
          professionalId: prof.id,
          professionalName: prof.name,
          date,
          startTime,
          endTime: calcEndTime,
          location: location || "",
          seminary: seminary || null,
          status: "LIVRE",
          createdAt: new Date().toISOString()
        });
      } else {
        // Batch Mode
        if (!batchEndTime || !batchDuration) {
          showAlert("Para gerar lote, informe H. Fim Final e a Duração.", { type: "warning" });
          return;
        }

        const durationMinutes = parseInt(batchDuration);
        if (durationMinutes <= 0) return;

        let [sh, sm] = startTime.split(':').map(Number);
        let [eh, em] = batchEndTime.split(':').map(Number);

        let currentTotalMins = sh * 60 + sm;
        const endTotalMins = eh * 60 + em;

        let createdCount = 0;

        while (currentTotalMins + durationMinutes <= endTotalMins) {
           const sfH = Math.floor(currentTotalMins / 60).toString().padStart(2, '0');
           const sfM = (currentTotalMins % 60).toString().padStart(2, '0');
           
           const nextTotalMins = currentTotalMins + durationMinutes;
           const efH = Math.floor(nextTotalMins / 60).toString().padStart(2, '0');
           const efM = (nextTotalMins % 60).toString().padStart(2, '0');

           await addDoc(collection(db, `artifacts/${appId}/public/data/availabilities`), {
            professionalId: prof.id,
            professionalName: prof.name,
            date,
            startTime: `${sfH}:${sfM}`,
            endTime: `${efH}:${efM}`,
            location: location || "",
            seminary: seminary || null,
            status: "LIVRE",
            createdAt: new Date().toISOString()
          });

           currentTotalMins = nextTotalMins;
           createdCount++;
        }
        showAlert(`Foram criados ${createdCount} horários com sucesso.`, { type: "success" });
      }

      // Clear time
      setStartTime("");
      setEndTime("");
      setBatchEndTime("");
    } catch(e) {
      console.error(e);
      showAlert("Erro ao criar disponibilidade.", { type: "error", title: "Erro" });
    }
  };

  const handleImportWhatsApp = async (slots: any[], profId: string, importedLocation: string, onProgress?: (c: number, t: number) => void) => {
    const prof = professionals.find(p => p.id === profId);
    if (!prof) return;

    let current = 0;
    const total = slots.length;

    let createdCount = 0;
    let updatedCount = 0;

    const chunkSize = 10;
    for (let i = 0; i < slots.length; i += chunkSize) {
       const chunk = slots.slice(i, i + chunkSize);
       
       await Promise.all(chunk.map(async (slot) => {
         let calcEndTime = "";
         let h = parseInt(slot.timeStr.split(':')[0]) + 1;
         let m = slot.timeStr.split(':')[1];
         calcEndTime = h.toString().padStart(2, '0') + ':' + m;
         
         const availabilityData = {
            professionalId: prof.id,
            professionalName: prof.name,
            date: slot.dateStr,
            startTime: slot.timeStr,
            endTime: calcEndTime,
            location: importedLocation || "",
            status: slot.status,
            createdAt: new Date().toISOString()
         };
         
         // Verify if this availability already exists for this professional
         const qAvail = query(
           collection(db, `artifacts/${appId}/public/data/availabilities`),
           where("professionalId", "==", prof.id),
           where("date", "==", slot.dateStr),
           where("startTime", "==", slot.timeStr)
         );
         const snapAvail = await getDocs(qAvail);
         
         let availId = "";

         if (snapAvail.empty) {
           // Create new availability
           const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/availabilities`), availabilityData);
           availId = docRef.id;
           createdCount++;
         } else {
           // Update existing availability
           availId = snapAvail.docs[0].id;
           await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, availId), {
             status: slot.status,
             location: importedLocation || snapAvail.docs[0].data().location || ""
           });
           updatedCount++;
         }

         // Handle appointments
         const qAppt = query(
           collection(db, `artifacts/${appId}/public/data/appointments`),
           where("availabilityId", "==", availId)
         );
         const snapAppt = await getDocs(qAppt);

         if (slot.status === "LIVRE") {
           // If marked as 'Livre', delete old appointments related to this availability
           await Promise.all(snapAppt.docs.map(apptDoc => deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, apptDoc.id))));
         } else if (slot.status === "OCUPADO") {
           const apptData = {
              availabilityId: availId,
              memberId: slot.matchedMemberId || "unmatched",
              studentName: slot.rawName || "Desconhecido",
              professionalId: prof.id,
              date: slot.dateStr,
              startTime: slot.timeStr,
              endTime: calcEndTime,
              location: importedLocation || snapAvail.docs[0]?.data()?.location || "",
              status: "CONFIRMADO",
           };
           
           if (snapAppt.empty) {
              await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), {
                ...apptData,
                createdAt: new Date().toISOString()
              });
           } else {
              // Update existing appointment
              await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, snapAppt.docs[0].id), apptData);
           }
         }

         current++;
       }));
       if (onProgress) onProgress(current, total);
    }
    
    showAlert(`${total} horários processados. Criados: ${createdCount} | Atualizados: ${updatedCount}`, { type: "success", title: "Sincronização Concluída" });
  };

  const handleDeleteAvailability = async (avail: Availability) => {
    if (avail.status === "OCUPADO") {
       showAlert("Não é possível excluir um horário que já está agendado. Cancele o agendamento primeiro.", { type: "warning", title: "Aviso" });
       return;
    }
    const proceed = await showConfirm("Deseja excluir este horário?");
    if (!proceed) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, avail.id));
    } catch(e) {
      console.error(e);
    }
  };

  const getDayOfWeek = (dateString: string) => {
    const parts = dateString.split('-');
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dateObj.getDay()];
  };

  const filteredAvailabilities = availabilities.filter(a => {
    if (!a.date.startsWith(filterMonth)) return false;
    if (filterProfessional && a.professionalId !== filterProfessional) return false;
    return true;
  });
  
  // Group by seminary then date
  const groupedBySeminary: Record<string, Record<string, Availability[]>> = {};
  filteredAvailabilities.forEach(a => {
    let sem = a.seminary || "Geral / Não Especificado";
    if (a.status === 'OCUPADO') {
       const appt = appointments.find(ap => ap.availabilityId === a.id);
       if (appt && appt.memberId && appt.memberId !== 'unmatched') {
          const student = allStudents.find(s => s.id === appt.memberId);
          if (student && student.seminary) {
             sem = student.seminary;
          }
       }
    }
    if (!groupedBySeminary[sem]) groupedBySeminary[sem] = {};
    if (!groupedBySeminary[sem][a.date]) groupedBySeminary[sem][a.date] = [];
    groupedBySeminary[sem][a.date].push(a);
  });
  
  const sortedSeminaries = Object.keys(groupedBySeminary).sort((a,b) => a.localeCompare(b));


  const changeMonth = (offset: number) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const getMonthName = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
    return month.charAt(0).toUpperCase() + month.slice(1);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Caregando...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            Disponibilizar Horário(s)
          </h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
               onClick={() => setShowDeleteModal(true)}
               className="flex-1 sm:flex-none justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/60 transition"
            >
               <Trash2 className="w-4 h-4"/> Apagar Todos
            </button>
            <button 
               onClick={() => setShowImportModal(true)}
               className="flex-1 sm:flex-none justify-center bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-200 dark:hover:bg-green-900/60 transition"
            >
               <MessageSquare className="w-4 h-4"/> Importar WhatsApp
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-4 mb-2 flex justify-center sm:justify-start">
             <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 w-full sm:w-auto">
                <button
                   onClick={() => setCreationMode("single")}
                   className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${creationMode === "single" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                   Único
                </button>
                <button
                   onClick={() => setCreationMode("batch")}
                   className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${creationMode === "batch" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                   Gerar em Lote (Automático)
                </button>
             </div>
          </div>
          <div className="lg:col-span-2">
             <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Profissional / Atendente *</label>
             <select 
               value={selectedProfId} 
               onChange={e => setSelectedProfId(e.target.value)}
               className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
             >
                <option value="">Selecione quem irá atender...</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.roles && p.roles.length > 0 ? `(${p.roles[0]})` : ''}</option>
                ))}
             </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Data *</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Início *</label>
            <input 
              type="time" 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
            />
          </div>
          {creationMode === "single" ? (
             <div>
               <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fim <span className="opacity-50">(opcional)</span></label>
               <input 
                 type="time" 
                 value={endTime} 
                 onChange={e => setEndTime(e.target.value)}
                 className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
               />
             </div>
          ) : (
             <>
               <div>
                 <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 text-indigo-500">Início do Último Horário *</label>
                 <input 
                   type="time" 
                   value={batchEndTime} 
                   onChange={e => setBatchEndTime(e.target.value)}
                   className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-2.5 text-sm outline-none text-indigo-700 dark:text-indigo-300"
                 />
               </div>
               <div>
                 <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 text-indigo-500">Duração (min) *</label>
                 <select 
                   value={batchDuration} 
                   onChange={e => setBatchDuration(e.target.value)}
                   className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-2.5 text-sm outline-none text-indigo-700 dark:text-indigo-300"
                 >
                    <option value="15">15 minutos</option>
                    <option value="20">20 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="40">40 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="50">50 minutos</option>
                    <option value="60">1 Hora</option>
                    <option value="90">1h 30m</option>
                    <option value="120">2 Horas</option>
                 </select>
               </div>
             </>
          )}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Local (Opcional)</label>
            <input 
              type="text" 
              placeholder="Ex: Sala 2, Capela..."
              value={location} 
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seminário (Opcional)</label>
             <select 
               value={seminary} 
               onChange={e => setSeminary(e.target.value)}
               className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
             >
                <option value="">Geral (Todos os Seminários)</option>
                {AVAILABLE_SEMINARIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
             </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button 
             onClick={handleCreateAvailability}
             className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 transform hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
          >
            <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-shimmer" />
            <Plus className="w-4 h-4 relative z-10" /> <span className="relative z-10">Adicionar Horário</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            Vagas e Agendamentos
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
             <select
               value={filterProfessional}
               onChange={(e) => setFilterProfessional(e.target.value)}
               className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-sm outline-none"
             >
               <option value="">Todos os Profissionais...</option>
               {professionals.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
               ))}
             </select>
             <div className="flex items-center gap-3">
               <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition text-slate-600 dark:text-slate-300">
                 <ChevronLeft className="w-5 h-5"/>
               </button>
               <span className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 min-w-[140px] text-center">
                 {getMonthName()}
               </span>
               <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition text-slate-600 dark:text-slate-300">
                 <ChevronRight className="w-5 h-5"/>
               </button>
             </div>
          </div>
        </div>

        {sortedSeminaries.length === 0 ? (
           <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium text-sm">
             Nenhum horário cadastrado para este mês.
           </div>
        ) : (
          <div className="space-y-10">
            {sortedSeminaries.map(semKey => {
               const groupedByDate = groupedBySeminary[semKey];
               const sortedDates = Object.keys(groupedByDate).sort((a,b) => a.localeCompare(b));
               
               return (
                 <div key={semKey} className="space-y-4">
                   <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">{semKey}</h3>
                   <div className="space-y-6">
                   {sortedDates.map(dateKey => {
                     const dateAvails = groupedByDate[dateKey].sort((a,b) => a.startTime.localeCompare(b.startTime));
                     const parts = dateKey.split('-');
                     const formattedDate = `${parts[2]}/${parts[1]}`;
              
              return (
                <div key={dateKey} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2.5 py-1 rounded-md text-sm shadow-sm border border-indigo-200 dark:border-indigo-800/60">
                      {formattedDate}
                    </span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      ({getDayOfWeek(dateKey)})
                    </span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {dateAvails.map(avail => {
                      const appt = appointments.find(a => a.availabilityId === avail.id && a.status === 'CONFIRMADO');
                      const student = appt ? allStudents.find(p => p.id === appt.memberId) : null;
                      
                      return (
                        <div key={avail.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${avail.status === 'OCUPADO' ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-slate-200 dark:border-slate-700'} flex flex-col justify-between shadow-sm hover:shadow transition-shadow relative overflow-hidden`}>
                          {avail.status === 'OCUPADO' && (
                             <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 dark:bg-emerald-900/20 rounded-bl-3xl flex items-start justify-end p-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                             </div>
                          )}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-sm sm:text-base">
                               <Clock className="w-4 h-4" /> {avail.startTime}
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditingItem({ avail, appt: appt || null })}
                                className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-1.5 rounded-lg transition"
                                title="Editar horário"
                              >
                                 <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteAvailability(avail)}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition"
                                title="Excluir horário"
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="mb-3 flex-grow">
                             <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                               <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> <span className="truncate">{avail.professionalName}</span>
                             </div>
                             <div className="mt-1 space-y-1">
                               {avail.location && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate w-full pl-0.5">
                                     <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" /> {avail.location}
                                  </div>
                               )}
                               {avail.seminary && (
                                  <div className="text-[9px] font-bold py-0.5 px-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 rounded flex w-max">
                                     {avail.seminary}
                                  </div>
                               )}
                             </div>
                          </div>
                          
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
                             {avail.status === 'OCUPADO' && appt ? (
                                <div>
                                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Agendado com</div>
                                   <div className="flex items-center gap-1.5 mt-1">
                                     {student?.photoUrl ? (
                                        <img src={student.photoUrl} alt="Foto" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                                     ) : (
                                        <User className="w-5 h-5 text-emerald-500" />
                                     )}
                                     <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                       {student?.name || appt.studentName || 'Aluno Desconhecido'}
                                       <div className="text-[10px] text-emerald-600/70 border border-emerald-200/50 dark:border-emerald-700/50 rounded px-1 w-max mt-0.5 font-semibold">Agendado</div>
                                     </div>
                                   </div>
                                </div>
                             ) : (
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-900/50 inline-block px-2 py-1 rounded-md">
                                  Livre p/ Agendamento
                                </div>
                             )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>

      {showImportModal && (
        <ImportWhatsappModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportWhatsApp}
          professionals={professionals}
          allStudents={allStudents}
        />
      )}

      {deleteProgress && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700/50">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" /> Apagando Dados...
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Por favor, aguarde o processamento não feche esta página.
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{deleteProgress.current} de {deleteProgress.total}</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{Math.round((deleteProgress.current / Math.max(1, deleteProgress.total)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-3.5 overflow-hidden shadow-inner">
                  <div 
                    className="bg-indigo-500 dark:bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${Math.max(5, (deleteProgress.current / Math.max(1, deleteProgress.total)) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {editingItem && (
        <EditAppointmentModal
          avail={editingItem.avail}
          appt={editingItem.appt}
          professionals={professionals}
          allStudents={allStudents}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            showAlert("Horário atualizado com sucesso!", { type: 'success' });
          }}
        />
      )}

      {showDeleteModal && (
        <DeleteAvailabilitiesModal
          professionals={professionals}
          onClose={() => setShowDeleteModal(false)}
          onProgress={(current, total) => setDeleteProgress({ current, total })}
          onSuccess={() => {
            setDeleteProgress(null);
            showAlert("Registros apagados com sucesso.", { type: "success" });
          }}
        />
      )}
    </div>
  );
}
