import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X, MessageSquare, Check, AlertCircle, ChevronRight } from "lucide-react";
import { Member } from "../types";
import { useDialog } from "../context/DialogContext";

export interface ParsedSlot {
  id: string;
  dateStr: string;   // YYYY-MM-DD
  timeStr: string;   // HH:mm
  rawName: string;
  status: "LIVRE" | "OCUPADO";
  matchedMemberId: string | null;
}

interface ImportWhatsappModalProps {
  onClose: () => void;
  onImport: (slots: ParsedSlot[], professionalId: string, location: string, onProgress?: (c: number, t: number) => void) => Promise<void>;
  professionals: Member[];
  allStudents: Member[];
}

export default function ImportWhatsappModal({ onClose, onImport, professionals, allStudents }: ImportWhatsappModalProps) {
  const { showAlert, showConfirm } = useDialog();
  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState("");
  const [selectedProfId, setSelectedProfId] = useState("");
  const [location, setLocation] = useState("");
  
  const [parsedSlots, setParsedSlots] = useState<ParsedSlot[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\s+/g, ' ').trim();
  };

  const parseText = () => {
    if (!selectedProfId) {
      showAlert("Selecione o profissional primeiro.", { type: "warning", title: "Aviso" });
      return;
    }
    if (!text.trim()) {
      showAlert("Cole o texto do WhatsApp.", { type: "warning", title: "Aviso" });
      return;
    }

    const lines = text.split('\n');
    let currentDate: string | null = null;
    const slots: ParsedSlot[] = [];

    const currentYear = new Date().getFullYear();
    const prof = professionals.find(p => p.id === selectedProfId);
    const isSpscjProf = prof?.seminary?.includes("SPSCJ") || prof?.diocese?.toUpperCase().includes("SPSCJ");
    
    const validStudents = allStudents.filter(s => {
       if (isSpscjProf) {
         const dio = (s.diocese || "").toUpperCase();
         const sem = (s.seminary || "").toUpperCase();
         if (dio.includes("MARÍLIA") || dio.includes("MARILIA") || dio.includes("BAURU")) return false;
         if (sem.includes("MARÍLIA") || sem.includes("MARILIA") || sem.includes("BAURU")) return false;
       }
       return true;
    });

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Try to find a date like DD/MM (string) or DD/MM/YYYY
      const dateMatch = line.match(/(?:^|\s|\*|-|_)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (dateMatch && !line.match(/^(\d{1,2})(?:h|:00)?/i)) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear.toString();
        currentDate = `${year}-${month}-${day}`;
        continue;
      }

      // Try to find time and name like 14h: Name, 14:00 - Name
      const timeMatch = line.match(/^(\d{1,2})(?:h|:00)?\s*(?::|-|–)?\s*(.*)$/i);
      if (timeMatch && currentDate) {
        const hour = timeMatch[1].padStart(2, '0');
        const timeStr = `${hour}:00`;
        const rawName = timeMatch[2]?.trim() || "";
        
        let status: "LIVRE" | "OCUPADO" = "LIVRE";
        let matchedMemberId: string | null = null;
        
        const cleanName = rawName.replace(/[-*(]*cancelado[)*]*/i, '').trim();

        if (cleanName && cleanName.length > 2) {
            status = "OCUPADO";
            
            const normalizedParam = normalizeString(cleanName);
            
            let bestMatch = null;
            let bestScore = -1;
            
            const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
            let cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
            
            // Hardcoded overrides for edge cases mentioned by user
            if (cleanParam === 'ferreira') cleanParam = 'joao victor ferreira';
            if (cleanParam === 'giovane') cleanParam = 'giovane silva';
            if (cleanParam === 'gabriel r') cleanParam = 'gabriel roberto';
            if (cleanParam === 'leonardo') cleanParam = 'leonardo religioso';
            
            const nameParts = cleanParam.split(' ').filter(p => p.length > 0);
            
            for (const s of validStudents) {
               const normName = normalizeString(s.name);
               const sParts = normName.split(' ').filter(p => p.length > 0);
               let score = -1;
               
               if (normName === cleanParam) {
                  score = 100;
               } else if (nameParts.length > 0 && sParts.length > 0) {
                  let partsMatched = 0;
                  let isFirstMatch = sParts[0] === nameParts[0];
                  let hasMismatchedParts = false;
                  
                  for (const p of nameParts) {
                     if (sParts.some(sp => sp === p || (p.length === 1 && sp.startsWith(p)))) {
                        partsMatched++;
                     } else {
                        hasMismatchedParts = true;
                     }
                  }
                  
                  if (partsMatched === nameParts.length && !hasMismatchedParts) {
                     score = 70;
                     if (isFirstMatch) score += 10;
                     if (sParts.length === nameParts.length) score += 10;
                  } else if (partsMatched > 0) {
                     score = 20 + (partsMatched * 10);
                     if (isFirstMatch) score += 5;
                     if (hasMismatchedParts) score -= 15;
                  } else if (normName.includes(cleanParam)) {
                     score = 10;
                  }
               }
               
               if (score > 0) {
                  if (hasReligiosoHint || cleanName.toLowerCase().includes('leonardo')) {
                     if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                         score += 50;
                     } else {
                         score -= 20;
                     }
                  } else if (cleanName.toLowerCase().includes('ferreira')) {
                     if (s.diocese && s.diocese.toUpperCase().includes('MARILIA')) {
                         score += 50;
                     } else {
                         score -= 20;
                     }
                  } else {
                     if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
                        score += 15;
                     } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
                        score += 5;
                     }
                     
                     if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                         score += 2;
                     }
                  }
                  
                  if (score > bestScore) {
                     bestScore = score;
                     bestMatch = s;
                  }
               }
            }
            
            if (bestMatch) {
              matchedMemberId = bestMatch.id;
            }
        }

        slots.push({
          id: Math.random().toString(36).substring(7),
          dateStr: currentDate,
          timeStr,
          rawName: cleanName,
          status,
          matchedMemberId
        });
      }
    }

    if (slots.length === 0) {
      showAlert("Não foi possível identificar nenhuma data e horário no texto. Verifique o formato.", { type: "error", title: "Erro na Leitura" });
      return;
    }

    setParsedSlots(slots);
    setStep(2);
  };

  const handleManualMatch = (slotId: string, memberId: string) => {
    setParsedSlots(prev => prev.map(s => {
      if (s.id === slotId) {
        if (memberId === "livre") {
          return { ...s, matchedMemberId: null, status: "LIVRE" };
        } else if (memberId === "unmatched" || memberId === "") {
          return { ...s, matchedMemberId: null, status: "OCUPADO" };
        } else {
          return { ...s, matchedMemberId: memberId, status: "OCUPADO" };
        }
      }
      return s;
    }));
  };

  const toggleStatus = (slotId: string) => {
    setParsedSlots(prev => prev.map(s => {
      if (s.id === slotId) {
        return {
           ...s,
           status: s.status === 'LIVRE' ? 'OCUPADO' : 'LIVRE',
           matchedMemberId: s.status === 'LIVRE' ? s.matchedMemberId : null 
        };
      }
      return s;
    }));
  };

  const handleConfirm = async () => {
    // Validate if any OCUPADO doesn't have a member matched
    const missing = parsedSlots.find(s => s.status === 'OCUPADO' && !s.matchedMemberId);
    if (missing) {
       const proceed = await showConfirm(`Existem horários ocupados sem aluno do sistema vinculado (ex: ${missing.dateStr} às ${missing.timeStr} com "${missing.rawName}").\nDeseja importar mesmo assim? (Ficará registrado o nome em texto, mas sem vínculo de perfil)`, { type: 'warning', title: 'Atenção', confirmText: 'Importar' });
       if (!proceed) return;
    }
    
    setIsImporting(true);
    setTotalItems(parsedSlots.length);
    setProgress(0);
    try {
      await onImport(parsedSlots, selectedProfId, location, (current, total) => {
        setProgress(current);
      });
      onClose();
    } catch(e) {
      console.error(e);
      showAlert("Ocorreu um erro ao importar agendamentos.", { type: "error", title: "Erro" });
      setIsImporting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-500"/>
             </div>
             Importar do WhatsApp
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-6 min-h-0 flex-1">
          {step === 1 ? (
             <>
               <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 p-4 rounded-xl text-sm leading-relaxed border border-blue-100 dark:border-blue-800/50 shadow-sm flex gap-3 flex-shrink-0">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    Cole a tabela de horários recebida. Exemplo do formato suportado:
                    <div className="mt-2 font-mono text-[11px] opacity-80 whitespace-pre">
                      23/04 (quinta-feira)<br/>
                      14h: Alexandre<br/>
                      15h: José Fabrício<br/>
                      16h:<br/>
                    </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Profissional / Atendente *</label>
                    <select 
                      value={selectedProfId} 
                      onChange={e => setSelectedProfId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none font-medium"
                    >
                        <option value="">Selecione...</option>
                        {professionals.map(p => (
                          <option key={p.id} value={p.id}>{p.name} {p.roles && p.roles.length > 0 ? `(${p.roles[0]})` : ''}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Local do Atendimento (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Sala 2, Capela..."
                      value={location} 
                      onChange={e => setLocation(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none font-medium"
                    />
                  </div>
               </div>

               <div className="flex-grow flex flex-col">
                 <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Texto da Mensagem *</label>
                 <textarea 
                   className="w-full min-h-[150px] flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-mono outline-none resize-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                   placeholder="23/04 (quinta-feira)&#10;14h: Alexandre&#10;15h:&#10;..."
                   value={text}
                   onChange={e => setText(e.target.value)}
                 />
               </div>
             </>
          ) : (
             <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Horários Identificados ({parsedSlots.length})</h3>
                   <button onClick={() => setStep(1)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Voltar e Editar Texto</button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Data / Hora</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Status / Original</th>
                            <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Vincular Aluno</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {parsedSlots.map(slot => (
                             <tr key={slot.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                                   {slot.dateStr.split('-').reverse().join('/')} <span className="text-slate-400 font-bold ml-1">{slot.timeStr}</span>
                                </td>
                                <td className="px-4 py-3">
                                   <div className="flex items-center gap-2">
                                     <button 
                                       onClick={() => toggleStatus(slot.id)}
                                       className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase cursor-pointer transition ${slot.status === 'LIVRE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}
                                     >
                                         {slot.status}
                                     </button>
                                     <span className="text-slate-500 text-xs italic truncate max-w-[150px]">{slot.rawName || "- vazio -"}</span>
                                   </div>
                                </td>
                                <td className="px-4 py-3 min-w-[250px]">
                                  {slot.status === 'LIVRE' ? (
                                    <span className="text-slate-400 text-xs italic">Horário disponível</span>
                                  ) : (
                                    <div className="relative">
                                      <select 
                                        className={`w-full bg-white dark:bg-slate-900 border ${slot.matchedMemberId ? 'border-emerald-200 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800 focus:ring-amber-500'} rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500`}
                                        value={slot.matchedMemberId || "unmatched"}
                                        onChange={e => handleManualMatch(slot.id, e.target.value)}
                                      >
                                        <option value="unmatched">-- Não Correspondente (Manter nome) --</option>
                                        <option value="livre">-- Deixar Horário Livre --</option>
                                        {allStudents.filter(s => s.roles?.includes('ALUNO(A)') || s.roles?.includes('SEMINARISTA')).map(s => (
                                          <option key={s.id} value={s.id}>{s.name} ({s.course || 'Sem Curso'})</option>
                                        ))}
                                      </select>
                                      {!slot.matchedMemberId && (
                                         <AlertCircle className="w-4 h-4 text-amber-500 absolute right-2.5 top-2 pointer-events-none" />
                                      )}
                                    </div>
                                  )}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center gap-3 rounded-b-3xl min-h-[84px] flex-shrink-0">
           <button 
             onClick={onClose}
             disabled={isImporting}
             className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
           >
             Cancelar
           </button>
           {step === 1 ? (
             <button 
               onClick={parseText}
               className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition flex items-center gap-2"
             >
                Avançar <ChevronRight className="w-4 h-4"/>
             </button>
           ) : (
             <div className="flex justify-end items-center gap-4 flex-1">
               {isImporting && totalItems > 0 && (
                 <div className="flex-1 max-w-[200px]">
                   <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                     <span>Importando...</span>
                     <span>{progress} / {totalItems}</span>
                   </div>
                   <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                     <div className="bg-green-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(5, (progress / Math.max(1, totalItems)) * 100)}%` }}></div>
                   </div>
                 </div>
               )}
               <button 
                 onClick={handleConfirm}
                 disabled={isImporting}
                 className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2 min-w-[210px]"
               >
                 {isImporting ? (
                   "Importando..."
                 ) : (
                   <><Check className="w-4 h-4"/> Confirmar e Importar</>
                 )}
               </button>
             </div>
           )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
