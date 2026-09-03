import React, { useState, useMemo } from "react";
import { Member } from "../types";
import { useSettings } from "../context/SettingsContext";
import { useDialog } from "../context/DialogContext";
import {
  MessageCircle,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Search,
  Edit2,
  Trash2,
  X,
  Instagram,
  Facebook,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface WhatsAppGroupItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  category?: string;
  type?: "academico" | "seminario";
  requiredPassword?: string;
  visibleToRoles?: string[];
  imageUrl?: string;
}

const DEFAULT_SEMINARY_GROUPS: WhatsAppGroupItem[] = [
  {
    id: "ws_geral_scj",
    name: "Seminário Provincial SCJ - Geral",
    url: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP",
    category: "Geral",
    type: "seminario",
    description: "Canal oficial da Reitoria e comunidade formativa do Seminário Provincial SCJ para avisos, celebrações e comunicados gerais.",
  },
  {
    id: "ws_liturgia",
    name: "Comissão de Liturgia & Cantos",
    url: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP",
    category: "Comissões",
    type: "seminario",
    description: "Coordenação das celebrações diárias, escalas de acólitos, leitores, ministérios e repertório litúrgico comunitário.",
  },
  {
    id: "ws_comunicacao",
    name: "Comissão de Comunicação & Mídia",
    url: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP",
    category: "Comissões",
    type: "seminario",
    description: "Divulgação pastoral, informativos oficiais, registros fotográficos e coberturas dos eventos do seminário.",
  },
  {
    id: "ws_turmas",
    name: "Filosofia & Teologia",
    url: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP",
    category: "Turmas",
    type: "seminario",
    description: "Espaço fraterno de integração acadêmica, materiais de estudo e acompanhamento das etapas de formação.",
  },
  {
    id: "ws_esportes",
    name: "Comissão de Esportes & Convivência",
    url: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP",
    category: "Comissões",
    type: "seminario",
    description: "Organização dos momentos recreativos fraternos, esportes, torneios e convivência comunitária.",
  },
];

interface SeminarWhatsAppMuralProps {
  member: Member | null;
}

