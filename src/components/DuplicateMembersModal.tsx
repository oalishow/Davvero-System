import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Merge,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ArrowRight,
  Check,
  Building2,
  UserCheck
} from 'lucide-react';
import type { Member } from '../types';
import {
  findDuplicateGroups,
  mergeDuplicateMembers,
  normalizeAllMemberNamesToUpperCase,
  formatCPFNumber,
  DuplicateGroup
} from '../lib/memberDeduplication';

interface DuplicateMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onDataChanged?: () => void;
  currentAdminName?: string;
}

export default function DuplicateMembersModal({
  isOpen,
  onClose,
  members,
  onDataChanged,
  currentAdminName = "Administrador"
}: DuplicateMembersModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMasters, setSelectedMasters] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [isNormalizingNames, setIsNormalizingNames] = useState(false);

  // Analisar grupos de duplicados
  const duplicateGroups = useMemo(() => {
    return findDuplicateGroups(members);
  }, [members]);

  // Inicializar seleção de mestres padrão
  const effectiveMasters = useMemo(() => {
    const map: Record<string, string> = {};
    duplicateGroups.forEach(group => {
      map[group.key] = selectedMasters[group.key] || group.suggestedMasterId;
    });
    return map;
  }, [duplicateGroups, selectedMasters]);

  // Filtragem dos grupos pela busca
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return duplicateGroups;
    const term = searchTerm.toLowerCase();
    return duplicateGroups.filter(group => {
      const matchReason = group.reason.toLowerCase().includes(term);
      const matchMembers = group.members.some(m => 
        m.name?.toLowerCase().includes(term) ||
        m.ra?.toLowerCase().includes(term) ||
        m.cpf?.includes(term) ||
        m.email?.toLowerCase().includes(term)
      );
      return matchReason || matchMembers;
    });
  }, [duplicateGroups, searchTerm]);

  if (!isOpen) return null;

  // Unificar um grupo individualmente
  const handleMergeGroup = async (group: DuplicateGroup) => {
    const masterId = effectiveMasters[group.key] || group.suggestedMasterId;
    const duplicateIds = group.members.map(m => m.id).filter(id => id !== masterId);

    if (duplicateIds.length === 0) return;

    setIsProcessing(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    try {
      const result = await mergeDuplicateMembers(masterId, duplicateIds, currentAdminName);
      if (result.success) {
        setActionSuccessMessage(`Unificação concluída! ${result.mergedCount} cadastro(s) secundário(s) foram unidos ao mestre e ${result.attendancesUpdated} presenças foram migradas.`);
        if (onDataChanged) onDataChanged();
      }
    } catch (err: any) {
      console.error("Erro ao unificar cadastros:", err);
      setActionErrorMessage(err.message || "Falha ao unificar cadastros.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Unificar todos os grupos automaticamente
  const handleMergeAll = async () => {
    if (duplicateGroups.length === 0) return;
    const confirm = window.confirm(
      `Deseja realmente unificar TODOS os ${duplicateGroups.length} grupos de duplicados detectados? Os registros mais completos serão preservados como cadastros principais e as presenças serão integradas.`
    );
    if (!confirm) return;

    setIsProcessing(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    let totalMerged = 0;
    let totalAtts = 0;

    try {
      for (const group of duplicateGroups) {
        const masterId = effectiveMasters[group.key] || group.suggestedMasterId;
        const duplicateIds = group.members.map(m => m.id).filter(id => id !== masterId);
        if (duplicateIds.length > 0) {
          const res = await mergeDuplicateMembers(masterId, duplicateIds, currentAdminName);
          totalMerged += res.mergedCount;
          totalAtts += res.attendancesUpdated;
        }
      }

      setActionSuccessMessage(`Todos os duplicados foram unificados com sucesso! Total de ${totalMerged} cadastros mesclados e ${totalAtts} presenças integradas.`);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      console.error("Erro na unificação em massa:", err);
      setActionErrorMessage(err.message || "Erro durante o processo de unificação.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Padronizar todos os nomes em maiúsculas
  const handleNormalizeAllNames = async () => {
    const confirm = window.confirm(
      "Deseja converter todos os nomes de membros no banco de dados para LETRAS MAIÚSCULAS? Isso padronizará todas as pessoas já cadastradas e seus históricos."
    );
    if (!confirm) return;

    setIsNormalizingNames(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

    try {
      const res = await normalizeAllMemberNamesToUpperCase(currentAdminName);
      setActionSuccessMessage(
        res.totalUpdated > 0
          ? `Padronização finalizada com sucesso! ${res.totalUpdated} nomes foram convertidos para maiúsculas.`
          : `Todos os ${res.totalProcessed} cadastros já estavam com os nomes padronizados em maiúsculas.`
      );
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      console.error("Erro ao converter nomes em maiúsculas:", err);
      setActionErrorMessage(err.message || "Falha ao padronizar nomes.");
    } finally {
      setIsNormalizingNames(false);
    }
  };

  const totalDuplicateAccounts = duplicateGroups.reduce((acc, g) => acc + (g.members.length - 1), 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm pwa-safe-area animated-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Verificador de Cadastros & Unificação
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Detecte cadastros repetidos por CPF ou RA e una-os com segurança
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
          {/* Messages */}
          {actionSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{actionSuccessMessage}</div>
              <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {actionErrorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{actionErrorMessage}</div>
              <button onClick={() => setActionErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Actions & Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Membros</span>
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{members.length}</span>
              <span className="text-xs text-slate-500 mt-0.5">Cadastros analisados</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Grupos Duplicados</span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{duplicateGroups.length}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {totalDuplicateAccounts > 0 ? `${totalDuplicateAccounts} contas repetidas` : 'Nenhuma duplicata detectada'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider">Padronização</span>
                <p className="text-xs text-sky-800 dark:text-sky-200 font-medium mt-1">
                  Nomes em Caixa Alta (Maiúsculas)
                </p>
              </div>
              <button
                onClick={handleNormalizeAllNames}
                disabled={isNormalizingNames || isProcessing}
                className="mt-3 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isNormalizingNames ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Padronizar Nomes (MAIÚSCULA)
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar duplicados por nome, CPF ou RA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {duplicateGroups.length > 0 && (
              <button
                onClick={handleMergeAll}
                disabled={isProcessing}
                className="w-full sm:w-auto py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
                Unificar Todos os Grupos ({duplicateGroups.length})
              </button>
            )}
          </div>

          {/* Duplicate Groups List */}
          {filteredGroups.length > 0 ? (
            <div className="space-y-4">
              {filteredGroups.map((group, groupIdx) => {
                const currentMasterId = effectiveMasters[group.key] || group.suggestedMasterId;

                return (
                  <div
                    key={group.key}
                    className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-amber-200 dark:border-amber-800/60 p-4 sm:p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-black text-xs flex items-center justify-center">
                          {groupIdx + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                          {group.reason}
                        </h4>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          {group.members.length} registros
                        </span>
                      </div>

                      <button
                        onClick={() => handleMergeGroup(group)}
                        disabled={isProcessing}
                        className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 self-end sm:self-auto"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
                        Unificar Este Grupo
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Selecione qual cadastro será o <strong className="text-emerald-600 dark:text-emerald-400">Mestre (Principal)</strong>. Os demais terão suas presenças e informações complementares transferidas para ele:
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.members.map((member) => {
                        const isMaster = member.id === currentMasterId;

                        return (
                          <div
                            key={member.id}
                            onClick={() => {
                              setSelectedMasters(prev => ({ ...prev, [group.key]: member.id }));
                            }}
                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                              isMaster
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`master_${group.key}`}
                                  checked={isMaster}
                                  onChange={() => {
                                    setSelectedMasters(prev => ({ ...prev, [group.key]: member.id }));
                                  }}
                                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className={`text-xs font-bold ${isMaster ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-200'}`}>
                                  {member.name || 'Sem nome'}
                                </span>
                              </div>

                              {isMaster ? (
                                <span className="text-[10px] font-extrabold uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                  <Check className="w-3 h-3" /> MESTRE
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                                  Secundário
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
                              <div>
                                <span className="font-semibold text-slate-400">RA: </span>
                                <span>{member.ra || 'S/N'}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-400">CPF: </span>
                                <span>{formatCPFNumber(member.cpf) || 'Não inf.'}</span>
                              </div>
                              {member.email && (
                                <div className="col-span-2 truncate">
                                  <span className="font-semibold text-slate-400">E-mail: </span>
                                  <span>{member.email}</span>
                                </div>
                              )}
                              {member.course && (
                                <div className="col-span-2 truncate">
                                  <span className="font-semibold text-slate-400">Curso: </span>
                                  <span>{member.course}</span>
                                </div>
                              )}
                              <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                                {member.photoUrl && (
                                  <span className="text-[9px] font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded">
                                    Com Foto
                                  </span>
                                )}
                                {member.isApproved && (
                                  <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                                    Aprovado
                                  </span>
                                )}
                                {member.roles && member.roles.map(r => (
                                  <span key={r} className="text-[9px] font-semibold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                {searchTerm ? 'Nenhum grupo corresponde à sua busca' : 'Nenhum cadastro duplicado encontrado!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                {searchTerm 
                  ? 'Tente pesquisar por outro termo ou limpe a busca.' 
                  : 'A base de dados de membros está organizada sem duplicidades de CPF ou RA.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {duplicateGroups.length > 0
              ? `${duplicateGroups.length} grupo(s) com potenciais repetições`
              : 'Base de dados consistente'}
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
