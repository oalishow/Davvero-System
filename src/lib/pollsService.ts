import { db, appId } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction
} from "firebase/firestore";
import type { Poll, PollOption, PollVote } from "../types";

const POLLS_COLLECTION = `artifacts/${appId}/public/data/polls`;
const VOTES_COLLECTION = `artifacts/${appId}/public/data/poll_votes`;

/**
 * Retorna os IDs das opções votadas salvas no localStorage
 */
export function getStoredVotes(pollId: string): string[] {
  try {
    const raw = localStorage.getItem(`davvero_poll_voted_${pollId}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [raw];
    } catch {
      return [raw];
    }
  } catch {
    return [];
  }
}

export function getStoredVote(pollId: string): string | null {
  const list = getStoredVotes(pollId);
  return list.length > 0 ? list[0] : null;
}

/**
 * Salva a escolha do usuário no localStorage
 */
export function setStoredVotes(pollId: string, optionIds: string[] | string): void {
  try {
    const val = Array.isArray(optionIds) ? JSON.stringify(optionIds) : JSON.stringify([optionIds]);
    localStorage.setItem(`davvero_poll_voted_${pollId}`, val);
  } catch {
    // Ignorar falha de quota
  }
}

export function setStoredVote(pollId: string, optionId: string): void {
  setStoredVotes(pollId, [optionId]);
}

/**
 * Escuta em tempo real as enquetes ativas
 */
const DEFAULT_POLL_ID = "poll_davvero_default_experience";

export function subscribeActivePolls(callback: (polls: Poll[]) => void): () => void {
  try {
    const q = query(
      collection(db, POLLS_COLLECTION),
      where("active", "==", true)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const pollsMap = new Map<string, Poll>();
        snapshot.docs.forEach((d) => {
          const poll = {
            id: d.id,
            ...(d.data() as Omit<Poll, "id">),
          };
          // Evita duplicatas com o mesmo título ou id
          const existingKey = poll.title?.trim().toLowerCase() || poll.id;
          if (!pollsMap.has(existingKey)) {
            pollsMap.set(existingKey, poll);
          }
        });
        const polls = Array.from(pollsMap.values());
        // Ordena pela data de criação decrescente
        polls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        callback(polls);
      },
      (error) => {
        console.warn("[PollsService] Erro ao carregar enquetes ativas:", error);
        callback([]);
      }
    );
  } catch (err) {
    console.error("[PollsService] Erro de inicialização:", err);
    return () => {};
  }
}

/**
 * Escuta todas as enquetes para o painel de administração
 */
export function subscribeAllPolls(callback: (polls: Poll[]) => void): () => void {
  try {
    const q = query(collection(db, POLLS_COLLECTION));

    return onSnapshot(
      q,
      (snapshot) => {
        const pollsMap = new Map<string, Poll>();
        snapshot.docs.forEach((d) => {
          const poll = {
            id: d.id,
            ...(d.data() as Omit<Poll, "id">),
          };
          const existingKey = poll.title?.trim().toLowerCase() || poll.id;
          if (!pollsMap.has(existingKey)) {
            pollsMap.set(existingKey, poll);
          }
        });
        const polls = Array.from(pollsMap.values());
        polls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        callback(polls);
      },
      (error) => {
        console.warn("[PollsService] Erro ao carregar todas as enquetes:", error);
        callback([]);
      }
    );
  } catch (err) {
    console.error("[PollsService] Erro de inicialização:", err);
    return () => {};
  }
}

/**
 * Registra voto(s) na enquete (suporta opção única ou múltipla escolha)
 */
export async function submitVote(
  pollId: string,
  optionIds: string | string[],
  voterInfo: {
    voterId?: string;
    voterName?: string;
    isAnonymous?: boolean;
    feedback?: string;
    rating?: number;
  } = {}
): Promise<{ success: boolean; message?: string }> {
  try {
    const selectedOptionIds = Array.isArray(optionIds) ? optionIds : [optionIds];
    if (selectedOptionIds.length === 0) {
      return { success: false, message: "Nenhuma opção selecionada." };
    }

    const pollRef = doc(db, POLLS_COLLECTION, pollId);

    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);
      if (!pollSnap.exists()) {
        throw new Error("Enquete não encontrada");
      }

      const pollData = pollSnap.data() as Poll;
      if (!pollData.active) {
        throw new Error("Esta enquete já foi encerrada");
      }

      // Verifica expiração por duração
      if (pollData.expiresAt && new Date(pollData.expiresAt).getTime() <= Date.now()) {
        throw new Error("O prazo de votação desta enquete expirou");
      }

      const previousVoteOptionIds = getStoredVotes(pollId);

      const updatedOptions = (pollData.options || []).map((opt) => {
        let newCount = opt.votesCount || 0;
        // Se já havia votado nesta opção anteriormente e agora não está nela, subtrai
        if (previousVoteOptionIds.includes(opt.id) && !selectedOptionIds.includes(opt.id)) {
          newCount = Math.max(0, newCount - 1);
        }
        // Se é uma opção recém selecionada
        if (selectedOptionIds.includes(opt.id) && !previousVoteOptionIds.includes(opt.id)) {
          newCount += 1;
        }
        return {
          ...opt,
          votesCount: newCount,
        };
      });

      const newTotalVotes = updatedOptions.reduce((acc, curr) => acc + (curr.votesCount || 0), 0);

      const updatePayload: Record<string, any> = {
        options: updatedOptions,
        totalVotes: newTotalVotes,
      };

      const voterDisplayName = voterInfo.isAnonymous
        ? "Anônimo"
        : (voterInfo.voterName?.trim() || "Anônimo");

      // Se enviou feedback opcional, armazena no histórico da enquete
      if (voterInfo.feedback && voterInfo.feedback.trim()) {
        const selectedOptNames = updatedOptions
          .filter((o) => selectedOptionIds.includes(o.id))
          .map((o) => o.text)
          .join(", ");

        const existingFeedbacks = pollData.feedbacks || [];
        const newFeedbackEntry = {
          id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          voterName: voterDisplayName,
          optionText: selectedOptNames || "Opções selecionadas",
          feedback: voterInfo.feedback.trim(),
          rating: voterInfo.rating || 5,
          timestamp: new Date().toISOString(),
        };
        // Guarda até 150 feedbacks por enquete para não ultrapassar limites
        updatePayload.feedbacks = [newFeedbackEntry, ...existingFeedbacks].slice(0, 150);
      }

      transaction.update(pollRef, updatePayload);
    });

    // Salva localmente
    setStoredVotes(pollId, selectedOptionIds);

    // Opcional: salva na coleção de votos auditados
    const voteRef = doc(
      db,
      VOTES_COLLECTION,
      `${pollId}_${voterInfo.voterId || "guest"}_${Date.now()}`
    );
    await setDoc(voteRef, {
      pollId,
      optionId: selectedOptionIds[0],
      optionIds: selectedOptionIds,
      voterId: voterInfo.voterId || "guest",
      voterName: voterInfo.isAnonymous ? "Anônimo" : (voterInfo.voterName || "Anônimo"),
      isAnonymous: !!voterInfo.isAnonymous,
      feedback: voterInfo.feedback || "",
      rating: voterInfo.rating || null,
      timestamp: new Date().toISOString(),
    }).catch((e) => console.warn("Notice saving audit vote:", e));

    return { success: true };
  } catch (err: any) {
    console.error("[PollsService] Erro ao votar:", err);
    return { success: false, message: err?.message || "Erro ao registrar voto" };
  }
}

/**
 * Cria uma nova enquete
 */
export async function createPoll(
  pollData: Omit<Poll, "id" | "createdAt" | "totalVotes">
): Promise<string> {
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const pollRef = doc(db, POLLS_COLLECTION, pollId);

  const newPoll: Poll = {
    ...pollData,
    id: pollId,
    totalVotes: 0,
    createdAt: new Date().toISOString(),
    feedbacks: [],
  };

  await setDoc(pollRef, newPoll);
  return pollId;
}

/**
 * Atualiza propriedades de uma enquete
 */
export async function updatePoll(pollId: string, updates: Partial<Poll>): Promise<void> {
  const pollRef = doc(db, POLLS_COLLECTION, pollId);
  await updateDoc(pollRef, updates);
}

/**
 * Deleta uma enquete
 */
export async function deletePoll(pollId: string): Promise<void> {
  const pollRef = doc(db, POLLS_COLLECTION, pollId);
  await deleteDoc(pollRef);
}

/**
 * Reseta contagem de votos de uma enquete
 */
export async function resetPollVotes(pollId: string): Promise<void> {
  const pollRef = doc(db, POLLS_COLLECTION, pollId);
  const snap = await getDoc(pollRef);
  if (!snap.exists()) return;
  const data = snap.data() as Poll;
  const resetOptions = (data.options || []).map((o) => ({ ...o, votesCount: 0 }));
  await updateDoc(pollRef, {
    options: resetOptions,
    totalVotes: 0,
    feedbacks: [],
  });
}

/**
 * Garante que existe apenas uma enquete inicial de experiência do Davvero e limpa duplicatas
 */
export async function ensureDefaultDavveroPoll(): Promise<void> {
  try {
    const q = query(collection(db, POLLS_COLLECTION));
    const snap = await getDocs(q);

    // Identifica enquetes padrão de experiência
    const defaultPolls = snap.docs.filter((d) => {
      const data = d.data() as Poll;
      const title = (data.title || "").toLowerCase();
      return (
        d.id === DEFAULT_POLL_ID ||
        data.category === "davvero_experience" ||
        title.includes("sua experiência utilizando o davvero") ||
        title.includes("experiencia utilizando o davvero")
      );
    });

    if (defaultPolls.length === 0) {
      const defaultPoll: Poll = {
        id: DEFAULT_POLL_ID,
        title: "Como está sendo sua experiência utilizando o Davvero?",
        description:
          "Sua opinião é fundamental para aprimorarmos continuamente nossa plataforma acadêmica, litúrgica e formativa.",
        category: "davvero_experience",
        active: true,
        allowFeedback: true,
        feedbackPlaceholder: "Conte-nos o que você mais gostou ou o que podemos melhorar no Davvero...",
        options: [
          { id: "opt_1", text: "🌟 Excelente! Prático, moderno e muito ágil", votesCount: 0, color: "#10b981" },
          { id: "opt_2", text: "👍 Muito boa! Facilitou minha rotina e eventos", votesCount: 0, color: "#0ea5e9" },
          { id: "opt_3", text: "💡 Boa, mas gostaria de novos recursos", votesCount: 0, color: "#f59e0b" },
          { id: "opt_4", text: "🔧 Regular / Encontrei algumas dificuldades", votesCount: 0, color: "#64748b" },
        ],
        totalVotes: 0,
        createdAt: new Date().toISOString(),
        feedbacks: [],
      };
      await setDoc(doc(db, POLLS_COLLECTION, DEFAULT_POLL_ID), defaultPoll);
      console.log("[PollsService] Enquete padrão do Davvero criada com sucesso.");
    } else if (defaultPolls.length > 1) {
      // Duplicatas detectadas! Preserva a enquete com mais votos e remove o excesso
      console.log(`[PollsService] ${defaultPolls.length} duplicatas de enquete detectadas. Limpando...`);
      defaultPolls.sort((a, b) => {
        const votesA = (a.data() as Poll).totalVotes || 0;
        const votesB = (b.data() as Poll).totalVotes || 0;
        return votesB - votesA;
      });

      // Mantém a primeira e exclui as outras
      const duplicatesToDelete = defaultPolls.slice(1);
      for (const dup of duplicatesToDelete) {
        try {
          await deleteDoc(doc(db, POLLS_COLLECTION, dup.id));
          console.log(`[PollsService] Duplicata removida: ${dup.id}`);
        } catch (delErr) {
          console.warn("[PollsService] Erro ao remover duplicata:", delErr);
        }
      }
    }
  } catch (err) {
    console.warn("[PollsService] Verificação da enquete padrão falhou:", err);
  }
}
