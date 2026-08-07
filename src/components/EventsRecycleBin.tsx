import { useState, useEffect } from "react";
import { Trash2, RefreshCcw } from "lucide-react";
import { onSnapshot, collection, query } from "firebase/firestore";
import { db, appId, restoreEvent, permanentDeleteEvent } from "../lib/firebase";
import type { Event } from "../types";
import { useDialog } from "../context/DialogContext";

export default function EventsRecycleBin() {
  const [deletedEvents, setDeletedEvents] = useState<Event[]>([]);
  const { showConfirm } = useDialog();

  useEffect(() => {
    const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
    const unsub = onSnapshot(qEvents, (snap) => {
      const evts = snap.docs.map(d => d.data() as Event);
      const now = new Date().getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      const filtered = evts.filter((e) => e.status === "deleted" && e.deletedAt);
      const activeDeleted: Event[] = [];

      for (const evt of filtered) {
          const deleteTime = new Date(evt.deletedAt!).getTime();
          if (now - deleteTime > thirtyDaysMs) {
            permanentDeleteEvent(evt.id).catch(console.error);
            continue;
          }
          activeDeleted.push(evt);
      }

      activeDeleted.sort(
        (a, b) =>
          new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime(),
      );
      setDeletedEvents(activeDeleted);
    });

    return () => unsub();
  }, []);

  const handleRestore = async (id: string) => {
    if (await showConfirm("Tem certeza que deseja restaurar este evento?", { type: 'warning' })) {
      await restoreEvent(id).catch(console.error);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (await showConfirm("Tem certeza que deseja apagar este evento permanentemente? Esta ação NÃO pode ser desfeita.", { type: 'error' })) {
      await permanentDeleteEvent(id).catch(console.error);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          Lixeira de Eventos
        </h3>
        <p className="text-xs text-rose-500 mt-1">
          Aviso: Itens nesta pasta serão removidos permanentemente após 30 dias.
        </p>
      </div>

      {deletedEvents.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
          A lixeira está vazia.
        </p>
      ) : (
        <div className="space-y-3">
          {deletedEvents.map((evt) => {
            const now = new Date().getTime();
            const delTime = new Date(evt.deletedAt!).getTime();
            const daysLeft = Math.max(
              0,
              30 - Math.floor((now - delTime) / (1000 * 60 * 60 * 24)),
            );

            return (
              <div
                key={evt.id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-200 dark:border-rose-500/20"
              >
                <div className="flex-1 pr-4">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 line-through">
                    {evt.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    {evt.description}
                  </p>
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-2">
                    Exclui permanentemente em {daysLeft} dias
                  </p>
                </div>

                <div className="mt-4 sm:mt-0 flex flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleRestore(evt.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg transition-colors border border-emerald-200 dark:border-emerald-500/30"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Restaurar
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(evt.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-lg transition-colors border border-rose-200 dark:border-rose-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Apagar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
