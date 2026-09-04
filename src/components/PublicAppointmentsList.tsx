import React, { useState, useEffect } from "react";
import { Member, ProfessionalConfig, AVAILABLE_SEMINARIES } from "../types";
import {
  HeartHandshake,
  ShieldCheck,
  ExternalLink,
  Calendar as CalendarIcon,
  MessageCircle,
  BookHeart,
  Car,
  Users,
  Video,
  FileText,
  Eye,
  Download,
  Building2,
} from "lucide-react";
import DobloControl from "./DobloControl";
import LiturgyPanel from "./LiturgyPanel";
import SeminarWhatsAppMural from "./SeminarWhatsAppMural";
import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import { useSettings } from "../context/SettingsContext";
import FormationDocModal from "./FormationDocModal";

export default function PublicAppointmentsList({
  member,
  onNavigateToStudent,
}: {
  member: Member | null;
  onNavigateToStudent?: () => void;
}) {
  const { settings: cloudSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    "agendamentos" | "liturgia" | "doblo" | "grupos"
  >("agendamentos");

  // Professionals with their links and documents
  const [professionalsList, setProfessionalsList] = useState<ProfessionalConfig[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>("all");
  const [selectedSeminary, setSelectedSeminary] = useState<string>(
    member?.seminary || "all"
  );
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name?: string;
    type?: "pdf" | "image" | "link";
    profName?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [cloudSettings]);

  const loadData = async () => {
    setLoading(true);
    try {
      const profMap: Record<string, ProfessionalConfig> = {};

      if (cloudSettings?.professionals && cloudSettings.professionals.length > 0) {
        cloudSettings.professionals.forEach((p) => {
          profMap[p.id] = { ...p };
        });
      }

      if (cloudSettings?.seminariesConfig) {
        Object.entries(cloudSettings.seminariesConfig).forEach(
          ([semKey, semConfig]: [string, any]) => {
            if (semConfig.professionals) {
              semConfig.professionals.forEach((p: any) => {
                if (
                  !Object.values(profMap).some(
                    (pm: any) => pm.name.toLowerCase() === p.name.toLowerCase()
                  )
                ) {
                  profMap[p.id] = {
                    ...p,
                    seminary: p.seminary || semConfig.name || semKey,
                  };
                }
              });
            }
          }
        );
      }

      if (Object.keys(profMap).length === 0) {
        DEFAULT_PROFESSIONALS.forEach((p) => {
          profMap[p.id] = {
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
            whatsappNumber: p.whatsappNumber || "",
            seminary: p.seminary || "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
          };
        });
      }

      // Garantir que Padre Alan, Padre Altair, Padre Anderson e Dra Alessandra pertençam ao Seminário Provincial
      const PROVINCIAL_SEMINARY = "SPSCJ - Seminário Provincial Sagrado Coração de Jesus";
      Object.values(profMap).forEach((p) => {
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
          p.seminary = PROVINCIAL_SEMINARY;
        }
      });

      setProfessionalsList(Object.values(profMap));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfessionals = professionalsList.filter((prof) => {
    const matchesProf = selectedProfId === "all" || prof.id === selectedProfId;
    const matchesSeminary =
      selectedSeminary === "all" ||
      prof.seminary === selectedSeminary;
    return matchesProf && matchesSeminary;
  });

  const handleDownloadDoc = (url: string, name?: string) => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "documento-formacao";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
        Carregando informações...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-6 shadow-inner no-print border border-slate-200/50 dark:border-slate-700/50 gap-1">
        <button
          id="tab-public-appointments"
          onClick={() => setActiveSubTab("agendamentos")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            activeSubTab === "agendamentos"
              ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Agendamentos & Formação</span>
        </button>
        <button
          id="tab-public-liturgy"
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
          id="tab-public-doblo"
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
          id="tab-public-grupos"
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
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase mb-4">
                Agendamentos
              </h3>
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
              {/* Filtros de Seminário e Profissional */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-sky-500" />
                    Atendimento e Formações
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Agende horários, acerte atendimentos para Filosofia ou Teologia e baixe roteiros formativos.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
                  {/* Filtro por Seminário */}
                  <div className="flex-1 sm:flex-none">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Filtrar por Seminário
                    </label>
                    <select
                      id="select-seminary-filter"
                      value={selectedSeminary}
                      onChange={(e) => setSelectedSeminary(e.target.value)}
                      className="w-full sm:w-56 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none font-bold text-slate-700 dark:text-slate-300"
                    >
                      <option value="all">Todos os Seminários</option>
                      {AVAILABLE_SEMINARIES.map((sem) => (
                        <option key={sem} value={sem}>
                          {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Profissional */}
                  <div className="flex-1 sm:flex-none">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Filtrar por Profissional
                    </label>
                    <select
                      id="select-prof-filter"
                      value={selectedProfId}
                      onChange={(e) => setSelectedProfId(e.target.value)}
                      className="w-full sm:w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none font-bold text-slate-700 dark:text-slate-300"
                    >
                      <option value="all">Todos os Profissionais</option>
                      {professionalsList.map((prof) => (
                        <option key={prof.id} value={prof.id}>
                          {prof.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Grid de Profissionais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProfessionals.map((prof) => {
                  const hasFilo = Boolean(prof.meetingLinkFilosofia?.trim());
                  const hasTeol = Boolean(prof.meetingLinkTeologia?.trim());
                  const hasDoc = Boolean(prof.formationDocUrl);

                  return (
                    <div
                      key={prof.id}
                      className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md"
                    >
                      <div>
                        {/* Topo: Seminário Tag & Foto */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                            <Building2 className="w-3 h-3 text-sky-500 shrink-0" />
                            <span className="truncate">
                              {prof.seminary || "Todos os Seminários"}
                            </span>
                          </span>
                        </div>

                        <div className="flex flex-col items-center text-center mb-5">
                          {prof.photoUrl ? (
                            <img
                              src={prof.photoUrl}
                              alt={prof.name}
                              className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-700 object-cover shadow-sm mb-3"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-sky-50 dark:bg-sky-900/30 border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-sm mb-3">
                              <ShieldCheck className="w-9 h-9 text-sky-500" />
                            </div>
                          )}
                          <h4 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            {prof.name}
                          </h4>
                          <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider mt-0.5">
                            {prof.role}
                          </p>
                        </div>

                        {/* Grupos de WhatsApp para Escalas: Filosofia & Teologia */}
                        {(hasFilo || hasTeol) && (
                          <div className="mb-4 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
                            <div className="flex items-center justify-center gap-1.5 text-center">
                              <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                                Grupos de WhatsApp • Escalas
                              </span>
                            </div>

                            {hasFilo && (
                              <a
                                href={prof.meetingLinkFilosofia}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-3 bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/70 rounded-xl text-xs font-bold flex items-center justify-between transition-all hover:scale-[1.01] active:scale-95 shadow-xs"
                              >
                                <span className="flex items-center gap-1.5">
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  🎓 Escalas Filosofia (WhatsApp)
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}

                            {hasTeol && (
                              <a
                                href={prof.meetingLinkTeologia}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-3 bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/70 rounded-xl text-xs font-bold flex items-center justify-between transition-all hover:scale-[1.01] active:scale-95 shadow-xs"
                              >
                                <span className="flex items-center gap-1.5">
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  📖 Escalas Teologia (WhatsApp)
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Documento de Formação (Imagem ou PDF) */}
                        {hasDoc && (
                          <div className="mb-4 bg-amber-50/80 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-900/40">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="p-1 rounded-lg bg-amber-500 text-white shrink-0 mt-0.5">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-black text-amber-900 dark:text-amber-200 block truncate">
                                  {prof.formationDocName || "Documento de Formação"}
                                </span>
                                <span className="text-[9px] text-amber-700 dark:text-amber-400 block">
                                  Material formativo para os seminaristas
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDoc({
                                    url: prof.formationDocUrl!,
                                    name:
                                      prof.formationDocName || "Documento de Formação",
                                    type: prof.formationDocType,
                                    profName: prof.name,
                                  })
                                }
                                className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                              >
                                <Eye className="w-3 h-3" /> Visualizar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadDoc(
                                    prof.formationDocUrl!,
                                    prof.formationDocName
                                  )
                                }
                                className="py-1.5 px-2.5 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                title="Baixar documento"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Botões de Agendamento e Contato */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        {prof.appointmentLink ? (
                          <a
                            href={prof.appointmentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {prof.appointmentType === "whatsapp" ? (
                              <MessageCircle className="w-3.5 h-3.5" />
                            ) : prof.appointmentType === "google_calendar" ? (
                              <CalendarIcon className="w-3.5 h-3.5" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5" />
                            )}
                            Agendar Horário
                          </a>
                        ) : null}

                        {prof.whatsappNumber && (
                          <a
                            href={`https://wa.me/${
                              prof.whatsappNumber.replace(/\D/g, "").startsWith("55")
                                ? prof.whatsappNumber.replace(/\D/g, "")
                                : "55" + prof.whatsappNumber.replace(/\D/g, "")
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-white" />
                            Falar no WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProfessionals.length === 0 && (
                <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                  <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Nenhum profissional encontrado para o filtro selecionado.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tente selecionar &quot;Todos os Seminários&quot; ou outro profissional.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeSubTab === "liturgia" && (
        <div className="pt-2">
          <LiturgyPanel />
        </div>
      )}

      {activeSubTab === "grupos" && <SeminarWhatsAppMural member={member} />}

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

      {/* Modal de visualização do documento de formação */}
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
