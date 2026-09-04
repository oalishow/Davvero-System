import React, { useState, useEffect } from "react";
import {
  Vote,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Star,
  Calendar,
  Sparkles,
  X,
} from "lucide-react";
import type { Poll, PollOption } from "../types";
import {
  subscribeAllPolls,
  createPoll,
  updatePoll,
  deletePoll,
  resetPollVotes,
  ensureDefaultDavveroPoll,
} from "../lib/pollsService";
import { useDialog } from "../context/DialogContext";

export default function AdminPolls() {
  const { showAlert, showConfirm } = useDialog();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPollFeedbacks, setSelectedPollFeedbacks] = useState<Poll | null>(null);

  // New Poll Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<"davvero_experience" | "general" | "features" | "seminary">("davvero_experience");
  const [newAllowFeedback, setNewAllowFeedback] = useState(true);
  const [newOptions, setNewOptions] = useState<string[]>([
    "🌟 Excelente! Muito prático e ágil",
    "👍 Muito boa experiência",
    "💡 Boa, mas pode melhorar",
    "🔧 Regular / Precisa de ajustes",
  ]);

  useEffect(() => {
    ensureDefaultDavveroPoll();

    const unsubscribe = subscribeAllPolls((data) => {
      setPolls(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddOption = () => {
    setNewOptions([...newOptions, `Opção ${newOptions.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (newOptions.length <= 2) {
      showAlert("A enquete precisa ter pelo menos 2 opções de resposta.", { type: "warning" });
      return;
    }
    setNewOptions(newOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...newOptions];
    updated[index] = val;
    setNewOptions(updated);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showAlert("Informe o título ou pergunta da enquete.", { type: "warning" });
      return;
    }

    const validOptions = newOptions.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      showAlert("Adicione pelo menos 2 opções de resposta válidas.", { type: "warning" });
      return;
    }

    const defaultColors = ["#10b981", "#0ea5e9", "#f59e0b", "#64748b", "#8b5cf6", "#ec4899"];

    const formattedOptions: PollOption[] = validOptions.map((text, idx) => ({
      id: `opt_${Date.now()}_${idx}`,
      text,
      votesCount: 0,
      color: defaultColors[idx % defaultColors.length],
    }));

    try {
      await createPoll({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
        active: true,
        allowFeedback: newAllowFeedback,
        feedbackPlaceholder: "Deixe um comentário sobre sua avaliação...",
        options: formattedOptions,
      });

      showAlert("Enquete criada e publicada com sucesso!", { type: "success" });
      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewOptions([
        "🌟 Excelente!",
        "👍 Boa",
        "💡 Regular",
        "🔧 Precisa melhorar",
      ]);
    } catch {
      showAlert("Erro ao criar enquete.", { type: "error" });
    }
  };

  const handleToggleActive = async (poll: Poll) => {
    try {
      await updatePoll(poll.id, { active: !poll.active });
      showAlert(
        `Enquete ${!poll.active ? "ativada" : "desativada"} com sucesso!`,
        { type: "success" }
      );
    } catch {
      showAlert("Erro ao alterar status da enquete.", { type: "error" });
    }
  };

  const handleResetVotes = async (pollId: string) => {
    const confirmed = await showConfirm(
      "Deseja realmente zerar todos os votos desta enquete?",
      { type: "warning" }
    );
    if (!confirmed) return;

    try {
      await resetPollVotes(pollId);
      showAlert("Contagem de votos zerada com sucesso!", { type: "success" });
    } catch {
      showAlert("Erro ao zerar votos.", { type: "error" });
    }
  };

  const handleDelete = async (pollId: string) => {
    const confirmed = await showConfirm(
      "Deseja excluir permanentemente esta enquete?",
      { type: "error" }
    );
    if (!confirmed) return;

    try {
      await deletePoll(pollId);
      showAlert("Enquete removida com sucesso.", { type: "success" });
    } catch {
      showAlert("Erro ao remover enquete.", { type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500 text-white">
              <Vote className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Gerenciamento de Enquetes e Votações
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Crie enquetes para a página inicial, acompanhe a experiência dos usuários no Davvero e visualize comentários e feedbacks em tempo real.
          </p>
        </div>

        <button
          id="btn-admin-new-poll"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nova Enquete
        </button>
      </div>

      {/* Polls List */}
      {loading ? (
        <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
          Carregando enquetes...
        </div>
      ) : polls.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Vote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            Nenhuma enquete cadastrada no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {polls.map((poll) => {
            const total = poll.totalVotes || 0;
            const feedbacksCount = poll.feedbacks?.length || 0;

            return (
              <div
                key={poll.id}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5"
              >
                {/* Header da Enquete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                          poll.active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {poll.active ? "Ativa na Página Inicial" : "Inativa"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Criada em {new Date(poll.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                        {poll.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleActive(poll)}
                      className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        poll.active
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                      title={poll.active ? "Desativar" : "Ativar"}
                    >
                      {poll.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span className="hidden sm:inline">
                        {poll.active ? "Desativar" : "Ativar"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleResetVotes(poll.id)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Zerar votos"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(poll.id)}
                      className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Excluir enquete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Resultados por Opção */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Opções de Voto</span>
                    <span>
                      Total: {total} {total === 1 ? "voto" : "votos"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {poll.options.map((option) => {
                      const count = option.votesCount || 0;
                      const percent = total > 0 ? Math.round((count / total) * 100) : 0;

                      return (
                        <div
                          key={option.id}
                          className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 relative overflow-hidden"
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-sky-500/15 dark:bg-sky-500/20 rounded-2xl pointer-events-none transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                          <div className="relative z-10 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {option.text}
                            </span>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-slate-900 dark:text-white block">
                                {percent}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {count} {count === 1 ? "voto" : "votos"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Comentários / Feedbacks */}
                {feedbacksCount > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5 font-bold">
                      <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                      {feedbacksCount} comentários / avaliações recebidas
                    </span>
                    <button
                      onClick={() => setSelectedPollFeedbacks(poll)}
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Ver Comentários
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Enquete */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-sky-500" />
                Criar Nova Enquete
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Pergunta da Enquete
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Como está sendo sua experiência utilizando o Davvero?"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold outline-none focus:ring-2 focus:ring-sky-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Descrição ou Orientações (Opcional)
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: Sua opinião é fundamental para aprimorarmos continuamente nossa plataforma acadêmica e formativa."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
                />
              </div>

              {/* Opções */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Opções de Resposta
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-500 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Opção
                  </button>
                </div>

                {newOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Opção ${idx + 1}`}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover opção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Permite feedback escrito */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-allow-feedback"
                  checked={newAllowFeedback}
                  onChange={(e) => setNewAllowFeedback(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <label
                  htmlFor="chk-allow-feedback"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Permitir comentários/sugestões escritas após o voto
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Publicar Enquete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualizar Feedbacks/Comentários */}
      {selectedPollFeedbacks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-sky-500" />
                  Comentários e Feedbacks
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-md">
                  {selectedPollFeedbacks.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedPollFeedbacks(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(!selectedPollFeedbacks.feedbacks || selectedPollFeedbacks.feedbacks.length === 0) ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  Nenhum comentário recebido ainda.
                </p>
              ) : (
                selectedPollFeedbacks.feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {fb.voterName || "Anônimo"}
                      </span>
                      <div className="flex items-center gap-2">
                        {fb.rating && (
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= (fb.rating || 5)
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-slate-300 dark:text-slate-600"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {new Date(fb.timestamp).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <span className="inline-block text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100/60 dark:bg-sky-950/60 px-2 py-0.5 rounded">
                      Votou: {fb.optionText}
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">
                      &quot;{fb.feedback}&quot;
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
