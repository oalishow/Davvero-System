import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Loader2 } from "lucide-react";
import { collection, query, getDocs } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { Availability, Appointment } from "../types";
import { APP_VERSION } from "../lib/constants";

interface PrintAppointmentsModalProps {
  onClose: () => void;
}

export default function PrintAppointmentsModal({ onClose }: PrintAppointmentsModalProps) {
  const [appointmentsData, setAppointmentsData] = useState<{avail: Availability, appt: Appointment}[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const qAvails = query(collection(db, `artifacts/${appId}/public/data/availabilities`));
        const snapAvails = await getDocs(qAvails);
        const avails = snapAvails.docs.map(doc => ({ id: doc.id, ...doc.data() } as Availability));
        
        avails.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.startTime.localeCompare(a.startTime);
        });
        
        const qAppts = query(collection(db, `artifacts/${appId}/public/data/appointments`));
        const snapAppts = await getDocs(qAppts);
        const appts = snapAppts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        const qStudents = query(collection(db, `artifacts/${appId}/public/data/students`));
        const snapStudents = await getDocs(qStudents);
        const students = snapStudents.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const combined = avails
          .filter(a => a.status === 'OCUPADO')
          .map(a => {
             const appt = appts.find(ap => ap.availabilityId === a.id);
             let studentSeminary = a.seminary || 'Geral';
             if (appt && appt.memberId && appt.memberId !== 'unmatched') {
                 const student = students.find(s => s.id === appt.memberId);
                 if (student && student.seminary) {
                     studentSeminary = student.seminary;
                 }
             }
             return { avail: a, appt: appt as Appointment, studentSeminary };
          })
          .filter(item => item.appt != null);
          
        setAppointmentsData(combined as any);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const getDayOfWeek = (dateString: string) => {
    const parts = dateString.split('-');
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[dateObj.getDay()];
  };

  const professionalsNames = Array.from(new Set(appointmentsData.map(item => item.avail.professionalName))).sort();

  const filteredAppointments = selectedProfessional === 'all'
    ? appointmentsData
    : appointmentsData.filter(item => item.avail.professionalName === selectedProfessional);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[200] overflow-y-auto print:static print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-5xl my-auto max-h-[95vh] overflow-y-auto custom-scrollbar animated-scale-in flex flex-col print:shadow-none print:border-none print:max-h-none print:overflow-visible print:w-full print:max-w-none print:p-0 print:bg-white print:text-black">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-30 no-print">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Relatório de Agendamentos</h2>
            <p className="text-xs text-slate-500">Visualização para impressão da base de agendamentos ocupados.</p>
            
            {!loading && professionalsNames.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profissional:</label>
                <select
                  value={selectedProfessional}
                  onChange={e => setSelectedProfessional(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm outline-none dark:text-slate-200"
                >
                  <option value="all">Todos os Profissionais</option>
                  {professionalsNames.map(prof => (
                    <option key={prof} value={prof}>{prof}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handlePrint} 
              disabled={loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimir Agora
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Cabeçalho de Impressão (Visível apenas na impressão) */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-widest">Relatório de Agendamentos</h1>
            {selectedProfessional !== 'all' && (
              <h2 className="text-lg font-semibold mt-1">Profissional: {selectedProfessional}</h2>
            )}
            <p className="text-sm mt-1">Gerado em: {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
            <p className="text-xs mt-1 italic">Total de agendamentos: {filteredAppointments.length}</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 no-print">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">A carregar agendamentos para impressão...</p>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible space-y-8">
            {(Object.entries(
              filteredAppointments.reduce((acc, item) => {
                const sem = (item as any).studentSeminary || item.avail.seminary || 'Outros / Não Especificado';
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(item);
                return acc;
              }, {} as Record<string, any[]>)
            ) as [string, any[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([seminary, items]) => (
              <div key={seminary} className="break-inside-avoid">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 pb-2 border-b-2 border-slate-800 print:text-black">{seminary}</h3>
                <table className="w-full text-left border-collapse print:text-black mb-6">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 print:bg-slate-100">
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Data</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Horário</th>
                      {selectedProfessional === 'all' && (
                        <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Profissional</th>
                      )}
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Aluno / Agendado por</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ avail, appt }: any) => {
                      const parts = avail.date.split('-');
                      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                      return (
                        <tr key={avail.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-bold whitespace-nowrap">{formattedDate} <br/><span className="text-[10px] font-normal text-slate-500">{getDayOfWeek(avail.date)}</span></td>
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-indigo-600">{avail.startTime}</td>
                          {selectedProfessional === 'all' && (
                            <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 font-semibold">{avail.professionalName}</td>
                          )}
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-emerald-600 font-bold">{appt.studentName || 'Desconhecido'}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600">{avail.location || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            
            {filteredAppointments.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum agendamento encontrado.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-[10px] text-slate-400 no-print">
            Relatório gerado pelo sistema v.{APP_VERSION}
        </div>
      </div>
    </div>,
    document.body
  );
}
