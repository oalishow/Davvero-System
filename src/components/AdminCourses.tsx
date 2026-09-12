import React, { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Flame,
  Landmark,
  BookOpen,
  RotateCcw,
  Save,
  Loader2,
  Layers,
  Star,
  ArrowUpDown,
  User,
  CreditCard,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { CourseOffer } from "../types";
import {
  getCoursesList,
  saveCourseOffer,
  deleteCourseOffer,
  toggleCourseOfferStatus,
  restoreDefaultCourses,
  subscribeToCourses,
} from "../lib/coursesService";
import { useDialog } from "../context/DialogContext";
import Modal from "./Modal";
import ImageUploadField from "./ImageUploadField";

export default function AdminCourses() {
  const { showAlert, showConfirm } = useDialog();
  const [courses, setCourses] = useState<CourseOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseOffer | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState<Partial<CourseOffer>>({
    title: "",
    subtitle: "",
    description: "",
    category: "hotmart",
    tag: "Hotmart Oficial",
    imageUrl: "",
    imageFit: "contain",
    instructor: "",
    authorPhotoUrl: "",
    authorBio: "",
    publisher: "",
    year: "",
    pages: "",
    isbn: "",
    workload: "",
    price: "",
    installments: "",
    linkUrl: "",
    linkType: "hotmart",
    isPartnershipDiocese: false,
    diocesePartner: "",
    active: true,
    featured: false,
    order: 1,
  });

  const loadData = async (force = false) => {
    try {
      setLoading(true);
      const data = await getCoursesList(force);
      setCourses(data);
    } catch (err: any) {
      console.warn("Notice in AdminCourses loadData:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToCourses((updated) => {
      setCourses(updated);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredCourses = useMemo(() => {
    if (filterCategory === "all") return courses;
    return courses.filter((c) => c.category === filterCategory);
  }, [courses, filterCategory]);

  const handleOpenCreate = (preselectedCategory: CourseOffer["category"] = "hotmart") => {
    setEditingCourse(null);
    const isLivro = preselectedCategory === "livro";
    setFormData({
      id: (isLivro ? "livro_" : "curso_") + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      title: "",
      subtitle: "",
      description: "",
      category: preselectedCategory,
      tag: isLivro ? "Livro Docente" : preselectedCategory === "parceria" ? "Parceria Diocesana" : "Hotmart Oficial",
      imageUrl: "",
      imageFit: "contain",
      instructor: isLivro ? "Professor(a) da FAJOPA" : "Corpo Docente FAJOPA",
      authorPhotoUrl: "",
      authorBio: "",
      publisher: isLivro ? "Editora da FAJOPA / Parceira" : "",
      year: isLivro ? "2024" : "",
      pages: "",
      isbn: "",
      workload: isLivro ? "" : "40 horas",
      price: isLivro ? "R$ 49,90" : "R$ 149,90",
      installments: isLivro ? "Em até 3x sem juros" : "Em até 12x de R$ 14,90",
      linkUrl: "https://www.fajopa.org/",
      linkType: isLivro ? "external" : preselectedCategory === "parceria" ? "partnership" : "hotmart",
      isPartnershipDiocese: preselectedCategory === "parceria",
      diocesePartner: preselectedCategory === "parceria" ? "Diocese de Assis e Diocese de Lins" : "",
      active: true,
      featured: false,
      order: courses.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CourseOffer) => {
    setEditingCourse(c);
    setFormData({
      ...c,
      imageFit: c.imageFit || "contain",
      installments: c.installments || "",
      authorPhotoUrl: c.authorPhotoUrl || "",
      authorBio: c.authorBio || "",
      publisher: c.publisher || "",
      year: c.year || "",
      pages: c.pages || "",
      isbn: c.isbn || "",
      active: c.active !== false,
      featured: Boolean(c.featured),
      order: c.order || 1,
      tag: c.tag || (c.category === "hotmart" ? "Hotmart Oficial" : c.category === "livro" ? "Livro Docente" : "FAJOPA"),
      linkType: c.linkType || (c.category === "hotmart" ? "hotmart" : "external"),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!formData.title?.trim()) {
      await showAlert("Por favor, preencha o título do curso ou livro.");
      return;
    }

    let linkUrl = (formData.linkUrl || "").trim();
    if (!linkUrl) {
      await showAlert("Por favor, preencha o link de acesso ou compra.");
      return;
    }

    // Auto prepend https:// se não tiver protocolo
    if (!/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith("/")) {
      linkUrl = `https://${linkUrl}`;
    }

    let imageUrl = (formData.imageUrl || "").trim();
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith("/") && !imageUrl.startsWith("data:")) {
      imageUrl = `https://${imageUrl}`;
    }

    let authorPhotoUrl = (formData.authorPhotoUrl || "").trim();
    if (authorPhotoUrl && !/^https?:\/\//i.test(authorPhotoUrl) && !authorPhotoUrl.startsWith("/") && !authorPhotoUrl.startsWith("data:")) {
      authorPhotoUrl = `https://${authorPhotoUrl}`;
    }

    const courseToSave: CourseOffer = {
      id: editingCourse?.id || formData.id || ("curso_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6)),
      title: formData.title.trim(),
      subtitle: formData.subtitle?.trim() || "",
      description: formData.description?.trim() || "",
      category: formData.category || "hotmart",
      tag: formData.tag?.trim() || (formData.category === "hotmart" ? "Hotmart Oficial" : formData.category === "livro" ? "Livro Docente" : "FAJOPA"),
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
      imageFit: formData.imageFit || "contain",
      instructor: formData.instructor?.trim() || "Corpo Docente FAJOPA",
      authorPhotoUrl: authorPhotoUrl || undefined,
      authorBio: formData.authorBio?.trim() || undefined,
      publisher: formData.publisher?.trim() || undefined,
      year: formData.year?.trim() || undefined,
      pages: formData.pages?.trim() || undefined,
      isbn: formData.isbn?.trim() || undefined,
      workload: formData.workload?.trim() || "",
      price: formData.price?.trim() || "",
      installments: formData.installments?.trim() || "",
      linkUrl,
      linkType: formData.linkType || (formData.category === "hotmart" ? "hotmart" : "external"),
      isPartnershipDiocese: Boolean(formData.isPartnershipDiocese),
      diocesePartner: formData.diocesePartner?.trim() || "",
      active: formData.active !== false,
      featured: Boolean(formData.featured),
      order: Number(formData.order) || courses.length + 1,
      createdAt: editingCourse?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      await saveCourseOffer(courseToSave);
      setIsModalOpen(false);
      await showAlert("Salvo com sucesso!");
      await loadData(true);
    } catch (err: any) {
      console.error("Erro ao salvar curso:", err);
      await showAlert(`Erro ao salvar: ${err?.message || "Verifique a conexão com o banco de dados."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (course: CourseOffer) => {
    const confirmed = await showConfirm(
      `Tem certeza que deseja excluir "${course.title}"?`,
      { type: "warning" }
    );
    if (!confirmed) return;

    try {
      await deleteCourseOffer(course.id);
      await showAlert("Item excluído com sucesso.");
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      await showAlert(`Erro ao excluir: ${err?.message || "Tente novamente."}`);
    }
  };

  const handleToggleStatus = async (course: CourseOffer) => {
    try {
      const newStatus = !course.active;
      await toggleCourseOfferStatus(course.id, newStatus);
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, active: newStatus } : c))
      );
    } catch (err: any) {
      console.error(err);
      await showAlert("Erro ao alterar status.");
    }
  };

  const handleRestoreDefaults = async () => {
    const confirmed = await showConfirm(
      "Deseja restaurar todos os cursos e livros dos professores originais da FAJOPA no catálogo?",
      { type: "warning" }
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const restored = await restoreDefaultCourses();
      setCourses(restored);
      await showAlert("Cursos e livros oficiais da FAJOPA restaurados com sucesso!");
    } catch (err: any) {
      console.error(err);
      await showAlert(`Erro ao restaurar catálogo: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const isLivro = formData.category === "livro";

  return (
    <div className="space-y-6">
      {/* Topo do Gestor */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            Cursos, Ofertas & Livros dos Docentes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastre formações, livros dos professores com foto do autor, opções de parcelamento e upload de capas inteiras sem cortes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRestoreDefaults}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
            title="Restaurar catálogo inicial com livros e cursos da FAJOPA"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Catálogo</span>
          </button>

          <button
            onClick={() => handleOpenCreate("livro")}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            Novo Livro Docente
          </button>

          <button
            onClick={() => handleOpenCreate("hotmart")}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Curso
          </button>
        </div>
      </div>

      {/* Filtros rápidos de categoria */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "Todos os Itens", count: courses.length },
          { id: "livro", label: "Livros dos Docentes", count: courses.filter((c) => c.category === "livro").length },
          { id: "hotmart", label: "Cursos Hotmart", count: courses.filter((c) => c.category === "hotmart").length },
          { id: "parceria", label: "Parcerias Diocesanas", count: courses.filter((c) => c.category === "parceria").length },
          { id: "extensao", label: "Extensão Acadêmica", count: courses.filter((c) => c.category === "extensao").length },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterCategory(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterCategory === f.id
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                filterCategory === f.id
                  ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500"
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela / Lista de Itens */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Carregando catálogo de cursos e livros...</span>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            Nenhum item encontrado nesta categoria.
          </p>
          <button
            onClick={handleRestoreDefaults}
            className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
          >
            Restaurar Catálogo Oficial FAJOPA
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course) => {
            const isHotmart = course.category === "hotmart";
            const isPartnership = course.category === "parceria";
            const isItemLivro = course.category === "livro";

            return (
              <div
                key={course.id}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-800/80 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  course.active !== false
                    ? "border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                    : "border-slate-200/60 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Thumbnail com Exibição Inteira Garantida */}
                  <div
                    className={`rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 ${
                      isItemLivro ? "w-14 h-20" : "w-16 h-16"
                    }`}
                  >
                    {course.imageUrl ? (
                      <img
                        src={course.imageUrl}
                        alt=""
                        className={`w-full h-full ${
                          course.imageFit === "cover" ? "object-cover" : "object-contain"
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-indigo-500">
                        {isItemLivro ? <BookOpen className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-md">
                        {course.title}
                      </span>
                      {course.featured && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Destaque
                        </span>
                      )}
                      {course.tag && (
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isItemLivro
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : isHotmart
                              ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                              : isPartnership
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                              : "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {course.tag}
                        </span>
                      )}
                    </div>

                    {/* Autor / Docente com foto se houver */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {course.authorPhotoUrl ? (
                        <img
                          src={course.authorPhotoUrl}
                          alt={course.instructor || "Autor"}
                          className="w-4 h-4 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                        />
                      ) : (
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{course.instructor || "Docente FAJOPA"}</span>
                      {course.publisher && (
                        <span className="text-[11px] text-slate-400 font-normal">
                          • {course.publisher} {course.year ? `(${course.year})` : ""}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {course.subtitle || course.description}
                    </p>

                    {/* Preço e Condição de Parcelamento */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium pt-0.5">
                      {course.price && (
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          Preço: {course.price}
                        </span>
                      )}
                      {course.installments && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {course.installments}
                        </span>
                      )}
                      <span>• Ordem: #{course.order ?? 99}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleToggleStatus(course)}
                    className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                      course.active !== false
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                    title={course.active !== false ? "Desativar (Ocultar na vitrine)" : "Ativar (Exibir na vitrine)"}
                  >
                    {course.active !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <a
                    href={course.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-500 transition-all border border-slate-200 dark:border-slate-700"
                    title="Testar Link de Destino"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleOpenEdit(course)}
                    className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all border border-indigo-200 dark:border-indigo-800"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(course)}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-all border border-rose-200 dark:border-rose-800"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCourse ? `Editar: ${editingCourse.title}` : isLivro ? "Cadastrar Livro de Professor" : "Cadastrar Novo Curso / Oferta"}
        maxWidth="max-w-2xl"
        hideFooter={true}
      >
        <form onSubmit={handleSave} noValidate className="space-y-4 text-xs">
          {/* Seletor de Categoria e Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Tipo / Categoria *
              </label>
              <select
                value={formData.category || "hotmart"}
                onChange={(e) => {
                  const cat = e.target.value as any;
                  const isNewCatLivro = cat === "livro";
                  setFormData({
                    ...formData,
                    category: cat,
                    tag: isNewCatLivro ? "Livro Docente" : cat === "hotmart" ? "Hotmart Oficial" : cat === "parceria" ? "Parceria Diocesana" : "FAJOPA",
                    linkType: isNewCatLivro ? "external" : cat === "hotmart" ? "hotmart" : cat === "parceria" ? "partnership" : "external",
                    imageFit: isNewCatLivro ? "contain" : formData.imageFit || "contain",
                  });
                }}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium"
              >
                <option value="livro">Livro / Publicação de Docente</option>
                <option value="hotmart">Curso Hotmart Oficial</option>
                <option value="parceria">Parceria Diocesana</option>
                <option value="extensao">Extensão Universitária</option>
                <option value="outro">Outro Formato</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Ação do Botão
              </label>
              <select
                value={formData.linkType || "external"}
                onChange={(e) => setFormData({ ...formData, linkType: e.target.value as any })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
              >
                <option value="external">Comprar / Ver Detalhes (Externo)</option>
                <option value="hotmart">Checkout Hotmart</option>
                <option value="partnership">Ambiente Virtual / Classroom</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Selo no Card (Tag)
              </label>
              <input
                type="text"
                value={formData.tag || ""}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                placeholder="Ex: Livro Docente"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Título e Subtítulo */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              {isLivro ? "Título do Livro *" : "Título do Curso / Formação *"}
            </label>
            <input
              type="text"
              required
              value={formData.title || ""}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={isLivro ? "Ex: A Retomada de Tesouros Escondidos do Vaticano II" : "Ex: Introdução à Teologia Dogmática"}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Subtítulo ou Foco Central
            </label>
            <input
              type="text"
              value={formData.subtitle || ""}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder={isLivro ? "Ex: Evangelii Gaudium e a renovação eclesial conciliar" : "Ex: Módulo Oficial com Certificação FAJOPA"}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Seção de Upload da Imagem / Capa (Inteira sem cortes) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-500" />
                {isLivro ? "Capa do Livro (Upload do Computador / Dispositivo)" : "Capa do Curso / Oferta (Upload)"}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                Aparece inteira sem cortes
              </span>
            </div>

            <ImageUploadField
              label={isLivro ? "Arquivo da Capa do Livro" : "Arquivo da Imagem do Curso"}
              helperText="Envie a imagem da capa. Ela será renderizada por inteiro, sem cortes nas margens ou títulos."
              value={formData.imageUrl || ""}
              onChange={(val) => setFormData({ ...formData, imageUrl: val })}
              previewAspect={isLivro ? "portrait" : "landscape"}
              idPrefix="cover-image"
            />

            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Modo de Ajuste da Imagem na Vitrine:
              </span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="imageFit"
                    value="contain"
                    checked={formData.imageFit !== "cover"}
                    onChange={() => setFormData({ ...formData, imageFit: "contain" })}
                    className="text-indigo-600"
                  />
                  <span>Inteira (Sem cortes - Recomendado)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="imageFit"
                    value="cover"
                    checked={formData.imageFit === "cover"}
                    onChange={() => setFormData({ ...formData, imageFit: "cover" })}
                    className="text-indigo-600"
                  />
                  <span>Preencher área (Cover)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Dados do Autor / Professor (Especialmente para Livros) */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-500" />
                {isLivro ? "Dados do Autor / Professor da Faculdade" : "Docente / Professor Responsável"}
              </span>
              {isLivro && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                  Com foto do docente
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Nome do Autor / Professor *
                </label>
                <input
                  type="text"
                  value={formData.instructor || ""}
                  onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  placeholder="Ex: Dr. Pe. Reginaldo Marcolino"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Titulação / Mini-Biografia
                </label>
                <input
                  type="text"
                  value={formData.authorBio || ""}
                  onChange={(e) => setFormData({ ...formData, authorBio: e.target.value })}
                  placeholder="Ex: Doutor em Teologia Sistemática - PUC-SP, Diretor Geral FAJOPA"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Upload da Foto do Autor / Professor */}
            <ImageUploadField
              label="Foto do Autor / Professor (Upload ou Link)"
              helperText="Foto do docente exibida junto à obra e na ficha técnica do livro."
              value={formData.authorPhotoUrl || ""}
              onChange={(val) => setFormData({ ...formData, authorPhotoUrl: val })}
              previewAspect="circle"
              idPrefix="author-photo"
            />

            {/* Campos Específicos de Livros: Editora, Ano, Páginas, ISBN */}
            {isLivro && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Editora
                  </label>
                  <input
                    type="text"
                    value={formData.publisher || ""}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    placeholder="Ex: Editora Recriar"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Ano
                  </label>
                  <input
                    type="text"
                    value={formData.year || ""}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="Ex: 2024"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    Páginas
                  </label>
                  <input
                    type="text"
                    value={formData.pages || ""}
                    onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                    placeholder="Ex: 284 páginas"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                    ISBN (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.isbn || ""}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    placeholder="Ex: 978-65-..."
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preço e Opções de Parcelamento */}
          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Valores e Condições de Pagamento / Parcelamento
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                Destaque de parcelamento no card
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Preço à Vista / Valor Principal
                </label>
                <input
                  type="text"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Ex: R$ 68,00"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Condição de Parcelamento
                </label>
                <input
                  type="text"
                  value={formData.installments || ""}
                  onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                  placeholder="Ex: Em até 3x de R$ 22,66 sem juros"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold text-emerald-700 dark:text-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Link de Compra / Redirecionamento */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              {isLivro ? "Link de Compra / Editora / Encomenda *" : "Link de Redirecionamento (Hotmart / Inscrição) *"}
            </label>
            <input
              type="text"
              required
              value={formData.linkUrl || ""}
              onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
              placeholder={isLivro ? "https://editorarecriar.com/... ou link de compra do livro" : "https://hotmart.com/... ou link do curso"}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Descrição / Sinopse */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
              {isLivro ? "Sinopse e Apresentação da Obra" : "Descrição Completa"}
            </label>
            <textarea
              rows={3}
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={isLivro ? "Apresente a obra, sua relevância teológica ou pastoral e contexto de publicação..." : "Descreva os tópicos do curso, objetivos e metodologia..."}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 leading-relaxed"
            />
          </div>

          {/* Ordem e Carga Horária */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Ordem de Exibição na Vitrine
              </label>
              <input
                type="number"
                min={1}
                value={formData.order ?? 1}
                onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) || 1 })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
              />
            </div>

            {!isLivro && (
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Carga Horária (Para Cursos)
                </label>
                <input
                  type="text"
                  value={formData.workload || ""}
                  onChange={(e) => setFormData({ ...formData, workload: e.target.value })}
                  placeholder="Ex: 40 horas"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Destaque e Visibilidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Visível na Vitrine
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Exibe o item para estudantes e visitantes
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.featured)}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Item em Destaque
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Ganha destaque especial no topo
                </span>
              </div>
            </label>
          </div>

          {/* Parceria Diocesana (se aplicável) */}
          {formData.category === "parceria" && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isPartnershipDiocese)}
                  onChange={(e) => setFormData({ ...formData, isPartnershipDiocese: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span className="font-bold text-purple-900 dark:text-purple-200">
                  Parceria Diocesana (Assis e Lins)
                </span>
              </label>

              {formData.isPartnershipDiocese && (
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                    Nome das Dioceses
                  </label>
                  <input
                    type="text"
                    value={formData.diocesePartner || ""}
                    onChange={(e) => setFormData({ ...formData, diocesePartner: e.target.value })}
                    placeholder="Ex: Diocese de Assis e Diocese de Lins"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Ações do Modal */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isLivro ? "Salvar Livro" : "Salvar Curso"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
