import React, { useState, useEffect } from "react";
import { collection, query, getDocs, doc, addDoc, updateDoc, where } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { Member, Appointment, Availability } from "../types";
import { Calendar, Clock, User, HeartHandshake, ShieldCheck, RefreshCw, Instagram, Facebook, Users, Car } from "lucide-react";
import MuralPage from "./MuralPage";
import DobloControl from "./DobloControl";

import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import { useSettings } from "../context/SettingsContext";

export default function PublicAppointmentsList({ member, onNavigateToStudent }: { member: Member | null; onNavigateToStudent?: () => void }) {
  const { showAlert, showConfirm } = useDialog();
  const { settings: cloudSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"agendamentos" | "grupos" | "doblo">("agendamentos");
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, Member>>({});
  const [students, setStudents] = useState<Record<string, Member>>({});
  const [selectedProfId, setSelectedProfId] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load availabilities
      const availQ = query(collection(db, `artifacts/${appId}/public/data/availabilities`));
      const availSnap = await getDocs(availQ);
      const avails = availSnap.docs.map(d => ({ id: d.id, ...d.data() } as Availability));
      
      // Load appointments
      const apptQ = query(collection(db, `artifacts/${appId}/public/data/appointments`));
      const apptSnap = await getDocs(apptQ);
      const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

      // Load all students to resolve names
      const studentsQ = query(collection(db, `artifacts/${appId}/public/data/students`));
      const studentsSnap = await getDocs(studentsQ);
      const studMap: Record<string, Member> = {};
      const profMap: Record<string, Member> = {};

      if (cloudSettings?.professionals) {
        cloudSettings.professionals.forEach(p => {
          profMap[p.id] = {
            id: p.id,
            name: p.name,
            roles: [p.role],
            photoUrl: p.photoUrl || undefined,
            isActive: true,
          } as Member;
        });
      }
      
      if (cloudSettings?.seminariesConfig) {
        Object.values(cloudSettings.seminariesConfig).forEach((semConfig: any) => {
          if (semConfig.professionals) {
            semConfig.professionals.forEach((p: any) => {
              if (!Object.values(profMap).some((pm: any) => pm.name.toLowerCase() === p.name.toLowerCase())) {
                profMap[p.id] = {
                  id: p.id,
                  name: p.name,
                  roles: [p.role],
                  photoUrl: p.photoUrl || undefined,
                  isActive: true,
                } as Member;
              }
            });
          }
        });
      }
      
      studentsSnap.docs.forEach(d => {
        const data = d.data() as Member;
        studMap[d.id] = { id: d.id, ...data };
        
        // Dynamically add professionals from students list
        if (data.roles?.some(r => ["REITOR", "VICE-REITOR", "DIRETOR ESPIRITUAL", "PSICÓLOGA"].includes(r.toUpperCase()))) {
          if (!Object.values(profMap).some((pm: any) => pm.name.toLowerCase() === data.name.toLowerCase())) {
            profMap[d.id] = { id: d.id, ...data };
          }
        }
      });

      // Remove DEFAULT_PROFESSIONALS if we loaded dynamic ones and didn't fall back, or just ensure if profMap is empty we add defaults
      if (Object.keys(profMap).length === 0) {
        DEFAULT_PROFESSIONALS.forEach(p => {
          profMap[p.id] = { ...p };
        });
      }

      // Filter out past dates to keep the list clean (e.g. >= today)
      const now = new Date().toISOString().split('T')[0];
      setAvailabilities(avails.filter(a => a.date >= now));
      setAppointments(appts.filter(a => a.date >= now && a.status === "CONFIRMADO"));
      setStudents(studMap);
      setProfessionals(profMap);
    } catch (err) {
      console.error(err);
      showAlert("Erro ao carregar agendamentos.", { type: "error" });
    }
    setLoading(false);
  };

  const handleBook = async (avail: Availability) => {
    if (!member) {
      if (onNavigateToStudent) onNavigateToStudent();
      else showAlert("Você precisa vincular sua identidade na aba MINHA ID primeiro.", { type: "warning" });
      return;
    }
    const confirmed = await showConfirm(`Deseja agendar com ${avail.professionalName} no dia ${new Date(avail.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${avail.startTime}?`);
    if (!confirmed) return;

    try {
      const newAppt: Omit<Appointment, "id"> = {
        availabilityId: avail.id,
        memberId: member.id,
        professionalId: avail.professionalId,
        date: avail.date,
        startTime: avail.startTime,
        endTime: avail.endTime || "",
        location: avail.location || "",
        status: "CONFIRMADO",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), newAppt);
      await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, avail.id), { status: "OCUPADO" });
      
      showAlert("Agendamento confirmado!", { type: "success" });
      loadData();
    } catch (error) {
      console.error(error);
      showAlert("Erro ao agendar.", { type: "error" });
    }
  };

  const handleSwapRequest = async (myAppt: Appointment, targetAvail: Availability) => {
    if (!member) return;
    const confirmed = await showConfirm(`Deseja trocar o seu horário do dia ${new Date(myAppt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${myAppt.startTime} para o dia ${new Date(targetAvail.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${targetAvail.startTime}? O administrador será notificado.`);
    if (!confirmed) return;

    try {
      // 1. Liberar horário antigo
      await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, myAppt.availabilityId), { status: "LIVRE" });
      
      // 2. Ocupar novo horário
      await updateDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, targetAvail.id), { status: "OCUPADO" });
      
      // 3. Atualizar o agendamento
      await updateDoc(doc(db, `artifacts/${appId}/public/data/appointments`, myAppt.id), {
        availabilityId: targetAvail.id,
        date: targetAvail.date,
        startTime: targetAvail.startTime,
        endTime: targetAvail.endTime || "",
        professionalId: targetAvail.professionalId,
        location: targetAvail.location || ""
      });

      const swapMessage = `O aluno ${member.name} trocou seu horário do dia ${new Date(myAppt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${myAppt.startTime} para o dia ${new Date(targetAvail.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${targetAvail.startTime} com ${targetAvail.professionalName}.`;

      // Add notification to admin
      await addDoc(collection(db, `artifacts/${appId}/public/data/notifications`), {
        recipientId: "admin",
        title: "Troca de Horário Realizada",
        message: swapMessage,
        type: "appointment_swap",
        status: "unread",
        createdAt: new Date().toISOString(),
        metadata: {
          studentId: member.id,
          studentName: member.name,
          currentAppointmentId: myAppt.id,
          targetAvailabilityId: targetAvail.id
        }
      });

      // Add notification to the NEW professional
      await addDoc(collection(db, `artifacts/${appId}/public/data/notifications`), {
        recipientId: targetAvail.professionalId,
        title: "Novo Agendamento (Troca)",
        message: `O aluno ${member.name} agendou com você para o dia ${new Date(targetAvail.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${targetAvail.startTime} através de uma troca de horário.`,
        type: "appointment_swap",
        status: "unread",
        createdAt: new Date().toISOString(),
      });

      // Add notification to the OLD professional (if different from new)
      if (myAppt.professionalId !== targetAvail.professionalId) {
        await addDoc(collection(db, `artifacts/${appId}/public/data/notifications`), {
          recipientId: myAppt.professionalId,
          title: "Horário Liberado (Troca)",
          message: `O aluno ${member.name} cancelou o agendamento com você do dia ${new Date(myAppt.date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${myAppt.startTime} pois trocou de horário. O seu horário está agora livre.`,
          type: "appointment_swap",
          status: "unread",
          createdAt: new Date().toISOString(),
        });
      }

      showAlert("Troca de horário realizada com sucesso!", { type: "success" });
      loadData();
    } catch (e) {
      console.error(e);
      showAlert("Erro ao trocar horário.", { type: "error" });
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-sky-500 animate-spin"></div></div>;
  }

  // Create a combined list of all availabilities and their corresponding appointments
  let displayList = availabilities.map(avail => {
    const appt = appointments.find(a => a.availabilityId === avail.id);
    const studentName = appt ? (appt.studentName || students[appt.memberId]?.name || "Desconhecido") : null;
    return {
      ...avail,
      isBooked: !!appt,
      studentName,
      appointmentId: appt?.id,
      appointmentMemberId: appt?.memberId
    };
  });

  if (selectedProfId !== "all") {
    displayList = displayList.filter(item => item.professionalId === selectedProfId);
  }

  // Group by Date -> sort by time
  const groupedDates = displayList.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, typeof displayList>);

  const sortedDates = Object.keys(groupedDates).sort();

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-6 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setActiveSubTab("agendamentos")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
            activeSubTab === "agendamentos"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          Agendamentos
        </button>
        <button
          onClick={() => setActiveSubTab("grupos")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
            activeSubTab === "grupos"
              ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          Grupos Oficiais
        </button>
        <button
          onClick={() => setActiveSubTab("doblo")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
            activeSubTab === "doblo"
              ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Car className="w-4 h-4" />
          Controle da Doblô
        </button>
      </div>

      {activeSubTab === "agendamentos" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-sky-500" />
                Agendamentos
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Veja a lista de horários e solicite trocas se necessário.</p>
            </div>
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none font-bold text-slate-700 dark:text-slate-300"
            >
          <option value="all">Todos os Profissionais</option>
          {Object.values(professionals as Record<string, any>).map(prof => (
            <option key={prof.id} value={prof.id}>{prof.name}</option>
          ))}
        </select>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Nenhum horário disponível</p>
          <p className="text-xs text-slate-500">Não há horários cadastrados para o período atual.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const dateObj = new Date(date + 'T12:00:00');
            const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
            const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const slots = groupedDates[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            return (
              <div key={date} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 dark:bg-slate-900/50 px-5 py-3 border-b border-slate-200 dark:border-slate-700 font-black text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  {dateStr} <span className="text-[10px] opacity-60">({dayOfWeek})</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {slots.map(slot => {
                    const isMyAppointment = member && slot.appointmentMemberId === member.id;
                    const hasOtherAppointment = member && appointments.some(a => a.memberId === member.id && a.id !== slot.appointmentId);
                    const myAppt = member ? appointments.find(a => a.memberId === member.id) : null;

                    return (
                      <div key={slot.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${isMyAppointment ? 'bg-sky-50 dark:bg-sky-900/10' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className="text-center min-w-[70px] bg-slate-100 dark:bg-slate-700/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="font-black text-xl text-slate-800 dark:text-white leading-none">{slot.startTime}</p>
                            
                            {/* PROFESSIONAL INFO */}
                            <div className="mt-2 flex flex-col items-center gap-1">
                              {(professionals[slot.professionalId]?.photoUrl || Object.values(professionals as Record<string, any>).find(p => p.name === slot.professionalName)?.photoUrl) ? (
                                <img src={professionals[slot.professionalId]?.photoUrl || Object.values(professionals as Record<string, any>).find(p => p.name === slot.professionalName)?.photoUrl} alt="Foto" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-sky-200 dark:bg-sky-900/50 flex items-center justify-center">
                                  <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                                </div>
                              )}
                              <p className="text-[10px] sm:text-xs text-center uppercase font-bold text-sky-600 dark:text-sky-400 leading-tight" title={slot.professionalName}>{slot.professionalName}</p>
                            </div>
                          </div>
                          
                          <div className="border-l border-slate-200 dark:border-slate-700 pl-4 py-1 flex flex-col justify-center">
                            {slot.isBooked ? (
                              <div className="mt-2 text-left">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agendado com</div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                  {slot.appointmentMemberId && students[slot.appointmentMemberId]?.photoUrl ? (
                                    <img src={students[slot.appointmentMemberId].photoUrl} alt="Foto" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 text-slate-400" />
                                  )}
                                  {slot.studentName}
                                  {isMyAppointment && (
                                    <span className="ml-2 text-[9px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Meu Horário</span>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  Livre
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pl-[76px] sm:pl-0 mt-2 sm:mt-0">
                          {!slot.isBooked && (
                            <button
                              onClick={() => handleBook(slot)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Agendar
                            </button>
                          )}
                          {!slot.isBooked && hasOtherAppointment && myAppt && (
                            <button
                              onClick={() => handleSwapRequest(myAppt, slot)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Trocar Horário
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
      )}

      {activeSubTab === "grupos" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://instagram.com/seminarioprovincial.scj" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 w-full sm:w-auto">
              <Instagram className="w-5 h-5" />
              Siga no Instagram
            </a>
            <a href="https://facebook.com/seminarioprovincial.scj" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 w-full sm:w-auto">
              <Facebook className="w-5 h-5" />
              Siga no Facebook
            </a>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-800/50">
            <MuralPage forcedTab="seminario" hideTabs={true} />
          </div>
        </div>
      )}

      {activeSubTab === "doblo" && (
        <DobloControl currentUser={member} isAdmin={member?.roles?.includes("ADMIN") || false} />
      )}
    </div>
  );
}
