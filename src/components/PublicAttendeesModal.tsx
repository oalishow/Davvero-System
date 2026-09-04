import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users, Search, UserCheck } from "lucide-react";
import type { Event } from "../types";
import { getEventSubscribers } from "../lib/firebase";

interface PublicAttendeesModalProps {
  event: Event;
  onClose: () => void;
}

export default function PublicAttendeesModal({
  event,
  onClose,
}: PublicAttendeesModalProps) {
  const [subscribers, setSubscribers] = useState<
    { name: string; photoUrl: string | null; roles?: string[]; status?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "alunos" | "visitantes">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loadSubscribers = async () => {
      try {
        const data = await getEventSubscribers(event.id);
        setSubscribers(data.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR")));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadSubscribers();
  }, [event.id]);

  if (!mounted) return null;

  const filteredSubscribers = subscribers.filter((s) => {
    const isVis = s.roles?.includes("VISITANTE");
    if (activeTab === "alunos" && isVis) return false;
    if (activeTab === "visitantes" && !isVis) return false;

    if (!searchQuery) return true;
    return (s.name || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col h-[90dvh] sm:h-auto sm:max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-500" />
              Lista de Inscritos
            </h3>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {event.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 mx-3 sm:mx-4 mt-3 rounded-xl gap-1 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 min-w-[70px] py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Todos ({subscribers.length})
          </button>
          <button
            onClick={() => setActiveTab("alunos")}
            className={`flex-1 min-w-[70px] py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
              activeTab === "alunos"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Alunos ({subscribers.filter(s => !s.roles?.includes("VISITANTE")).length})
          </button>
          <button
            onClick={() => setActiveTab("visitantes")}
            className={`flex-1 min-w-[70px] py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${
              activeTab === "visitantes"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Visitantes ({subscribers.filter(s => s.roles?.includes("VISITANTE")).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 sm:px-4 pt-2.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar inscrito por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-sky-500 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Attendees List with min-h-0 for perfect smartphone scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
              <p className="text-xs font-semibold text-slate-400">Carregando inscritos...</p>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {searchQuery ? "Nenhum participante encontrado com esse nome." : "Nenhum inscrito até o momento."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
                <span>{filteredSubscribers.length} participante(s) listado(s)</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Limpar busca
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {filteredSubscribers.map((s, idx) => {
                  const isVis = s.roles?.includes("VISITANTE");
                  const isPresent = s.status === "presente" || s.status === "apto_para_certificado";
                  const initial = ((s.name || "?").trim().charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800/90 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {s.photoUrl ? (
                          <img
                            src={s.photoUrl}
                            alt={s.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-base font-bold shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                            {s.name || "Participante"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isVis ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                Visitante
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                                Aluno
                              </span>
                            )}
                            {isPresent && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                <UserCheck className="w-2.5 h-2.5" /> Presente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
