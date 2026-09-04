import React, { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import {
  Save,
  Plus,
  Trash2,
  Calendar,
  MessageCircle,
  Link as LinkIcon,
  ShieldCheck,
  Upload,
  Video,
  FileText,
  Eye,
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import { compressAvatar, sanitizeProfessionalList } from "../lib/imageCompressor";
import { AVAILABLE_SEMINARIES, ProfessionalConfig } from "../types";
import FormationDocModal from "./FormationDocModal";

export default function SchedulingManager() {
  const { settings, updateSettings } = useSettings();
  const { showAlert } = useDialog();
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name?: string;
    type?: "pdf" | "image" | "link";
    profName?: string;
  } | null>(null);

  const [localProfs, setLocalProfs] = useState<ProfessionalConfig[]>(() => {
    const initial =
      settings.professionals && settings.professionals.length > 0
        ? settings.professionals
        : DEFAULT_PROFESSIONALS.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.roles?.[0] || "PROFISSIONAL",
            photoUrl: null,
            appointmentLink:
              p.id === "prof_anderson"
                ? "https://calendar.app.google/shVAPdZTNeDs2PaGA"
                : p.id === "prof_altair"
                ? "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP"
                : "",
            appointmentType:
              p.id === "prof_anderson"
                ? "google_calendar"
                : p.id === "prof_altair"
                ? "whatsapp"
                : "other",
            whatsappNumber: "",
            seminary: p.seminary || "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
            meetingLinkFilosofia: "",
            meetingLinkTeologia: "",
            formationDocUrl: null,
            formationDocName: "",
            formationDocType: "pdf",
            formationDocDescription: "",
          }));

    return initial.map((p) => {
      const isProvincial =
        p.id === "prof_altair" ||
        p.id === "prof_anderson" ||
        p.id === "prof_alan" ||
        p.id === "prof_alessandra" ||
        p.name.toLowerCase().includes("altair") ||
        p.name.toLowerCase().includes("anderson") ||
        p.name.toLowerCase().includes("alan") ||
        p.name.toLowerCase().includes("alessandra");
      if (isProvincial && (!p.seminary || p.seminary === "" || p.seminary === "Todos os Seminários")) {
        return { ...p, seminary: "SPSCJ - Seminário Provincial Sagrado Coração de Jesus" };
      }
      return p;
    });
  });

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
        whatsappNumber: "",
        seminary: "",
        meetingLinkFilosofia: "",
        meetingLinkTeologia: "",
        formationDocUrl: null,
        formationDocName: "",
        formationDocType: "pdf",
        formationDocDescription: "",
      },
    ]);
  };

  const handleUpdate = (id: string, field: keyof ProfessionalConfig, value: any) => {
    setLocalProfs(
      localProfs.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleRemove = (id: string) => {
    setLocalProfs(localProfs.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sanitized = await sanitizeProfessionalList(localProfs);
      await updateSettings({ professionals: sanitized });
      setLocalProfs(sanitized);
      showAlert("Configurações de agendamento salvas com sucesso!", "success");
    } catch (e: any) {
      console.error(e);
      if (e?.code === "invalid-argument" || e?.message?.includes("too large")) {
        showAlert(
          "Erro: As fotos ou documentos dos profissionais estão muito grandes. Utilize um link externo para arquivos pesados.",
          "error"
        );
      } else {
        showAlert("Erro ao salvar configurações", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
    maxSizeKB = 25600
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeKB * 1024) {
      showAlert(
        `Arquivo muito grande. Máximo permitido: ${Math.round(maxSizeKB / 1024)}MB.`,
        "error"
      );
      return;
    }

    try {
      showAlert("Otimizando foto do profissional...", "info");
      const compressed = await compressAvatar(file, {
        maxDimension: 280,
        quality: 0.8,
      });
      setter(compressed);
      showAlert(
        "Foto do profissional adicionada e otimizada com sucesso!",
        "success"
      );
    } catch (err: any) {
      console.warn("[SchedulingManager] Erro na compressão:", err);
      showAlert(err?.message || "Erro ao processar imagem.", "error");
    }
  };

  const handleFormationDocUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    profId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      showAlert(
        "O arquivo é maior que 1.5MB. Recomendamos usar o campo de link externo para manter o carregamento instantâneo.",
        "warning"
      );
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = file.type.startsWith("image/");

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setLocalProfs((prev) =>
          prev.map((p) =>
            p.id === profId
              ? {
                  ...p,
                  formationDocUrl: dataUrl,
                  formationDocName: file.name,
                  formationDocType: isPdf ? "pdf" : isImg ? "image" : "link",
                }
              : p
          )
        );
        showAlert(`Documento "${file.name}" carregado com sucesso!`, "success");
      }
    };
    reader.onerror = () => {
      showAlert("Falha ao ler o arquivo selecionado.", "error");
    };
    reader.readAsDataURL(file);
  };

  const getIcon = (type?: string) => {
    if (type === "whatsapp")
      return <MessageCircle className="w-4 h-4 text-emerald-500" />;
    if (type === "google_calendar")
      return <Calendar className="w-4 h-4 text-blue-500" />;
    return <LinkIcon className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" />
            Gerenciador de Agendamentos e Formações
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure atendimentos por Seminário, links específicos para Filosofia e Teologia e anexe documentos formativos (PDF ou Imagem).
          </p>
        </div>
        <button
          id="btn-add-prof-scheduling"
          onClick={handleAdd}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Adicionar Profissional
        </button>
      </div>

      <div className="p-6">
        <div className="space-y-6">
          {localProfs.map((prof) => (
            <div
              key={prof.id}
              className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col gap-4 shadow-sm"
            >
              {/* Header com Foto, Nome, Função e Seminário */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                <div className="shrink-0">
                  {prof.photoUrl ? (
                    <div className="relative">
                      <img
                        src={prof.photoUrl}
                        alt="Foto"
                        className="w-16 h-16 rounded-full border border-slate-200 dark:border-slate-700 object-cover shadow-sm"
                      />
                      <button
                        onClick={() => handleUpdate(prof.id, "photoUrl", null)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          handleFileUpload(e, (val) => {
                            handleUpdate(prof.id, "photoUrl", val);
                          });
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Nome do Profissional
                    </label>
                    <input
                      type="text"
                      value={prof.name}
                      onChange={(e) => handleUpdate(prof.id, "name", e.target.value)}
                      placeholder="Ex: Pe. João"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Especialidade / Função
                    </label>
                    <input
                      type="text"
                      value={prof.role}
                      onChange={(e) =>
                        handleUpdate(prof.id, "role", e.target.value.toUpperCase())
                      }
                      placeholder="Ex: DIRETOR ESPIRITUAL"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Seminário Designado
                    </label>
                    <select
                      value={prof.seminary || ""}
                      onChange={(e) => handleUpdate(prof.id, "seminary", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    >
                      <option value="">Todos os Seminários</option>
                      {AVAILABLE_SEMINARIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(prof.id)}
                  className="self-end sm:self-center p-2.5 bg-slate-100 hover:bg-red-100 dark:bg-slate-800 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded-xl transition-colors shrink-0"
                  title="Remover Profissional"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Grupos de WhatsApp com Escalas: Filosofia & Teologia */}
              <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500 text-white">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Grupos de WhatsApp com Escalas de Atendimento
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Links dos grupos de WhatsApp onde o profissional divulga as escalas de atendimento para os seminaristas
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Grupo WhatsApp — Filosofia (Escalas)
                    </label>
                    <input
                      type="text"
                      value={prof.meetingLinkFilosofia || ""}
                      onChange={(e) =>
                        handleUpdate(prof.id, "meetingLinkFilosofia", e.target.value)
                      }
                      placeholder="Ex: https://chat.whatsapp.com/... (Escalas Filosofia)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Grupo de WhatsApp com as escalas para seminaristas de Filosofia
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Grupo WhatsApp — Teologia (Escalas)
                    </label>
                    <input
                      type="text"
                      value={prof.meetingLinkTeologia || ""}
                      onChange={(e) =>
                        handleUpdate(prof.id, "meetingLinkTeologia", e.target.value)
                      }
                      placeholder="Ex: https://chat.whatsapp.com/... (Escalas Teologia)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Grupo de WhatsApp com as escalas para seminaristas de Teologia
                    </p>
                  </div>
                </div>
              </div>

              {/* Documento de Formação (Imagem ou PDF) */}
              <div className="bg-sky-50/60 dark:bg-sky-950/20 p-4 rounded-2xl border border-sky-100 dark:border-sky-900/40 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-500 text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Documento Importante para Formações (Imagem ou PDF)
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Disponibilize diretrizes, roteiros ou fichas formativas para os seminaristas consultarem e baixarem.
                      </p>
                    </div>
                  </div>

                  {prof.formationDocUrl ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            url: prof.formationDocUrl!,
                            name: prof.formationDocName || "Documento de Formação",
                            type: prof.formationDocType,
                            profName: prof.name,
                          })
                        }
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Visualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdate(prof.id, "formationDocUrl", null);
                          handleUpdate(prof.id, "formationDocName", "");
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remover documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div className="sm:col-span-1">
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-dashed border-sky-300 dark:border-sky-700/60 rounded-xl cursor-pointer hover:bg-sky-50/50 dark:hover:bg-slate-700/50 transition text-xs font-bold text-sky-700 dark:text-sky-300">
                      <Upload className="w-4 h-4 text-sky-500" />
                      <span>
                        {prof.formationDocUrl
                          ? "Substituir Arquivo"
                          : "Carregar PDF ou Imagem"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        onChange={(e) => handleFormationDocUpload(e, prof.id)}
                      />
                    </label>
                  </div>

                  <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={
                        prof.formationDocUrl &&
                        !prof.formationDocUrl.startsWith("data:")
                          ? prof.formationDocUrl
                          : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        handleUpdate(prof.id, "formationDocUrl", val || null);
                        handleUpdate(prof.id, "formationDocType", "link");
                        if (!prof.formationDocName) {
                          handleUpdate(
                            prof.id,
                            "formationDocName",
                            "Documento de Formação (Link)"
                          );
                        }
                      }}
                      placeholder="Ou cole aqui link externo (Google Drive, Dropbox, PDF)"
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />

                    <input
                      type="text"
                      value={prof.formationDocName || ""}
                      onChange={(e) =>
                        handleUpdate(prof.id, "formationDocName", e.target.value)
                      }
                      placeholder="Nome do arquivo (ex: Roteiro Formativo.pdf)"
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 sm:w-56 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                  </div>
                </div>

                {prof.formationDocUrl && (
                  <div className="flex items-center gap-2 text-[11px] text-sky-700 dark:text-sky-300 font-semibold bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                    <span className="truncate">
                      Documento anexado: {prof.formationDocName || "Documento de Formação"}
                    </span>
                    <span className="ml-auto uppercase text-[9px] px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 font-bold shrink-0">
                      {prof.formationDocType?.toUpperCase() || "PDF"}
                    </span>
                  </div>
                )}
              </div>

              {/* Informações de contato e agendamento gerais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                    Tipo de Link Geral
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {getIcon(prof.appointmentType)}
                    </div>
                    <select
                      value={prof.appointmentType || "whatsapp"}
                      onChange={(e) =>
                        handleUpdate(
                          prof.id,
                          "appointmentType",
                          e.target.value as any
                        )
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none"
                    >
                      <option value="whatsapp">WhatsApp (Grupo/Privado)</option>
                      <option value="google_calendar">Google Agenda</option>
                      <option value="other">Outro Link Geral</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                    URL Geral de Redirecionamento
                  </label>
                  <input
                    type="text"
                    value={prof.appointmentLink || ""}
                    onChange={(e) =>
                      handleUpdate(prof.id, "appointmentLink", e.target.value)
                    }
                    placeholder="Ex: https://..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                    WhatsApp Direto (Opcional)
                  </label>
                  <input
                    type="text"
                    value={prof.whatsappNumber || ""}
                    onChange={(e) =>
                      handleUpdate(prof.id, "whatsappNumber", e.target.value)
                    }
                    placeholder="Ex: (00) 00000-0000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
              </div>
            </div>
          ))}

          {localProfs.length === 0 && (
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">
                Nenhum profissional configurado.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            id="btn-save-scheduling-settings"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
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

      {/* Visualizador de Documento de Formação */}
      {previewDoc && (
        <FormationDocModal
          isOpen={Boolean(previewDoc)}
          onClose={() => setPreviewDoc(null)}
          docUrl={previewDoc.url}
          docName={previewDoc.name}
          docType={previewDoc.type}
          professionalName={previewDoc.profName}
        />
      )}
    </div>
  );
}
