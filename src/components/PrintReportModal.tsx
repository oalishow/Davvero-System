import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2 } from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import { APP_VERSION } from '../lib/constants';
import { useSettings } from '../context/SettingsContext';
import DavveroLogo from './DavveroLogo';

interface PrintReportModalProps {
  onClose: () => void;
}

export default function PrintReportModal({ onClose }: PrintReportModalProps) {
  const { settings } = useSettings();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const q = query(collection(db, `artifacts/${appId}/public/data/students`), orderBy('name'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Member))
          .filter(m => !m.deletedAt && m.isApproved !== false);
        setMembers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[200] overflow-y-auto print:static print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-5xl my-auto max-h-[95vh] overflow-y-auto custom-scrollbar animated-scale-in flex flex-col print:shadow-none print:border-none print:max-h-none print:overflow-visible print:w-full print:max-w-none print:p-0 print:bg-white print:text-black">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-30 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 p-1.5 shadow-sm overflow-hidden border border-slate-700/60">
              <DavveroLogo
                src={settings.instLogo}
                color="#38bdf8"
                className="w-full h-full object-contain"
                iconClassName="w-full h-full text-sky-400"
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Relatório de Membros</h2>
              <p className="text-xs text-slate-500">Visualização para impressão da base de dados ativa • DAVVERO System</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handlePrint} 
              disabled={loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Imprimir Agora
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Cabeçalho de Impressão (Visível apenas na impressão) */}
        <div className="hidden print:flex items-center justify-between mb-8 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 p-1.5 border border-slate-800 overflow-hidden">
              <DavveroLogo
                src={settings.instLogo}
                color="#ffffff"
                className="w-full h-full object-contain"
                iconClassName="w-full h-full text-white"
              />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black uppercase tracking-wider text-black">Relatório Geral de Membros</h1>
              <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">DAVVERO SYSTEM • IDENTIFICAÇÃO E GESTÃO INSTITUCIONAL</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold text-black">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            <p className="text-[11px] text-slate-600 italic">Total de registos: {members.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 no-print">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">A carregar registos para impressão...</p>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:text-black">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 print:bg-slate-100">
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Foto</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Nome Completo</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">RA / Ident.</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Vínculos</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Diocese</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Validade</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Código</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-center">
                      <img 
                        src={m.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || 'U')}&background=e2e8f0&color=475569`} 
                        crossOrigin="anonymous"
                        className="w-8 h-8 rounded-full object-cover mx-auto border border-slate-200" 
                        alt=""
                        loading="eager"
                      />
                    </td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">{m.name}</td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-400">{m.ra || '---'}</td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-sky-600 font-medium">{m.roles?.join(', ')}</td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600">{m.diocese || '---'}</td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs">{m.validityDate ? new Date(m.validityDate + 'T23:59:59').toLocaleDateString() : 'N/D'}</td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] font-mono">{m.alphaCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-[10px] text-slate-400 no-print">
            Relatório gerado pelo sistema DAVVERO System v.{APP_VERSION}
        </div>
      </div>
    </div>,
    document.body
  );
}
