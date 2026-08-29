import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Edit2, ExternalLink, Users, Save, X, MessageCircle, Camera, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WhatsappGroup {
  id: string;
  name: string;
  url: string;
  description?: string;
  visibleToRoles?: string[];
  category?: string;
  type?: 'academico' | 'seminario';
  requiredPassword?: string;
  imageUrl?: string;
}

interface WhatsappMuralViewProps {
  isAdmin: boolean;
  userRoles: string[];
  whatsappGroups: WhatsappGroup[];
  whatsappCategories: string[];
  customRoles?: string[];
  updateSettings: (settings: { whatsappGroups?: WhatsappGroup[]; whatsappCategories?: string[] }) => Promise<void>;
}

export default function WhatsappMuralView({ isAdmin, userRoles, whatsappGroups, whatsappCategories = [], customRoles = [], updateSettings }: WhatsappMuralViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<'academico' | 'seminario'>('seminario');
  const [requiredPassword, setRequiredPassword] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | "all">("all");
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  
  const [unlockTargetGroup, setUnlockTargetGroup] = useState<WhatsappGroup | null>(null);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState("");

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    whatsappCategories.forEach(c => cats.add(c));
    whatsappGroups.forEach(g => {
      if (g.category) cats.add(g.category);
    });
    return Array.from(cats).sort();
  }, [whatsappGroups, whatsappCategories]);

  useEffect(() => {
    const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO", "DIRETOR", "VICE-DIRETOR", "RELIGIOSO(A)", "COORDENADOR(A)", "REITOR", "VICE-REITOR", "PSICÓLOGO(A)", "DIRETOR ESPIRITUAL"];
    setAvailableRoles([...baseRoles, ...customRoles]);
  }, [customRoles]);

  const resetForm = () => {
    setName("");
    setUrl("");
    setDescription("");
    setCategory("");
    setType("seminario");
    setRequiredPassword("");
    setImageUrl("");
    setVisibleToRoles([]);
    setEditingId(null);
    setIsEditing(false);
  };

  const handleEdit = (group: WhatsappGroup) => {
    setName(group.name);
    setUrl(group.url);
    setDescription(group.description || "");
    setCategory(group.category || "");
    setType(group.type || 'academico');
    setRequiredPassword(group.requiredPassword || "");
    setImageUrl(group.imageUrl || "");
    setVisibleToRoles(group.visibleToRoles || []);
    setEditingId(group.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente remover este grupo?")) return;
    setIsLoading(true);
    try {
      const updated = whatsappGroups.filter(g => g.id !== id);
      await updateSettings({ whatsappGroups: updated });
    } catch (e) {
      console.error(e);
      alert("Erro ao remover grupo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        alert("Erro ao ler a imagem. Tente novamente.");
        setIsUploadingImage(false);
      };
      
      // Optionally resize if needed, but for now just read it as base64
      // We can use a simple canvas resize if we want to save space
      const image = new Image();
      image.src = URL.createObjectURL(file);
      image.onload = () => {
        const canvas = document.createElement("canvas");
        // Maintain aspect ratio, max width/height 300px
        const MAX_SIZE = 300;
        let width = image.width;
        let height = image.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setImageUrl(dataUrl);
        setIsUploadingImage(false);
      };
      image.onerror = () => {
        // Fallback to purely read
        reader.readAsDataURL(file);
      };

    } catch (err) {
      console.error("Erro no upload:", err);
      alert("Erro ao fazer upload da imagem. Tente novamente.");
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      alert("Nome e link são obrigatórios");
      return;
    }
    
    setIsLoading(true);
    try {
      let updated = [...whatsappGroups];
      
      if (editingId) {
        updated = updated.map(g => g.id === editingId ? { ...g, name, url, description, visibleToRoles: visibleToRoles, category: category.trim(), type, requiredPassword: requiredPassword.trim(), imageUrl } : g);
      } else {
        updated.push({
          id: Math.random().toString(36).substring(2, 9),
          name: name.trim(),
          url: url.trim(),
          description: description.trim(),
          visibleToRoles: visibleToRoles,
          category: category.trim(),
          type,
          requiredPassword: requiredPassword.trim(),
          imageUrl
        });
      }
      
      await updateSettings({ whatsappGroups: updated });
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar o grupo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const cat = newCategory.trim();
    if (!cat) return;
    if (whatsappCategories.includes(cat)) {
      setNewCategory("");
      return;
    }
    
    setIsLoading(true);
    try {
      const updated = [...whatsappCategories, cat];
      await updateSettings({ whatsappCategories: updated });
      setNewCategory("");
    } catch(e) {
      console.error(e);
      alert("Erro ao adicionar categoria");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCategory = async (cat: string) => {
    if (!window.confirm(`Remover categoria "${cat}"? (Os grupos não serão apagados)`)) return;
    setIsLoading(true);
    try {
      const updated = whatsappCategories.filter(c => c !== cat);
      await updateSettings({ whatsappCategories: updated });
    } catch(e) {
      console.error(e);
      alert("Erro ao remover categoria");
    } finally {
      setIsLoading(false);
    }
  };

  const hasSeminaryAccess = isAdmin || userRoles.some(r => ["SEMINARISTA", "PADRE", "REITOR", "VICE-REITOR", "BISPO", "DIÁCONO"].includes(r.toUpperCase()));

  const visibleGroups = useMemo(() => {
    let filtered = isAdmin ? whatsappGroups : whatsappGroups.filter(g => {
      if (g.type === 'seminario' && !hasSeminaryAccess) return false;
      if (!g.visibleToRoles || g.visibleToRoles.length === 0) return true;
      return g.visibleToRoles.some(r => userRoles.includes(r));
    });

    filtered = filtered.filter(g => (g.type || 'academico') === 'seminario');

    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter(g => g.category === selectedCategoryFilter);
    }
    
    return filtered;
  }, [isAdmin, whatsappGroups, userRoles, selectedCategoryFilter, hasSeminaryAccess]);

  const requestGroupAccess = (group: WhatsappGroup) => {
    if (group.requiredPassword) {
      setUnlockTargetGroup(group);
      setUnlockPasswordInput("");
    } else {
      window.open(group.url.startsWith('http') ? group.url : `https://${group.url}`, '_blank');
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockTargetGroup && unlockPasswordInput === unlockTargetGroup.requiredPassword) {
      window.open(unlockTargetGroup.url.startsWith('http') ? unlockTargetGroup.url : `https://${unlockTargetGroup.url}`, '_blank');
      setUnlockTargetGroup(null);
      setUnlockPasswordInput("");
    } else {
      alert("Senha incorreta");
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl border border-emerald-500/30 text-center relative overflow-hidden shadow-lg shadow-emerald-600/20">
        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10">
           <MessageCircle className="w-32 h-32 text-white" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
          Mural do WhatsApp
        </h2>
        <p className="text-xs sm:text-sm text-emerald-100 mt-2 relative z-10 max-w-lg mx-auto leading-relaxed">
          Participe dos grupos oficiais para receber comunicados, interagir com sua turma e acompanhar todas as novidades em tempo real.
        </p>
      </div>

      {isAdmin && (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setIsManagingCategories(!isManagingCategories);
              setIsEditing(false);
            }}
            disabled={isLoading}
            className="btn-modern bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            Categorias
          </button>
          <button
            onClick={() => {
              setIsEditing(true);
              setIsManagingCategories(false);
            }}
            disabled={isLoading || isEditing}
            className="btn-modern bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" /> Novo Grupo
          </button>
        </div>
      )}

      <AnimatePresence>
        {isAdmin && isManagingCategories && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Gerenciar Categorias
              </h3>
              <button onClick={() => setIsManagingCategories(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2 items-center mb-4">
              <input
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Nova Categoria..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={handleAddCategory}
                disabled={isLoading || !newCategory.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>

            {whatsappCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {whatsappCategories.map(cat => (
                  <div key={cat} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                    <span>{cat}</span>
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      disabled={isLoading}
                      className="ml-1 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Nenhuma categoria cadastrada.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdmin && isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
              {editingId ? "Editar Grupo" : "Adicionar Novo Grupo"}
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                <div className="relative w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 group">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Group Icon" className="w-full h-full object-cover" />
                  ) : (
                    <MessageCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  )}
                  <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${isUploadingImage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isUploadingImage}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">Imagem do Grupo (Opcional)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Clique na imagem para enviar uma foto ou cole a URL abaixo.</p>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Grupo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Turma Teologia 2024"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Link de Convite (URL)</label>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria (Opcional)</label>
                  {availableCategories.length > 0 ? (
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Sem Categoria --</option>
                      {availableCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="Adicione categorias antes ou digite aqui..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição (Opcional)</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ex: Grupo exclusivo para avisos acadêmicos"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha de Acesso (Opcional)</label>
                    <input
                      type="text"
                      value={requiredPassword}
                      onChange={e => setRequiredPassword(e.target.value)}
                      placeholder="Deixe em branco para acesso livre"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                {availableRoles.length > 0 && (
                  <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Visível para (Vínculos)</label>
                    <p className="text-[10px] text-slate-500 mb-2">Se nenhum vínculo for selecionado, o grupo será visível para <strong>todos</strong>.</p>
                    <div className="flex flex-wrap gap-2">
                      {availableRoles.map(role => {
                        const isSelected = visibleToRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setVisibleToRoles(prev => isSelected ? prev.filter(r => r !== role) : [...prev, role])}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isSelected ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'}`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 uppercase tracking-wider rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? "Salvando..." : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {availableCategories.length > 0 && !isEditing && (
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          <button
            onClick={() => setSelectedCategoryFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${selectedCategoryFilter === "all" ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
          >
            Todos
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${selectedCategoryFilter === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {visibleGroups.length === 0 && !isEditing ? (
        <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
           <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
             <MessageCircle className="w-8 h-8 text-slate-400" />
           </div>
           <p className="text-slate-600 dark:text-slate-400 font-medium">Nenhum grupo do WhatsApp configurado ou disponível para o seu perfil.</p>
           {isAdmin && <p className="text-sm mt-1 text-slate-500">Clique em "Novo Grupo" para adicionar.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleGroups.map((group) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={group.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-emerald-100 dark:bg-emerald-900/30">
                    {group.imageUrl ? (
                      <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-slate-800 dark:text-white font-bold leading-tight">{group.name}</h3>
                    {group.category && (
                      <span className="inline-block mt-1 mb-1 text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase">
                        {group.category}
                      </span>
                    )}
                    {group.description && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                    {isAdmin && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {!group.visibleToRoles || group.visibleToRoles.length === 0 ? (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase">Todos</span>
                        ) : (
                          group.visibleToRoles.map(r => (
                            <span key={r} className="text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded uppercase">
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => requestGroupAccess(group)}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> {group.requiredPassword ? "Acessar (Protegido)" : "Entrar no Grupo"}
                </button>
                
                {isAdmin && (
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(group)}
                      className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {unlockTargetGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative"
            >
              <button
                onClick={() => setUnlockTargetGroup(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-6 pt-2">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                  <ExternalLink className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Acesso Protegido</h3>
                <p className="text-sm text-slate-500 mt-1">Este grupo requer uma senha.</p>
              </div>
              <form onSubmit={handleUnlock} className="space-y-4">
                <input
                  type="text"
                  value={unlockPasswordInput}
                  onChange={e => setUnlockPasswordInput(e.target.value)}
                  placeholder="Digite a senha..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-center font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!unlockPasswordInput.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 uppercase text-sm tracking-wider"
                >
                  Confirmar Acesso
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
