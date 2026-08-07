import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, query, getDocs, doc, deleteDoc, where } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { Member } from "../types";
import { Trash2, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useDialog } from "../context/DialogContext";

interface DeleteAvailabilitiesModalProps {
  professionals: Member[];
  onClose: () => void;
  onSuccess: () => void;
  onProgress: (current: number, total: number) => void;
}

export default function DeleteAvailabilitiesModal({ professionals, onClose, onSuccess, onProgress }: DeleteAvailabilitiesModalProps) {
  const [selectedProfId, setSelectedProfId] = useState<string>("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const { showConfirm, showAlert } = useDialog();

  const handleDelete = async () => {
    let msg = "TEM CERTEZA ABSOLUTA que deseja apagar TODOS os horários de todos os profissionais?";
    if (selectedProfId !== "all") {
      const pName = professionals.find(p => p.id === selectedProfId)?.name;
      msg = `TEM CERTEZA ABSOLUTA que deseja apagar TODOS os horários do(a) profissional ${pName}?`;
    }

    const proceed = await showConfirm(
      msg + "\nIsso apagará também os agendamentos já marcados e não poderá ser desfeito.", 
      { title: 'Atenção Crítica', confirmText: 'Sim, Apagar', cancelText: 'Cancelar', type: 'error' }
    );

    if (!proceed) return;

    try {
      setIsDeleting(true);

      let qAppt = query(collection(db, `artifacts/${appId}/public/data/appointments`));
      let qAvail = query(collection(db, `artifacts/${appId}/public/data/availabilities`));

      if (selectedProfId !== "all") {
        qAppt = query(collection(db, `artifacts/${appId}/public/data/appointments`), where("professionalId", "==", selectedProfId));
        qAvail = query(collection(db, `artifacts/${appId}/public/data/availabilities`), where("professionalId", "==", selectedProfId));
      }

      const snapAppt = await getDocs(qAppt);
      const snapAvail = await getDocs(qAvail);

      const total = snapAppt.docs.length + snapAvail.docs.length;
      if (total === 0) {
        showAlert("Nenhum registro encontrado para excluir.", { type: "info" });
        setIsDeleting(false);
        onClose();
        return;
      }

      let current = 0;
      onProgress(current, total);

      for (const d of snapAppt.docs) {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, d.id));
        current++;
        onProgress(current, total);
      }

      for (const d of snapAvail.docs) {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/availabilities`, d.id));
        current++;
        onProgress(current, total);
      }

      onSuccess();
      onClose();
    } catch(e) {
      console.error(e);
      showAlert("Erro ao tentar excluir horários.", { type: "error" });
      setIsDeleting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 mx-auto"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5"/>
             </div>
             <div>
                <h3 className="font-bold text-red-700 dark:text-red-400">Apagar Agendamentos</h3>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">Esta ação não pode ser desfeita.</p>
             </div>
          </div>
        </div>
        
        <div className="p-6">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Quais horários deseja apagar?</label>
          <select 
            value={selectedProfId} 
            onChange={e => setSelectedProfId(e.target.value)}
            disabled={isDeleting}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none dark:text-slate-200"
          >
             <option value="all">TODOS os profissionais (Apagar tudo)</option>
             {professionals.map(p => (
               <option key={p.id} value={p.id}>Somente: {p.name}</option>
             ))}
          </select>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
           <button 
             onClick={onClose}
             disabled={isDeleting}
             className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
           >
             Cancelar
           </button>

           <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
           >
              {isDeleting ? "Apagando..." : <><Trash2 className="w-4 h-4"/> Confirmar Exclusão</>}
           </button>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
