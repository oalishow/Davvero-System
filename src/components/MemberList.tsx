import { useEffect, useState, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowDownAZ, ArrowUpAZ, Calendar, RotateCcw, Building2, UserCheck, Layers } from 'lucide-react';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import { CUSTOM_ROLES_KEY } from '../lib/constants';
import MemberEditModal from './MemberEditModal';

interface MemberListProps {
  initialFilterStatus?: 'all' | 'active' | 'inactive' | 'visitor';
  adminAccessLevel?: "ADMIN" | "GERENTE" | "LEITOR";
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SortOption = 'name-asc' | 'name-desc' | 'recent' | 'oldest' | 'ra';

export default function MemberList({ initialFilterStatus = 'all', adminAccessLevel = "ADMIN" }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Filtros principais
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'visitor'>(initialFilterStatus);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [selectedLetter, setSelectedLetter] = useState<string>('');
  const [filterDiocese, setFilterDiocese] = useState<string>('');
  const [filterRegType, setFilterRegType] = useState<'all' | 'quick' | 'full'>('all');

  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_ROLES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "PROFISSIONAL DA EDUCAÇÃO", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO", "DIRETOR", "VICE-DIRETOR", "RELIGIOSO(A)", "COORDENADOR(A)", "REITOR", "VICE-REITOR", "PSICÓLOGO(A)", "DIRETOR ESPIRITUAL"];
  const availableRoles = [...baseRoles, ...customRoles];

  useEffect(() => {
    setFilterStatus(initialFilterStatus);
  }, [initialFilterStatus]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, `artifacts/${appId}/public/data/students`));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs
        .filter((d) => !d.id.startsWith('_') && Boolean(d.data()?.name))
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      loaded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      // Apenas exibe membros aprovados e não excluídos (pula docs de config)
      setMembers(loaded.filter(m => m.alphaCode && !m.deletedAt && m.isApproved !== false));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Lista de Dioceses únicas para o filtro
  const availableDioceses = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      if (m.diocese && m.diocese.trim() && m.diocese !== 'GERAL') {
        set.add(m.diocese.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [members]);

  // Contagem por letra inicial para os botões do índice alfabético
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => {
      const firstLetter = (m.name || "").trim().charAt(0).toUpperCase();
      if (firstLetter) {
        counts[firstLetter] = (counts[firstLetter] || 0) + 1;
      }
    });
    return counts;
  }, [members]);

  const handleUpdateClose = () => {
    setEditingMember(null);
  };

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus, sortBy, selectedLetter, filterDiocese, filterRegType]);

  // Filtragem local
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const term = searchTerm.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(term);
      const matchRa = m.ra?.toLowerCase().includes(term);
      const matchCpf = (m as any)?.cpf?.includes(term);
      const matchRoles = m.roles?.some(role => role.toLowerCase().includes(term));
      const matchSearch = !term || matchName || matchRa || matchCpf || matchRoles;

      const matchFilterRole = filterRole === '' || m.roles?.includes(filterRole);
      
      let matchStatus = true;
      if (filterStatus === 'active') matchStatus = m.isActive;
      if (filterStatus === 'inactive') matchStatus = !m.isActive;
      if (filterStatus === 'visitor') matchStatus = !!m.roles?.includes("VISITANTE");

      const matchLetter = !selectedLetter || (m.name || '').trim().toUpperCase().startsWith(selectedLetter);

      const matchDiocese = !filterDiocese || m.diocese === filterDiocese;

      let matchRegType = true;
      if (filterRegType === 'quick') matchRegType = m.registrationType === 'quick';
      if (filterRegType === 'full') matchRegType = m.registrationType !== 'quick';

      return matchSearch && matchFilterRole && matchStatus && matchLetter && matchDiocese && matchRegType;
    }).sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '', 'pt-BR', { sensitivity: 'base' });
      }
      if (sortBy === 'recent') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'ra') {
        return (a.ra || '').localeCompare(b.ra || '', undefined, { numeric: true });
      }
      return 0;
    });
  }, [members, searchTerm, filterRole, filterStatus, selectedLetter, filterDiocese, filterRegType, sortBy]);

  const hasActiveFilters = Boolean(
    searchTerm ||
    filterRole ||
    filterStatus !== initialFilterStatus ||
    selectedLetter ||
    filterDiocese ||
    filterRegType !== 'all' ||
    sortBy !== 'name-asc'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterRole('');
    setFilterStatus(initialFilterStatus);
    setSortBy('name-asc');
    setSelectedLetter('');
    setFilterDiocese('');
    setFilterRegType('all');
  };

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center p-6">
         <div className="w-6 h-6 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {/* Barra de Busca e Filtros Principais */}
      <div className="space-y-3 mt-4 mb-4 no-print">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Pesquisar por nome, RA ou CPF..."
              className="input-modern w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Ordenação Alfabética / Critério */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {sortBy === 'name-asc' ? (
                <ArrowDownAZ className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              ) : sortBy === 'name-desc' ? (
                <ArrowUpAZ className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <Calendar className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input-modern w-full sm:w-56 pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none font-medium"
              title="Critério de ordenação da lista"
            >
              <option value="name-asc">Ordem Alfabética (A → Z)</option>
              <option value="name-desc">Ordem Alfabética (Z → A)</option>
              <option value="recent">Mais Recentes (Cadastro)</option>
              <option value="oldest">Mais Antigos</option>
              <option value="ra">Por R.A. (Crescente)</option>
            </select>
          </div>
        </div>

        {/* Linha Secundária de Filtros: Status, Vínculo, Diocese, Tipo de Cadastro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Filtro Status */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive' | 'visitor')}
              className="input-modern w-full pl-8 pr-3 py-2 rounded-xl text-xs appearance-none"
            >
              <option value="all">Status: Todos</option>
              <option value="active">Status: Ativo</option>
              <option value="inactive">Status: Inativo</option>
              <option value="visitor">Status: Visitantes</option>
            </select>
          </div>

          {/* Filtro Vínculo */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterRole} 
              onChange={(e) => setFilterRole(e.target.value)}
              className="input-modern w-full pl-8 pr-3 py-2 rounded-xl text-xs appearance-none"
            >
              <option value="">Todos os Vínculos</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Filtro Diocese */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterDiocese} 
              onChange={(e) => setFilterDiocese(e.target.value)}
              className="input-modern w-full pl-8 pr-3 py-2 rounded-xl text-xs appearance-none"
            >
              <option value="">Todas as Dioceses</option>
              {availableDioceses.map(dio => (
                <option key={dio} value={dio}>{dio}</option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Cadastro */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select 
              value={filterRegType} 
              onChange={(e) => setFilterRegType(e.target.value as 'all' | 'quick' | 'full')}
              className="input-modern w-full pl-8 pr-3 py-2 rounded-xl text-xs appearance-none"
            >
              <option value="all">Tipo: Todos</option>
              <option value="quick">⚡ Cadastro Rápido</option>
              <option value="full">📑 Cadastro Completo</option>
            </select>
          </div>
        </div>

        {/* Separador e Barra de Letras Alfabéticas (A-Z) */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ArrowDownAZ className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Filtrar por Letra Inicial:
            </span>
            {selectedLetter && (
              <button
                onClick={() => setSelectedLetter('')}
                className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Limpar letra (Ver todas)
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedLetter('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedLetter === ''
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              Todas ({members.length})
            </button>

            {ALPHABET.map((letter) => {
              const count = letterCounts[letter] || 0;
              const isSelected = selectedLetter === letter;
              const hasItems = count > 0;

              return (
                <button
                  key={letter}
                  disabled={!hasItems}
                  onClick={() => setSelectedLetter(isSelected ? '' : letter)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-0.5 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs scale-105'
                      : hasItems
                      ? 'bg-white dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                      : 'opacity-30 bg-transparent text-slate-400 cursor-not-allowed border border-transparent'
                  }`}
                  title={hasItems ? `Letra ${letter}: ${count} membro(s)` : `Nenhum membro com a letra ${letter}`}
                >
                  <span>{letter}</span>
                  {hasItems && count > 0 && (
                    <span className={`text-[9px] font-semibold ${isSelected ? 'text-sky-100' : 'text-slate-400 dark:text-slate-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Barra de Status e Contagem com Botão de Limpeza */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 no-print">
        <div className="text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/10 px-3 py-1.5 rounded-full border border-sky-200 dark:border-sky-500/20 inline-flex items-center gap-1.5">
          <span>
            Mostrando <strong>{filteredMembers.length}</strong> de <strong>{members.length}</strong> registros
          </span>
          {selectedLetter && (
            <span className="bg-sky-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              Letra {selectedLetter}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Todos os Filtros
          </button>
        )}
      </div>

      {filteredMembers.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold mb-1">
            Nenhum membro encontrado com estes filtros.
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Tente pesquisar com outro termo ou redefinir os filtros selecionados.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-sky-500 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Lista Completa
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="space-y-2 max-h-[360px] sm:max-h-[460px] overflow-y-auto sm:print:max-h-none print:max-h-none print:overflow-visible custom-scrollbar pr-2">
            {paginatedMembers.map((member, index) => {
              const isInactive = member.isActive === false;
              const formattedDate = member.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'N/D';
              const avatarUrl = member.photoUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';

              // Seletor de cabeçalho de letra para separar alfabeticamente
              const currentLetter = (member.name || '').trim().charAt(0).toUpperCase();
              const prevMember = index > 0 ? paginatedMembers[index - 1] : null;
              const prevLetter = prevMember ? (prevMember.name || '').trim().charAt(0).toUpperCase() : null;
              const showLetterDivider = (sortBy === 'name-asc' || sortBy === 'name-desc') && (!selectedLetter) && (currentLetter !== prevLetter);

              return (
                <div key={member.id} className="space-y-2">
                  {showLetterDivider && (
                    <div className="flex items-center gap-2 pt-2.5 pb-1 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
                      <span className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-mono text-xs font-black shadow-xs">
                        {currentLetter}
                      </span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Letra {currentLetter}
                      </span>
                      <div className="h-[1px] flex-1 bg-slate-200 dark:border-slate-800" />
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-white dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all border border-slate-200 dark:border-slate-700/50 shadow-xs">
                    <div className={`flex items-center gap-3 overflow-hidden pr-2 w-full ${isInactive ? 'opacity-60' : ''}`}>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 border border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700/50">
                        <img src={avatarUrl} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} alt="Avatar" />
                      </div>
                      <div className="overflow-hidden flex-grow">
                        <p className={`font-semibold text-sm sm:text-base flex items-center flex-wrap gap-2 ${isInactive ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>
                          <span className="break-words max-w-full">{member.name}</span> 
                          {member.ra && <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 rounded text-[9px] font-normal whitespace-nowrap">RA: {member.ra}</span>}
                          {member.registrationType === 'quick' && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              ⚡ Rápido
                            </span>
                          )}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-sky-600 dark:text-sky-400/80 mb-0.5 truncate flex items-center gap-1.5 flex-wrap">
                          <span>{member.roles?.join(' • ')}</span>
                          {member.diocese && member.diocese !== 'GERAL' && (
                            <span className="text-slate-400 dark:text-slate-500 font-normal">
                              ({member.diocese})
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          Válido até: {formattedDate}
                        </p>
                      </div>
                    </div>
                    {adminAccessLevel !== "LEITOR" && (
                      <button onClick={() => setEditingMember(member)} className="flex-shrink-0 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-600/20 hover:bg-sky-500 hover:text-white border border-sky-300 dark:border-sky-500/30 transition-all no-print cursor-pointer">
                        Gerir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 no-print">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editingMember && (
        <MemberEditModal 
          member={editingMember} 
          onClose={() => setEditingMember(null)}
          onUpdate={handleUpdateClose}
        />
      )}
    </>
  );
}
