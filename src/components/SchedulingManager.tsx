import React, { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { Save, Plus, Trash2, Calendar, MessageCircle, Link as LinkIcon, ShieldCheck, Upload } from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";

export default function SchedulingManager() {
  const { settings, updateSettings } = useSettings();
  const { showAlert } = useDialog();
  const [saving, setSaving] = useState(false);
  const [localProfs, setLocalProfs] = useState(
    settings.professionals && settings.professionals.length > 0 
      ? settings.professionals 
      : DEFAULT_PROFESSIONALS.map(p => ({
          id: p.id,
          name: p.name,
          role: p.roles?.[0] || "PROFISSIONAL",
          photoUrl: null,
          appointmentLink: p.id === 'prof_anderson' ? 'https://calendar.app.google/shVAPdZTNeDs2PaGA' : (p.id === 'prof_altair' ? 'https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP' : ''),
          appointmentType: p.id === 'prof_anderson' ? 'google_calendar' : (p.id === 'prof_altair' ? 'whatsapp' : 'other'),
          whatsappNumber: ""
        }))
  );

  const handleAdd = () => {
    setLocalProfs([
      ...localProfs,
      {
        id: "prof_" + Math.random().toString(36).substr(2, 9),
        name: "",
        role: "PROFISSIONAL",
        photoUrl: null,
        appointmentLink: "",
        appointmentType: "whatsapp",
        whatsappNumber: ""
      }
    ]);
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    setLocalProfs(localProfs.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemove = (id: string) => {
    setLocalProfs(localProfs.filter(p => p.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ professionals: localProfs });
      showAlert("Configurações de agendamento salvas com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar configurações", "error");
    } finally {
      setSaving(false);
    }
  };

  
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
    maxSizeKB = 5120
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeKB * 1024) {
      showAlert(`Arquivo muito grande. Máximo ${maxSizeKB}KB.`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 800;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = file.type === "image/png" ? canvas.toDataURL("image/png", 0.8) : canvas.toDataURL("image/jpeg", 0.7);
          setter(dataUrl);
        } else {
          setter(ev.target?.result as string);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const getIcon = (type?: string) => {
    if (type === "whatsapp") return <MessageCircle className="w-5 h-5 text-emerald-500" />;
    if (type === "google_calendar") return <Calendar className="w-5 h-5 text-blue-500" />;
    return <LinkIcon className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" />
            Gerenciador de Agendamentos
          </h2>
          <p className="text-xs text-slate-500 mt-1">Configure o método de agendamento para cada profissional</p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
        >
          <Plus className="w-4 h-4" /> Adicionar Profissional
        </button>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {localProfs.map((prof) => (
            <div key={prof.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
              
              
<div className="flex items-center gap-4 w-full">
  <div className="shrink-0">
    {prof.photoUrl ? (
      <div className="relative">
        <img src={prof.photoUrl} alt="Foto" className="w-16 h-16 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
        <button onClick={() => handleUpdate(prof.id, "photoUrl", null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    ) : (
      <label className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">
        <Upload className="w-5 h-5 text-slate-400" />
        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
          handleFileUpload(e, (val) => {
            handleUpdate(prof.id, "photoUrl", val);
          });
        }} />
      </label>
    )}
  </div>
  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nome do Profissional</label>
                  <input
                    type="text"
                    value={prof.name}
                    onChange={(e) => handleUpdate(prof.id, "name", e.target.value)}
                    placeholder="Ex: Pe. João"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Especialidade / Função</label>
                  <input
                    type="text"
                    value={prof.role}
                    onChange={(e) => handleUpdate(prof.id, "role", e.target.value.toUpperCase())}
                    placeholder="Ex: DIRETOR ESPIRITUAL"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
              </div>
</div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Tipo de Link</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {getIcon(prof.appointmentType)}
                    </div>
                    <select
                      value={prof.appointmentType || "whatsapp"}
                      onChange={(e) => handleUpdate(prof.id, "appointmentType", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none"
                    >
                      <option value="whatsapp">WhatsApp (Grupo/Privado)</option>
                      <option value="google_calendar">Google Agenda</option>
                      <option value="other">Outro Link</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">URL de Redirecionamento</label>
                  <input
                    type="text"
                    value={prof.appointmentLink || ""}
                    onChange={(e) => handleUpdate(prof.id, "appointmentLink", e.target.value)}
                    placeholder="Ex: https://..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">WhatsApp (Opcional)</label>
                    <input
                      type="text"
                      value={prof.whatsappNumber || ""}
                      onChange={(e) => handleUpdate(prof.id, "whatsappNumber", e.target.value)}
                      placeholder="Ex: (00) 00000-0000"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                  <button
                    onClick={() => handleRemove(prof.id)}
                    className="p-3 bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded-xl transition-colors shrink-0"
                    title="Remover"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {localProfs.length === 0 && (
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">Nenhum profissional configurado.</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