export default function SeminarWhatsAppMural({ member }: SeminarWhatsAppMuralProps) {
  const { settings, updateSettings } = useSettings();
  const { showAlert, showConfirm } = useDialog();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal / Form state for Admin
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] = useState("Geral");
  const [formDescription, setFormDescription] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Password prompt state for locked groups
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordPromptGroup, setPasswordPromptGroup] = useState<WhatsAppGroupItem | null>(null);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Detect admin status
  const isAdmin = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (
      localStorage.getItem("adminMasterLogged") === "true" ||
      sessionStorage.getItem("adminMasterLogged") === "true"
    ) {
      return true;
    }
    if (member?.roles) {
      const allowedRoles = [
        "admin",
        "administrador",
        "diretoria",
        "gestão",
        "gestao",
        "comunicação",
        "comunicacao",
        "secretaria",
        "reitor",
        "vice-reitor",
        "padre",
      ];
      return member.roles.some((r) => allowedRoles.includes(r.toLowerCase().trim()));
    }
    return false;
  }, [member]);

  // Current groups list (fallback to defaults if empty)
  const groupsList: WhatsAppGroupItem[] = useMemo(() => {
    const custom = settings?.whatsappGroups;
    if (custom && custom.length > 0) {
      return custom.filter((g) => !g.type || g.type === "seminario");
    }
    return DEFAULT_SEMINARY_GROUPS;
  }, [settings?.whatsappGroups]);

  // Dynamic list of categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    groupsList.forEach((g) => {
      if (g.category) set.add(g.category.trim());
    });
    if (settings?.whatsappCategories) {
      settings.whatsappCategories.forEach((c) => set.add(c.trim()));
    }
    return Array.from(set).filter(Boolean);
  }, [groupsList, settings?.whatsappCategories]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groupsList.filter((g) => {
      const matchesCategory =
        selectedCategory === "all" ||
        (g.category && g.category.toLowerCase() === selectedCategory.toLowerCase());
      const matchesSearch =
        !searchQuery.trim() ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [groupsList, selectedCategory, searchQuery]);

  // Copy URL action
  const handleCopy = async (group: WhatsAppGroupItem) => {
    try {
      await navigator.clipboard.writeText(group.url);
      setCopiedId(group.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback
    }
  };

  // Open Group
  const handleOpenGroup = (group: WhatsAppGroupItem) => {
    if (group.requiredPassword) {
      setPasswordPromptGroup(group);
      setEnteredPassword("");
      setPasswordError(false);
      setPasswordModalOpen(true);
    } else {
      window.open(group.url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordPromptGroup) return;

    if (enteredPassword.trim() === passwordPromptGroup.requiredPassword?.trim()) {
      setPasswordModalOpen(false);
      window.open(passwordPromptGroup.url, "_blank", "noopener,noreferrer");
    } else {
      setPasswordError(true);
    }
  };

  // Open Edit/Create Modal
  const openCreateModal = () => {
    setEditingGroupId(null);
    setFormName("");
    setFormUrl("https://chat.whatsapp.com/");
    setFormCategory("Geral");
    setFormDescription("");
    setFormPassword("");
    setIsModalOpen(true);
  };

  const openEditModal = (group: WhatsAppGroupItem) => {
    setEditingGroupId(group.id);
    setFormName(group.name);
    setFormUrl(group.url);
    setFormCategory(group.category || "Geral");
    setFormDescription(group.description || "");
    setFormPassword(group.requiredPassword || "");
    setIsModalOpen(true);
  };

  // Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      await showAlert("Atenção", "Por favor, preencha o nome e o link de convite do grupo.");
      return;
    }

    setFormSaving(true);
    try {
      const currentGroups = [...groupsList];

      if (editingGroupId) {
        // Edit existing
        const updated = currentGroups.map((g) =>
          g.id === editingGroupId
            ? {
                ...g,
                name: formName.trim(),
                url: formUrl.trim(),
                category: formCategory.trim(),
                description: formDescription.trim(),
                requiredPassword: formPassword.trim() || undefined,
                type: "seminario" as const,
              }
            : g
        );
        await updateSettings({ whatsappGroups: updated });
      } else {
        // Create new
        const newGroup: WhatsAppGroupItem = {
          id: "ws_" + Date.now().toString(36),
          name: formName.trim(),
          url: formUrl.trim(),
          category: formCategory.trim(),
          description: formDescription.trim(),
          requiredPassword: formPassword.trim() || undefined,
          type: "seminario",
        };
        await updateSettings({ whatsappGroups: [...currentGroups, newGroup] });
      }

      setIsModalOpen(false);
      await showAlert("Sucesso", "Mural de grupos atualizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      await showAlert("Erro", "Não foi possível salvar o grupo: " + (err?.message || "Erro desconhecido"));
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (group: WhatsAppGroupItem) => {
    const confirmed = await showConfirm(
      "Remover Grupo",
      `Deseja realmente remover o grupo "${group.name}" do mural do seminário?`
    );
    if (!confirmed) return;

    try {
      const updated = groupsList.filter((g) => g.id !== group.id);
      await updateSettings({ whatsappGroups: updated });
      await showAlert("Removido", "O grupo foi removido do mural.");
    } catch (err: any) {
      console.error(err);
      await showAlert("Erro", "Não foi possível remover o grupo.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all">
      {/* Mural Header Banner */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              <MessageCircle className="w-4 h-4 fill-white" />
              Mural do Seminário
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              Grupos Oficiais do WhatsApp
            </h3>
            <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
              Participe dos canais e grupos oficiais do Seminário Provincial Sagrado Coração de Jesus. Acompanhe escalas litúrgicas, comunicados da reitoria, turmas e comissões.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="self-start md:self-center flex items-center gap-2 px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 rounded-2xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              Adicionar Grupo
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar grupo por nome ou comissão..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === "all"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Todos ({groupsList.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <MessageCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Nenhum grupo encontrado
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Nenhum grupo corresponde à busca "${searchQuery}". Tente outros termos.`
              : "Não há grupos disponíveis nesta categoria no momento."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const isCopied = copiedId === group.id;
            return (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative"
              >
                <div>
                  {/* Top Bar: Icon + Category Badge + Admin Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#25D366]/15 flex items-center justify-center text-[#25D366] flex-shrink-0 group-hover:scale-105 transition-transform">
                        <MessageCircle className="w-5 h-5 fill-[#25D366]" />
                      </div>
                      <div>
                        {group.category && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40">
                            {group.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin Buttons or Lock Icon */}
                    <div className="flex items-center gap-1">
                      {group.requiredPassword && (
                        <span
                          title="Grupo restrito por senha"
                          className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(group)}
                            title="Editar Grupo"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            title="Remover Grupo"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Group Name & Description */}
                  <h4 className="text-base font-bold text-slate-800 dark:text-white leading-snug mb-1.5">
                    {group.name}
                  </h4>
                  {group.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-3">
                      {group.description}
                    </p>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => handleOpenGroup(group)}
                    className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Entrar no Grupo</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>

                  <button
                    onClick={() => handleCopy(group)}
                    title={isCopied ? "Link copiado!" : "Copiar link de convite"}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isCopied
                        ? "bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Institutional Channels Below */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
          Redes & Canais Institucionais
        </h4>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://instagram.com/seminarioprovincial.scj"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <Instagram className="w-4 h-4" />
            Instagram @seminarioprovincial.scj
          </a>
          <a
            href="https://facebook.com/seminarioprovincial.scj"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <Facebook className="w-4 h-4" />
            Facebook Oficial
          </a>
          {settings?.socialWhatsappUrl && (
            <a
              href={settings.socialWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              Contato da Secretaria
            </a>
          )}
        </div>
      </div>

      {/* Admin Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {editingGroupId ? "Editar Grupo do WhatsApp" : "Novo Grupo do WhatsApp"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure as informações que serão exibidas no mural do seminário.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Turma 1º Ano Teologia"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                  Link de Convite do WhatsApp *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Ex: Geral, Comissões, Turmas"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                    Senha Opcional (Restrito)
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Vazio = Livre acesso"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1 block">
                  Descrição / Objetivo do Grupo
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Breve resumo sobre quem deve participar deste canal e orientações..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-2"
                >
                  {formSaving ? "Salvando..." : "Salvar no Mural"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {passwordModalOpen && passwordPromptGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              Grupo Protegido
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              O grupo <strong>{passwordPromptGroup.name}</strong> requer senha para acessar o link de convite.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                autoFocus
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setPasswordError(false);
                }}
                placeholder="Digite a senha do grupo"
                className={`w-full text-center bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-sm outline-none font-bold ${
                  passwordError
                    ? "border-rose-500 focus:ring-2 focus:ring-rose-500/30"
                    : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30"
                }`}
              />

              {passwordError && (
                <p className="text-[11px] font-bold text-rose-500">
                  Senha incorreta. Verifique com o administrador.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  Acessar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
