import { BriefcaseMedical, Settings } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import SchedulingManager from "./SchedulingManager";

export default function AdminAppointments() {
  const { settings } = useSettings();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-2xl mx-auto mt-8">
      <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center mx-auto mb-6">
        <BriefcaseMedical className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-4">Sistema Simplificado</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
        Os agendamentos agora são gerenciados externamente por cada profissional. 
        Você pode configurar o link de WhatsApp ou Google Agenda de cada profissional nas configurações do sistema.
      </p>
      
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl text-left border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          Status Atual das Configurações
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Link Externo Global:</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {settings.appointmentsExternalLink ? (
                <span className="text-emerald-600 dark:text-emerald-400">Configurado</span>
              ) : (
                <span className="text-slate-400">Não Configurado</span>
              )}
            </span>
          </div>
          
          </div>
      </div>
      
      <div className="mt-8 text-left">
        <SchedulingManager />
      </div>
    </div>
  );
}
