import React, { useState, useEffect } from "react";
import {
  Vote,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Star,
  Send,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Poll, PollOption } from "../types";
import {
  subscribeActivePolls,
  submitVote,
  getStoredVote,
  ensureDefaultDavveroPoll,
} from "../lib/pollsService";
import { useDialog } from "../context/DialogContext";

interface HomePollsWidgetProps {
  currentMemberName?: string;
  currentMemberId?: string;
}

export default function HomePollsWidget({
  currentMemberName,
  currentMemberId,
}: HomePollsWidgetProps) {
  const { showAlert } = useDialog();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Estado para feedback por enquete
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Garante a enquete padrão de experiência do Davvero
    ensureDefaultDavveroPoll();

    const unsubscribe = subscribeActivePolls((activePolls) => {
      setPolls(activePolls);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || polls.length === 0) {
    return null;
  }

  // Pega a primeira enquete ativa (geralmente a mais recente / de experiência)
  const poll = polls[0];
  const userVotedOptionId = getStoredVote(poll.id);
  const totalVotes = poll.totalVotes || 0;

  const handleSelectOption = async (option: PollOption) => {
    setVotingId(option.id);
    try {
      const res = await submitVote(poll.id, option.id, {
        voterId: currentMemberId,
        voterName: currentMemberName || "Usuário do Davvero",
        rating: feedbackRating,
      });

      if (res.success) {
        showAlert("Voto registrado com sucesso! Obrigado pela participação.", "success");
      } else {
        showAlert(res.message || "Erro ao registrar voto", "error");
      }
    } catch (e: any) {
      showAlert("Não foi possível registrar o voto.", "error");
    } finally {
      setVotingId(null);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      showAlert("Por favor, escreva uma mensagem antes de enviar.", "warning");
      return;
    }

    if (!userVotedOptionId) {
      showAlert("Por favor, selecione uma opção de voto antes de enviar seu comentário.", "warning");
      return;
    }

    try {
      await submitVote(poll.id, userVotedOptionId, {
        voterId: currentMemberId,
        voterName: currentMemberName || "Usuário do Davvero",
        feedback: feedbackText.trim(),
        rating: feedbackRating,
      });

      setFeedbackSubmitted((prev) => ({ ...prev, [poll.id]: true }));
      setFeedbackText("");
      showAlert("Seu comentário foi enviado com sucesso! Agradecemos o feedback.", "success");
    } catch {
      showAlert("Erro ao enviar comentário.", "error");
    }
  };

  return (
    <div
      id="home-polls-widget"
      className="w-full bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800 rounded-3xl border border-sky-100/80 dark:border-slate-800 shadow-sm overflow-hidden mb-6 transition-all"
    >
      {/* Top Banner / Header */}
      <div className="px-5 py-4 sm:px-6 flex items-center justify-between border-b border-sky-100/60 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 bg-sky-100/70 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-500" /> Enquete Oficial
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {totalVotes} {totalVotes === 1 ? "voto computado" : "votos computados"}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {poll.title}
            </h3>
          </div>
        </div>

        <button
          id="btn-toggle-poll-collapse"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={isCollapsed ? "Expandir enquete" : "Recolher enquete"}
        >
          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="p-5 sm:p-6 space-y-4"
          >
            {poll.description && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                {poll.description}
              </p>
            )}

            {/* Options List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {poll.options.map((option) => {
                const isSelected = userVotedOptionId === option.id;
                const percent =
                  totalVotes > 0
                    ? Math.round(((option.votesCount || 0) / totalVotes) * 100)
                    : 0;
                const isPending = votingId === option.id;

                return (
                  <button
                    key={option.id}
                    id={`btn-poll-opt-${option.id}`}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSelectOption(option)}
                    className={`relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[76px] ${
                      isSelected
                        ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 shadow-sm ring-2 ring-sky-500/20"
                        : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-sky-300 dark:hover:border-slate-600 hover:bg-slate-50/60 dark:hover:bg-slate-800"
                    }`}
                  >
                    {/* Background Progress Bar */}
                    {totalVotes > 0 && (
                      <div
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out opacity-20 pointer-events-none ${
                          isSelected
                            ? "bg-sky-500"
                            : option.color
                            ? ""
                            : "bg-slate-400 dark:bg-slate-600"
                        }`}
                        style={{
                          width: `${percent}%`,
                          backgroundColor: isSelected ? undefined : option.color || undefined,
                        }}
                      />
                    )}

                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "border-sky-500 bg-sky-500 text-white"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span
                          className={`text-xs sm:text-sm font-bold leading-tight ${
                            isSelected
                              ? "text-sky-950 dark:text-sky-200"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {option.text}
                        </span>
                      </div>

                      {isSelected && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Seu voto
                        </span>
                      )}
                    </div>

                    {/* Footer com contagem de votos e percentual */}
                    <div className="relative z-10 flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/40 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>
                        {option.votesCount || 0}{" "}
                        {(option.votesCount || 0) === 1 ? "voto" : "votos"}
                      </span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {percent}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Área de Comentários / Avaliação detalhada sobre o Davvero */}
            {poll.allowFeedback && userVotedOptionId && (
              <div className="pt-3 border-t border-sky-100/70 dark:border-slate-800/80">
                {feedbackSubmitted[poll.id] ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Sua mensagem e avaliação sobre o Davvero foram registradas com sucesso!</span>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                        <span>Deixe seu depoimento ou sugestão sobre o Davvero</span>
                      </div>

                      {/* Estrelas de Satisfação */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Nota:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackRating(star)}
                            className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                star <= feedbackRating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-300 dark:text-slate-600"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      id="input-poll-feedback"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={
                        poll.feedbackPlaceholder ||
                        "Conte-nos o que você mais gostou ou o que podemos aprimorar na sua experiência no Davvero..."
                      }
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
                    />

                    <div className="flex justify-end">
                      <button
                        id="btn-submit-poll-feedback"
                        type="button"
                        onClick={handleSendFeedback}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Sugestão</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
