import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, appId, handleFirestoreError, OperationType } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import { AVAILABLE_SEMINARIES } from "../types";

interface DobloLog {
  id: string;
  name: string;
  seminary?: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  departureKm: number;
  arrivalKm: number;
  destination: string;
}

interface EditDobloModalProps {
  log: DobloLog;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditDobloModal({ log, onClose, onSuccess }: EditDobloModalProps) {
  const { showAlert } = useDialog();
  const [name, setName] = useState(log.name);
  const [seminary, setSeminary] = useState(log.seminary || "");
  const [date, setDate] = useState(log.date);
  const [departureTime, setDepartureTime] = useState(log.departureTime);
  const [arrivalTime, setArrivalTime] = useState(log.arrivalTime || "");
  const [departureKm, setDepartureKm] = useState(log.departureKm.toString());
  const [arrivalKm, setArrivalKm] = useState(log.arrivalKm ? log.arrivalKm.toString() : "");
  const [destination, setDestination] = useState(log.destination || "");
  
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/doblo_logs`, log.id), {
        name,
        date,
        departureTime,
        arrivalTime,
        departureKm: Number(departureKm),
        arrivalKm: arrivalKm ? Number(arrivalKm) : null,
        destination
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `artifacts/${appId}/public/data/doblo_logs/${log.id}`);
      showAlert("Erro ao salvar alterações.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] my-auto">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Registro da Doblô</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 min-h-0">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nome do Condutor</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seminário / Origem</label>
            <select value={seminary} onChange={e => setSeminary(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500">
              <option value="">Selecione...</option>
              {AVAILABLE_SEMINARIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Destino / Local</label>
            <input type="text" value={destination} onChange={e => setDestination(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Hora de Saída</label>
              <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Km de Saída</label>
              <input type="number" step="0.1" value={departureKm} onChange={e => setDepartureKm(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Hora de Chegada</label>
              <input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Km de Chegada</label>
              <input type="number" step="0.1" value={arrivalKm} onChange={e => setArrivalKm(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-3xl shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-2">
            <Save className="w-4 h-4" /> {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
