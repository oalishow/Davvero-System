import React, { useState, useRef } from "react";
import { Download, Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { db, appId } from "../lib/firebase";
import { collection, writeBatch, doc } from "firebase/firestore";
import type { Member } from "../types";
import { format } from "date-fns";

interface ImportExportMembersProps {
  members: Member[];
  onImportComplete: () => void;
}

export default function ImportExportMembers({ members, onImportComplete }: ImportExportMembersProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      
      const headers = ["Nome", "RA/Matrícula", "CPF", "Email", "Papéis/Vínculos", "Curso", "Diocese", "Seminário", "Data Nascimento", "Validade", "Ativo"];
      
      const rows = members.map(m => [
        m.name || "",
        m.ra || "",
        m.cpf || "",
        m.email || "",
        (m.roles || []).join("; "),
        m.course || "",
        m.diocese || "",
        m.seminary || "",
        m.birthdate || "",
        m.validityDate || "",
        m.isActive ? "Sim" : "Não"
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `membros_fajopa_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => setIsExporting(false), 500);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
          throw new Error("O arquivo CSV precisa ter um cabeçalho e pelo menos uma linha de dados.");
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        
        // Find indices
        const nameIdx = headers.findIndex(h => h.includes('nome'));
        const raIdx = headers.findIndex(h => h.includes('ra') || h.includes('matrícula') || h.includes('matricula'));
        const cpfIdx = headers.findIndex(h => h.includes('cpf'));
        const roleIdx = headers.findIndex(h => h.includes('papéis') || h.includes('papeis') || h.includes('vinculo') || h.includes('vínculo'));
        const courseIdx = headers.findIndex(h => h.includes('curso'));
        const dioceseIdx = headers.findIndex(h => h.includes('diocese'));
        const semIdx = headers.findIndex(h => h.includes('seminário') || h.includes('seminario'));
        const birthIdx = headers.findIndex(h => h.includes('nascimento'));
        const validityIdx = headers.findIndex(h => h.includes('validade'));

        if (nameIdx === -1 || raIdx === -1) {
          throw new Error("Colunas 'Nome' e 'RA' são obrigatórias.");
        }

        let importCount = 0;
        
        // Process in chunks of 500 for Firestore limits
        const chunkSize = 400;
        const dataLines = lines.slice(1);
        
        for (let i = 0; i < dataLines.length; i += chunkSize) {
          const chunk = dataLines.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          
          for (const line of chunk) {
            // Basic CSV parsing treating quotes
            const values = [];
            let inQuotes = false;
            let currentVal = '';
            
            for (let char of line) {
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                values.push(currentVal);
                currentVal = '';
              } else {
                currentVal += char;
              }
            }
            values.push(currentVal);
            
            const rawVal = (idx: number) => idx !== -1 && values[idx] ? values[idx].trim() : '';

            const alphaCode = Array(6).fill(0).map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("");
            
            const ra = rawVal(raIdx);
            const name = rawVal(nameIdx);
            
            if (!ra || !name) continue; // skip invalid empty entries

            const rolesStr = rawVal(roleIdx) || "ALUNO(A)";
            const roles = rolesStr.split(';').map(r => r.trim().toUpperCase()).filter(Boolean);

            const newMemberRef = doc(collection(db, `artifacts/${appId}/public/data/students`));
            
            batch.set(newMemberRef, {
              name,
              ra,
              cpf: rawVal(cpfIdx).replace(/\D/g, ""),
              course: rawVal(courseIdx).toUpperCase(),
              diocese: rawVal(dioceseIdx).toUpperCase(),
              seminary: rawVal(semIdx).toUpperCase() || "FAJOPA - FILOSOFIA",
              birthdate: rawVal(birthIdx),
              validityDate: rawVal(validityIdx) || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              roles: roles.length > 0 ? roles : ["ALUNO(A)"],
              alphaCode,
              isActive: true,
              isApproved: true,
              createdAt: new Date().toISOString()
            } as any);
            
            importCount++;
          }
          
          await batch.commit();
        }

        setImportResult({ msg: `${importCount} membros importados com sucesso!`, type: 'success' });
        onImportComplete();
      } catch (err: any) {
        console.error(err);
        setImportResult({ msg: err.message || "Erro ao importar CSV.", type: 'error' });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    
    reader.onerror = () => {
      setIsImporting(false);
      setImportResult({ msg: "Erro ao ler o arquivo.", type: 'error' });
    };

    reader.readAsText(file);
  };

  return (
    <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" /> Importação / Exportação
        </h3>
        <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
          Gerencie em lote a sua base de alunos e membros via arquivo CSV.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportCSV}
          disabled={isExporting || members.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar Excel (CSV)
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors disabled:opacity-50">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar (CSV)
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportCSV}
            disabled={isImporting}
          />
        </label>
      </div>

      {importResult && (
        <div className={`w-full p-3 text-sm font-bold rounded-xl text-center ${importResult.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {importResult.msg}
        </div>
      )}
    </div>
  );
}
