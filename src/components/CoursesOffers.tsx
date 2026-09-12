import { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Sparkles,
  ExternalLink,
  Clock,
  User,
  Search,
  BookOpen,
  Landmark,
  Flame,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  RefreshCw,
  CreditCard,
  BookMarked,
} from "lucide-react";
import { CourseOffer } from "../types";
import { getCoursesList, subscribeToCourses } from "../lib/coursesService";
import Modal from "./Modal";
import { motion, AnimatePresence } from "motion/react";

interface CoursesOffersProps {
  onNavigateToStudent?: () => void;
  onNavigateToDiocese?: () => void;
}

export default function CoursesOffers({ onNavigateToStudent, onNavigateToDiocese }: CoursesOffersProps) {
  const [courses, setCourses] = useState<CourseOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourseModal, setSelectedCourseModal] = useState<CourseOffer | null>(null);

  const loadCourses = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const data = await getCoursesList(forceRefresh);
      setCourses(data);
    } catch (err) {
      console.error("Erro ao carregar cursos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    const unsub = subscribeToCourses((updated) => {
      setCourses(updated);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    return [
      { id: "all", label: "Todos", icon: Layers, count: courses.filter((c) => c.active !== false).length },
      { id: "livro", label: "Livros dos Docentes", icon: BookOpen, count: courses.filter((c) => c.category === "livro" && c.active !== false).length },
      { id: "hotmart", label: "Hotmart", icon: Flame, count: courses.filter((c) => c.category === "hotmart" && c.active !== false).length },
      { id: "parceria", label: "Parcerias Diocesanas", icon: Landmark, count: courses.filter((c) => c.category === "parceria" && c.active !== false).length },
      { id: "extensao", label: "Extensão Acadêmica", icon: GraduationCap, count: courses.filter((c) => c.category === "extensao" && c.active !== false).length },
    ];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (c.active === false) return false;
      if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(query) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(query)) ||
        c.description.toLowerCase().includes(query) ||
        (c.instructor && c.instructor.toLowerCase().includes(query)) ||
        (c.publisher && c.publisher.toLowerCase().includes(query)) ||
        (c.diocesePartner && c.diocesePartner.toLowerCase().includes(query))
      );
    });
  }, [courses, selectedCategory, searchQuery]);

  // Identifica o curso de parceria em destaque (Escola de Teologia Assis e Lins)
  const featuredPartnershipCourse = useMemo(() => {
    return courses.find((c) => c.isPartnershipDiocese && c.active !== false) || null;
  }, [courses]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-8">
      {/* Header Principal da Aba */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-sky-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-sky-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-400/15 border border-sky-400/30 text-sky-300 text-[11px] font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              Vitrine de Formação & Parcerias
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Cursos e Ofertas FAJOPA
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Explore nossas formações acadêmicas, cursos livres oficiais no Hotmart, extensões universitárias e programas diocesanos em parceria com as Dioceses de Assis e Lins.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => loadCourses(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-semibold flex items-center gap-1.5 border border-white/10"
              title="Atualizar lista de cursos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Destaque Especial: Parceria Diocese de Assis & Lins (Escola de Teologia) */}
      {featuredPartnershipCourse && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-2 border-sky-400/40 dark:border-sky-500/30 p-5 sm:p-7 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black uppercase tracking-wider">
                  <Landmark className="w-3.5 h-3.5" />
                  Parceria Oficial
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-[10px] font-bold">
                  {featuredPartnershipCourse.diocesePartner || "Diocese de Assis e Diocese de Lins"}
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {featuredPartnershipCourse.title}
                </h2>
                {featuredPartnershipCourse.subtitle && (
                  <p className="text-xs sm:text-sm font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                    {featuredPartnershipCourse.subtitle}
                  </p>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {featuredPartnershipCourse.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <span>{featuredPartnershipCourse.workload || "Encontros Semanais"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-500" />
                  <span>{featuredPartnershipCourse.instructor || "FAJOPA e Assessoria Diocesana"}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setSelectedCourseModal(featuredPartnershipCourse)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 transition-all"
              >
                <Info className="w-4 h-4" />
                Ver Detalhes do Curso
              </button>

              <a
                href={featuredPartnershipCourse.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-98 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <ExternalLink className="w-4 h-4 text-sky-400" />
                Sala Virtual (Classroom)
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Busca e Filtros de Categoria */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, tema, professor ou parceiro..."
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm transition-all"
          />
        </div>

        {/* Categorias / Filtros em Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isSelected
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
                <span>{cat.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade de Cursos e Produtos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 py-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/60 animate-pulse space-y-4"
            >
              <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            Nenhum curso encontrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Não encontramos resultados para sua pesquisa ou categoria selecionada. Tente outros termos ou limpe o filtro.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className="px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-all"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredCourses.map((course) => {
            const isHotmart = course.category === "hotmart";
            const isPartnership = course.category === "parceria";
            const isLivro = course.category === "livro";

            return (
              <div
                key={course.id}
                className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1"
              >
                {/* Imagem / Capa do Item (Exibição Sem Cortes) */}
                <div
                  className={`relative w-full overflow-hidden flex items-center justify-center ${
                    isLivro
                      ? "h-64 sm:h-72 p-4 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-100 dark:border-slate-700/50"
                      : course.imageFit === "contain"
                      ? "h-48 p-3 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-700/50"
                      : "h-48 bg-slate-100 dark:bg-slate-900"
                  }`}
                >
                  {course.imageUrl ? (
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      className={`${
                        isLivro || course.imageFit === "contain"
                          ? "max-h-full max-w-full object-contain rounded-lg shadow-md group-hover:scale-105 transition-transform duration-300"
                          : "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-sky-600 to-indigo-700 text-white">
                      {isLivro ? <BookOpen className="w-12 h-12 opacity-80" /> : <GraduationCap className="w-12 h-12 opacity-80" />}
                    </div>
                  )}

                  {/* Badges sobrepostos */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                    {course.tag && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md ${
                          isLivro
                            ? "bg-emerald-600/95 text-white"
                            : isHotmart
                            ? "bg-amber-500/95 text-white"
                            : isPartnership
                            ? "bg-purple-600/95 text-white"
                            : "bg-sky-600/95 text-white"
                        }`}
                      >
                        {course.tag}
                      </span>
                    )}
                  </div>

                  {course.price && (
                    <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl text-white text-[11px] font-black shadow-md border border-white/10 z-10">
                      {course.price}
                    </div>
                  )}
                </div>

                {/* Conteúdo do Card */}
                <div className="p-5 flex flex-col flex-grow justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-2">
                      {course.title}
                    </h3>

                    {/* Autor / Docente com foto */}
                    {course.instructor && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {course.authorPhotoUrl ? (
                          <img
                            src={course.authorPhotoUrl}
                            alt={course.instructor}
                            className="w-5 h-5 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center text-[10px] shrink-0">
                            <User className="w-3 h-3" />
                          </div>
                        )}
                        <span className="truncate">{course.instructor}</span>
                      </div>
                    )}

                    {course.subtitle && (
                      <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 line-clamp-1">
                        {course.subtitle}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {course.description}
                    </p>

                    {/* Metadados para Livros */}
                    {isLivro && (course.publisher || course.year || course.pages) && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                        {course.publisher && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                            {course.publisher}
                          </span>
                        )}
                        {course.year && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                            {course.year}
                          </span>
                        )}
                        {course.pages && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                            {course.pages}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Condições de Pagamento e Metadados */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex flex-col gap-1 text-[11px]">
                      {course.installments && (
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{course.installments}</span>
                        </div>
                      )}
                      {course.workload && !isLivro && (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{course.workload}</span>
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedCourseModal(course)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all text-center"
                      >
                        {isLivro ? "Ver Livro & Autor" : "Ver Detalhes"}
                      </button>

                      {isLivro ? (
                        <a
                          href={course.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Adquirir</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : isHotmart ? (
                        <a
                          href={course.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>Hotmart</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : isPartnership ? (
                        <a
                          href={course.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/20"
                        >
                          <span>Classroom</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <a
                          href={course.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5"
                        >
                          <span>Acessar</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal com Detalhes Completos */}
      <Modal
        isOpen={Boolean(selectedCourseModal)}
        onClose={() => setSelectedCourseModal(null)}
        title={selectedCourseModal?.title || "Detalhes"}
        maxWidth="max-w-2xl"
        hideFooter={true}
      >
        {selectedCourseModal && (
          <div className="space-y-5 text-slate-800 dark:text-slate-100 text-xs">
            {/* Imagem Completa no Modal (Sem Cortes) */}
            {selectedCourseModal.imageUrl && (
              <div
                className={`relative w-full rounded-2xl overflow-hidden shadow-inner flex items-center justify-center ${
                  selectedCourseModal.category === "livro"
                    ? "h-72 sm:h-80 p-4 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900"
                    : "h-56 p-3 bg-slate-100 dark:bg-slate-900"
                }`}
              >
                <img
                  src={selectedCourseModal.imageUrl}
                  alt={selectedCourseModal.title}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
                />
                {selectedCourseModal.tag && (
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-900/85 text-white backdrop-blur-md">
                    {selectedCourseModal.tag}
                  </span>
                )}
              </div>
            )}

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {selectedCourseModal.title}
              </h3>
              {selectedCourseModal.subtitle && (
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mt-1">
                  {selectedCourseModal.subtitle}
                </p>
              )}
            </div>

            {/* Ficha do Autor / Professor */}
            {selectedCourseModal.instructor && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-3.5">
                {selectedCourseModal.authorPhotoUrl ? (
                  <img
                    src={selectedCourseModal.authorPhotoUrl}
                    alt={selectedCourseModal.instructor}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-200 dark:border-indigo-700 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                )}

                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {selectedCourseModal.category === "livro" ? "Autor / Docente da Faculdade" : "Docente / Instrutor"}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedCourseModal.instructor}
                  </div>
                  {selectedCourseModal.authorBio && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {selectedCourseModal.authorBio}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Informações de Investimento e Parcelamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                  Investimento / Valor
                </span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {selectedCourseModal.price || "Consulte"}
                </span>
              </div>

              {selectedCourseModal.installments && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Condição de Pagamento
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <CreditCard className="w-4 h-4 shrink-0" />
                    {selectedCourseModal.installments}
                  </span>
                </div>
              )}

              {selectedCourseModal.workload && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Carga Horária
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {selectedCourseModal.workload}
                  </span>
                </div>
              )}

              {selectedCourseModal.diocesePartner && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                    Dioceses Parceiras
                  </span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {selectedCourseModal.diocesePartner}
                  </span>
                </div>
              )}
            </div>

            {/* Ficha Técnica de Livro */}
            {selectedCourseModal.category === "livro" && (selectedCourseModal.publisher || selectedCourseModal.year || selectedCourseModal.pages || selectedCourseModal.isbn) && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <BookMarked className="w-4 h-4 text-emerald-600" />
                  <span>Ficha Técnica da Publicação</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600 dark:text-slate-300">
                  {selectedCourseModal.publisher && (
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Editora</span>
                      <span className="font-semibold">{selectedCourseModal.publisher}</span>
                    </div>
                  )}
                  {selectedCourseModal.year && (
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Ano</span>
                      <span className="font-semibold">{selectedCourseModal.year}</span>
                    </div>
                  )}
                  {selectedCourseModal.pages && (
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Páginas</span>
                      <span className="font-semibold">{selectedCourseModal.pages}</span>
                    </div>
                  )}
                  {selectedCourseModal.isbn && (
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">ISBN</span>
                      <span className="font-semibold">{selectedCourseModal.isbn}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Descrição / Sinopse */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {selectedCourseModal.category === "livro" ? "Sinopse e Apresentação da Obra" : "Sobre a Formação"}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedCourseModal.description}
              </p>
            </div>

            {selectedCourseModal.isPartnershipDiocese && (
              <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ambiente Exclusivo da Turma Diocesana</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Os alunos matriculados na Escola de Teologia têm acesso direto às aulas gravadas no Google Classroom.
                </p>
              </div>
            )}

            <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
              <a
                href={selectedCourseModal.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 py-3 px-4 rounded-xl text-center text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                  selectedCourseModal.category === "livro"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : selectedCourseModal.category === "hotmart"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-orange-500/20"
                    : "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20"
                }`}
              >
                <span>
                  {selectedCourseModal.category === "livro"
                    ? "Adquirir Exemplar do Livro"
                    : selectedCourseModal.category === "hotmart"
                    ? "Inscrever-se no Hotmart"
                    : selectedCourseModal.category === "parceria"
                    ? "Acessar Sala do Google Classroom"
                    : "Acessar Página do Curso"}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setSelectedCourseModal(null)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
