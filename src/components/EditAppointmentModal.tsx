import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, updateDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { Member, Availability, Appointment } from "../types";
import { X, Save } from "lucide-react";

interface EditAppointmentModalProps {
  avail: Availability;
  appt: Appointment | null;
  professionals: Member[];
  allStudents: Member[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAppointmentModal({ avail, appt, professionals, allStudents, onClose, onSuccess }: EditAppointmentModalProps) {
  const [date, setDate] = useState(avail.date);
  const [startTime, setStartTime] = useState(avail.startTime);
  const [endTime, setEndTime] = useState(avail.endTime || "");
  const [location, setLocation] = useState(avail.location || "");
  const [professionalId, setProfessionalId] = useState(avail.professionalId);
  const [status, setStatus] = useState(avail.status);
  const [memberId, setMemberId] = useState(appt ? appt.memberId : "");
  // To handle plain text names when editing a whatsapp import
  const [studentName, setStudentName] = useState(appt?.studentName || "");

  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const prof = professionals.find(p => p.id === professionalId);
      
      const availUpdate = {
        date,
        startTime,
        endTime,
        location,
        professionalId,
        professionalName: prof?.name || avail.professionalName,
        status
      };
      
      await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, avail.id), availUpdate);

      if (status === "LIVRE") {
        if (appt) {
          // If changed from Ocupado to Livre, delete appointment or mark it canceled
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, appt.id));
        }
      } else {
        // Status OCUPADO
        let matchedMemberId = memberId || "unmatched";
        let resolvedStudentName = studentName || "Desconhecido";
        
        if (matchedMemberId !== "unmatched") {
          const m = allStudents.find(s => s.id === matchedMemberId);
          if (m) resolvedStudentName = m.name;
        }

        const apptData = {
          date,
          startTime,
          endTime,
          location,
          professionalId,
          memberId: matchedMemberId,
          studentName: resolvedStudentName,
          status: "CONFIRMADO"
        };

        if (appt) {
          await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, appt.id), apptData);
        } else {
          // Create new appt
          await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), {
             ...apptData,
             availabilityId: avail.id,
             createdAt: new Date().toISOString()
          });
        }
      }
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] my-auto">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Horário</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 min-h-0">
          <div>
             <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Profissional</label>
             <select 
               value={professionalId} 
               onChange={e => setProfessionalId(e.target.value)}
               className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300"
             >
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
             </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Data</label>
               <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300" />
             </div>
             <div>
               <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Início</label>
               <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300" />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fim</label>
               <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300" />
             </div>
             <div>
               <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Local</label>
               <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300" />
             </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as "LIVRE" | "OCUPADO")} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold outline-none dark:text-slate-300">
               <option value="LIVRE">Livre p/ Agendamento</option>
               <option value="OCUPADO">Ocupado / Agendado</option>
            </select>
          </div>
          
          {status === "OCUPADO" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Aluno Vinculado</label>
                <select value={memberId} onChange={e => setMemberId(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300">
                   <option value="">-- Sem vínculo (preencher nome abaixo) --</option>
                   {allStudents.filter(s => s.roles?.includes('ALUNO(A)') || s.roles?.includes('SEMINARISTA')).map(s => (
                     <option key={s.id} value={s.id}>{s.name} ({s.course || 'Sem Curso'})</option>
                   ))}
                </select>
              </div>
              {!memberId && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nome Manual (Importação)</label>
                  <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300" placeholder="Nome original sem vínculo" />
                </div>
              )}
            </div>
          )}

        </div>
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-3xl shrink-0">
           <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition">Cancelar</button>
           <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center gap-2">
             <Save className="w-4 h-4" /> {loading ? "Salvando..." : "Salvar Alterações"}
           </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
