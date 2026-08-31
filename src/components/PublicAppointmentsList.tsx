import React, { useState, useEffect } from "react";
import { Member } from "../types";
import { HeartHandshake, ShieldCheck, Instagram, Facebook, Users, Car, ExternalLink, Calendar as CalendarIcon, MessageCircle, BookHeart } from "lucide-react";
import MuralPage from "./MuralPage";
import DobloControl from "./DobloControl";
import LiturgyPanel from "./LiturgyPanel";
import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import { useSettings } from "../context/SettingsContext";

export default function PublicAppointmentsList({ member, onNavigateToStudent }: { member: Member | null; onNavigateToStudent?: () => void }) {
  const { settings: cloudSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"agendamentos" | "liturgia" | "doblo" | "grupos">("agendamentos");
  
  // We'll store professionals with their appointmentLinks
  const [professionalsList, setProfessionalsList] = useState<{ id: string, name: string, role: string, photoUrl?: string, appointmentLink?: string, appointmentType?: string, whatsappNumber?: string }[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const profMap: Record<string, any> = {};

      if (cloudSettings?.professionals) {
        cloudSettings.professionals.forEach(p => {
          profMap[p.id] = { ...p };
        });
      }
      
      if (cloudSettings?.seminariesConfig) {
        Object.values(cloudSettings.seminariesConfig).forEach((semConfig: any) => {
          if (semConfig.professionals) {
            semConfig.professionals.forEach((p: any) => {
              if (!Object.values(profMap).some((pm: any) => pm.name.toLowerCase() === p.name.toLowerCase())) {
                profMap[p.id] = { ...p };
              }
            });
          }
        });
      }

      if (Object.keys(profMap).length === 0) {
        DEFAULT_PROFESSIONALS.forEach(p => {
          profMap[p.id] = { ...p, appointmentLink: p.id === 'prof_anderson' ? 'https://calendar.app.google/shVAPdZTNeDs2PaGA' : (p.id === 'prof_altair' ? 'https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP' : ''), appointmentType: p.id === 'prof_anderson' ? 'google_calendar' : (p.id === 'prof_altair' ? 'whatsapp' : 'other'), whatsappNumber: p.whatsappNumber || '' };
        });
      }

      setProfessionalsList(Object.values(profMap));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfessionals = selectedProfId === "all" 
    ? professionalsList 
    : professionalsList.filter(p => p.id === selectedProfId);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-6 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50 gap-1">
        <button
          onClick={() => setActiveSubTab("agendamentos")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === "agendamentos"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Agendamentos</span>
        </button>
        <button
          onClick={() => setActiveSubTab("liturgia")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === "liturgia"
              ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <BookHeart className="w-4 h-4" />
          <span>Portal Católico</span>
        </button>
        <button
          onClick={() => setActiveSubTab("doblo")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === "doblo"
              ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Controle da Doblô</span>
        </button>
        <button
          onClick={() => setActiveSubTab("grupos")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === "grupos"
              ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Grupos Oficiais</span>
        </button>
      </div>

      {activeSubTab === "agendamentos" && (
        <>
          {cloudSettings?.appointmentsExternalLink ? (
            <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center mb-6">
                <HeartHandshake className="w-10 h-10 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase mb-4">Agendamentos</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                O sistema de agendamentos utiliza um canal externo. Clique no botão abaixo para acessar.
              </p>
              <a 
                href={cloudSettings.appointmentsExternalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-modern px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-1 active:scale-95"
              >
                Acessar Canal de Agendamentos
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-sky-500" />
                    Profissionais
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Selecione o profissional para agendar um horário.</p>
                </div>
                <select
                  value={selectedProfId}
                  onChange={(e) => setSelectedProfId(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none font-bold text-slate-700 dark:text-slate-300"
                >
                  <option value="all">Todos os Profissionais</option>
                  {professionalsList.map(prof => (
                    <option key={prof.id} value={prof.id}>{prof.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProfessionals.map(prof => (
                  <div key={prof.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center text-center transition-all hover:shadow-md">
                    {prof.photoUrl ? (
                      <img src={prof.photoUrl} alt={prof.name} className="w-24 h-24 rounded-full border-4 border-slate-50 dark:border-slate-700 object-cover shadow-sm mb-4" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-sky-50 dark:bg-sky-900/20 border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-sm mb-4">
                        <ShieldCheck className="w-10 h-10 text-sky-500" />
                      </div>
                    )}
                    <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{prof.name}</h4>
                    <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-6">{prof.role}</p>
                    
                    {prof.appointmentLink ? (
                      <a 
                        href={prof.appointmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        {prof.appointmentType === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : prof.appointmentType === "google_calendar" ? <CalendarIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        Agendar Horário
                      </a>
                    ) : (
                      <button 
                        disabled
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      >
                        Indisponível
                      </button>
                    )}
                    {prof.whatsappNumber && (
                      <a href={`https://wa.me/${prof.whatsappNumber.replace(/\D/g, '').startsWith('55') ? prof.whatsappNumber.replace(/\D/g, '') : '55' + prof.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full mt-3 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                        <MessageCircle className="w-4 h-4 fill-white" />
                        Falar no WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === "liturgia" && (
        <div className="pt-2">
          <LiturgyPanel />
        </div>
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
        <DobloControl
          currentUser={member}
          isAdmin={
            member?.roles?.some((r) =>
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
              ].includes(r.toLowerCase().trim())
            ) || false
          }
        />
      )}
    </div>
  );
}
