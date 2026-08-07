import { useState, useRef, useEffect, ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { X, Database, Download, Lock, HardDrive, Clock } from "lucide-react";
import {
  collection,
  query,
  getDocs,
  setDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { db, appId, createNotification } from "../lib/firebase";
import type { Member } from "../types";
import { PASSWORD_STORAGE_KEY, DEFAULT_ADMIN_PASSWORD } from "../lib/constants";
import { fetchFullBackup, getAutoBackupsList, downloadAutoBackup } from "../lib/autoBackup";

export default function BackupModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [autoBackupsList, setAutoBackupsList] = useState<any[]>([]);

  useEffect(() => {
    if (isUnlocked) {
      getAutoBackupsList().then(setAutoBackupsList).catch(console.error);
    }
  }, [isUnlocked]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await fetchFullBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DAVVERO System_Full_Backup_${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      await createNotification({
        recipientId: "admin",
        title: "Backup Efetuado",
        message: "Um administrador gerou um backup do sistema.",
        type: "backup",
      });

      showStatus("Backup descarregado com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showStatus("Falha ao exportar base de dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const importedData = JSON.parse(ev.target?.result as string);
        if (!importedData) throw new Error("Estrutura JSON inválida.");

        const batchPromises: Promise<any>[] = [];

        // Legacy Array format (only students)
        if (Array.isArray(importedData)) {
          importedData.forEach((member) => {
            if (member.id) {
              const { id, ...data } = member;
              batchPromises.push(setDoc(doc(db, `artifacts/${appId}/public/data/students`, id), data));
            } else {
              batchPromises.push(addDoc(collection(db, `artifacts/${appId}/public/data/students`), member));
            }
          });
        } 
        // New Full Backup format Map
        else if (importedData.firebase) {
          // Restore system info
          if (importedData.system) {
            for (const key of Object.keys(importedData.system)) {
              if (key && !key.includes('admin') && !key.includes('password') && importedData.system[key]) {
                localStorage.setItem(key, importedData.system[key]);
              }
            }
          }

          for (const colName of Object.keys(importedData.firebase)) {
            const records = importedData.firebase[colName];
            if (Array.isArray(records)) {
              for (const record of records) {
                const { id, comments_backup, ...data } = record;
                if (id) {
                  batchPromises.push(setDoc(doc(db, `artifacts/${appId}/public/data/${colName}`, id), data));
                } else {
                  batchPromises.push(addDoc(collection(db, `artifacts/${appId}/public/data/${colName}`), data));
                }

                // Restore comments for mural posts
                if (colName === 'mural_posts' && comments_backup && Array.isArray(comments_backup)) {
                  for (const comment of comments_backup) {
                    const cid = comment.id;
                    const cdata = { ...comment };
                    delete cdata.id;
                    if (cid) {
                      batchPromises.push(setDoc(doc(db, `artifacts/${appId}/public/data/mural_posts/${id}/comments`, cid), cdata));
                    }
                  }
                }
              }
            }
          }
        }

        await Promise.all(batchPromises);
        showStatus("Base de dados restaurada! Recarregando sistema...", "success");
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        console.error(err);
        showStatus("Incompatibilidade: Arquivo JSON inválido.", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const showStatus = (msg: string, type: "success" | "error") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  };

  const handleUnlock = () => {
    const current =
      localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (passwordInput === current) {
      setIsUnlocked(true);
      setStatus(null);
    } else {
      showStatus("Senha incorreta.", "error");
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 w-full max-w-sm animated-scale-in">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
            <Database className="w-5 h-5" /> Gestão de Backups
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {status && (
          <div
            className={`mb-4 p-3 text-center rounded-xl text-sm font-medium ${status.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
          >
            {status.msg}
          </div>
        )}

        {!isUnlocked ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Área Restrita. Insira a senha mestra para continuar.
              </p>
            </div>
            <input
              type="password"
              placeholder="Senha Mestra"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              className="w-full rounded-xl py-3 px-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-center"
            />
            <button
              onClick={handleUnlock}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              Desbloquear
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 text-center">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                Exportar Ficheiro (.json)
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4">
                Descarregue uma cópia completa de todos os registos atuais.
              </p>
              <button
                onClick={handleExport}
                disabled={loading}
                className="btn-modern w-full py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Exportar Base de Dados
              </button>
            </div>

            <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl border border-sky-200 dark:border-sky-500/30 text-center">
              <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-2">
                Importar Ficheiro (.json)
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4">
                Carregue um backup antigo. Ficará espelhado com os dados na
                Nuvem.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="btn-modern w-full py-2.5 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-500"
              >
                {loading ? "A processar..." : "Selecionar e Importar"}
              </button>
            </div>

            {autoBackupsList.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Backups Automáticos</span>
                </h4>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-4">
                  O sistema extrai bases semanais automaticamente e armazena localmente.
                </p>
                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                  {autoBackupsList.map(b => (
                    <div key={b.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{b.id}</p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(b.timestamp).toLocaleString()} • {(b.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button 
                        onClick={() => downloadAutoBackup(b.id)}
                        className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                        title="Descarregar ZIP/JSON"
                      >
                        <HardDrive className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
