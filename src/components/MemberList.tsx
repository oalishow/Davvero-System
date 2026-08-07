import { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, appId } from '../lib/firebase';
import type { Member } from '../types';
import { CUSTOM_ROLES_KEY } from '../lib/constants';
import MemberEditModal from './MemberEditModal';

interface MemberListProps {
  initialFilterStatus?: 'all' | 'active' | 'inactive' | 'visitor';
  adminAccessLevel?: "ADMIN" | "GERENTE" | "LEITOR";
}

export default function MemberList({ initialFilterStatus = 'all', adminAccessLevel = "ADMIN" }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'visitor'>(initialFilterStatus);

  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_ROLES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO", "DIRETOR", "VICE-DIRETOR", "RELIGIOSO(A)", "COORDENADOR(A)", "REITOR", "VICE-REITOR", "PSICÓLOGO(A)", "DIRETOR ESPIRITUAL"];
  const availableRoles = [...baseRoles, ...customRoles];

  useEffect(() => {
    setFilterStatus(initialFilterStatus);
  }, [initialFilterStatus]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, `artifacts/${appId}/public/data/students`));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
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

  const handleUpdateClose = () => {
    setEditingMember(null);
  };

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus]);

  // Filtragem local
  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchName = m.name?.toLowerCase().includes(term);
    const matchRa = m.ra?.toLowerCase().includes(term);
    const matchRoles = m.roles?.some(role => role.toLowerCase().includes(term));
    const matchSearch = matchName || matchRa || matchRoles;

    const matchFilterRole = filterRole === '' || m.roles?.includes(filterRole);
    let matchStatus = true;
    if (filterStatus === 'active') matchStatus = m.isActive;
    if (filterStatus === 'inactive') matchStatus = !m.isActive;
    if (filterStatus === 'visitor') matchStatus = !!m.roles?.includes("VISITANTE");

    return matchSearch && matchFilterRole && matchStatus;
  });

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
      <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-4 no-print">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar membro ou RA..."
            className="input-modern w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive' | 'visitor')}
            className="input-modern w-full sm:w-32 pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none"
          >
            <option value="all">Status: Todos</option>
            <option value="active">Status: Ativo</option>
            <option value="inactive">Status: Inativo</option>
            <option value="visitor">Status: Visitantes</option>
          </select>
        </div>
        <div className="relative w-full sm:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="input-modern w-full sm:w-48 pl-10 pr-4 py-2.5 rounded-xl text-sm appearance-none"
          >
            <option value="">Todos os Vínculos</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs sm:text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/10 px-3 py-1 mb-2 rounded-full border border-sky-200 dark:border-sky-500/20 inline-block w-fit no-print">
         Mostrando {filteredMembers.length} de {members.length} registos
      </div>

      {filteredMembers.length === 0 ? (
        <p className="text-slate-500 italic p-6 text-center text-sm">Nenhum registo encontrado com estes critérios.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto sm:print:max-h-none print:max-h-none print:overflow-visible custom-scrollbar pr-2">
            {paginatedMembers.map(member => {
              const isInactive = member.isActive === false;
              const formattedDate = member.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'N/D';
              const avatarUrl = member.photoUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';

              return (
                <div key={member.id} className="flex items-center justify-between bg-white dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all border border-slate-200 dark:border-slate-700/50">
                  <div className={`flex items-center gap-3 overflow-hidden pr-2 w-full ${isInactive ? 'opacity-60' : ''}`}>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 border border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700/50">
                      <img src={avatarUrl} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} alt="Avatar" />
                    </div>
                    <div className="overflow-hidden flex-grow">
                      <p className={`font-semibold text-sm sm:text-base flex items-center flex-wrap gap-2 ${isInactive ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>
                        <span className="break-words max-w-full">{member.name}</span> 
                        {member.ra && <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 rounded text-[9px] font-normal whitespace-nowrap">RA: {member.ra}</span>}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-sky-600 dark:text-sky-400/80 mb-0.5 truncate">{member.roles?.join(' • ')}</p>
                      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                        Válido até: {formattedDate}
                      </p>
                    </div>
                  </div>
                  {adminAccessLevel !== "LEITOR" && (
                    <button onClick={() => setEditingMember(member)} className="flex-shrink-0 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-600/20 hover:bg-sky-500 hover:text-white border border-sky-300 dark:border-sky-500/30 transition-all no-print">
                      Gerir
                    </button>
                  )}
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
