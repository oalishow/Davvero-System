import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
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
    { name: string; photoUrl: string | null; roles?: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "alunos" | "visitantes">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loadSubscribers = async () => {
      try {
        const data = await getEventSubscribers(event.id);
        setSubscribers(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadSubscribers();
  }, [event.id]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm px-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[90vh] my-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-500" />
              Lista de Inscritos
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {event.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 mx-4 mt-4 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 min-w-[100px] py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
              activeTab === "all"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setActiveTab("alunos")}
            className={`flex-1 min-w-[100px] py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
              activeTab === "alunos"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Alunos
          </button>
          <button
            onClick={() => setActiveTab("visitantes")}
            className={`flex-1 min-w-[100px] py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${
              activeTab === "visitantes"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Visitantes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
            </div>
          ) : subscribers.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8 font-medium">
              Nenhum inscrito até ao momento.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest text-center">
                {subscribers.filter(s => {
                  if (activeTab === "all") return true;
                  const isVis = s.roles?.includes("VISITANTE");
                  if (activeTab === "visitantes") return isVis;
                  return !isVis;
                }).length} inscritos
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subscribers.filter(s => {
                  if (activeTab === "all") return true;
                  const isVis = s.roles?.includes("VISITANTE");
                  if (activeTab === "visitantes") return isVis;
                  return !isVis;
                }).map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3"
                  >
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-lg font-bold">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-2">
                      {s.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
