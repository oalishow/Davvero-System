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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 p-1.5 shadow-sm">
                <svg viewBox="0 0 100 100" className="w-full h-full text-sky-400">
                  <path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
                  <path d="M42,15 L58,15 L58,28 L71,28 L71,44 L58,44 L58,65 L42,65 L42,44 L29,44 L29,28 L42,28 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                  <g transform="translate(20, 38) scale(0.6)">
                    <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
                    <path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" />
                    <path d="M50,45 L78,55 L78,70" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="78" cy="72" r="4" fill="currentColor"/>
                  </g>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">Relatório de Agendamentos</h2>
                <p className="text-xs text-slate-500">Visualização para impressão da base de agendamentos • DAVVERO System</p>
              </div>
            </div>
            
            {!loading && professionalsNames.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profissional:</label>
                <select
                  value={selectedProfessional}
                  onChange={e => setSelectedProfessional(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm outline-none dark:text-slate-200 cursor-pointer"
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
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Imprimir Agora
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Cabeçalho de Impressão (Visível apenas na impressão) */}
        <div className="hidden print:flex items-center justify-between mb-8 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 p-1.5 border border-slate-800">
              <svg viewBox="0 0 100 100" className="w-full h-full text-white">
                <path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
                <path d="M42,15 L58,15 L58,28 L71,28 L71,44 L58,44 L58,65 L42,65 L42,44 L29,44 L29,28 L42,28 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <g transform="translate(20, 38) scale(0.6)">
                  <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
                  <path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" />
                  <path d="M50,45 L78,55 L78,70" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="78" cy="72" r="4" fill="currentColor"/>
                </g>
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black uppercase tracking-wider text-black">Relatório de Agendamentos</h1>
              {selectedProfessional !== 'all' && (
                <h2 className="text-xs font-bold text-slate-700">Profissional: {selectedProfessional}</h2>
              )}
              <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">DAVVERO SYSTEM • GESTÃO DE ATENDIMENTOS</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold text-black">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p className="text-[11px] text-slate-600 italic">Total de agendamentos: {filteredAppointments.length}</p>
          </div>
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
