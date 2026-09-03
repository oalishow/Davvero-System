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
 * Retorna a chave do voto salvo no localStorage para evitar votos duplicados no dispositivo
 */
export function getStoredVote(pollId: string): string | null {
  try {
    return localStorage.getItem(`davvero_poll_voted_${pollId}`);
  } catch {
    return null;
  }
}

/**
 * Salva a escolha do usuário no localStorage
 */
export function setStoredVote(pollId: string, optionId: string): void {
  try {
    localStorage.setItem(`davvero_poll_voted_${pollId}`, optionId);
  } catch {
    // Ignorar falha de quota
  }
}

/**
 * Escuta em tempo real as enquetes ativas
 */
export function subscribeActivePolls(callback: (polls: Poll[]) => void): () => void {
  try {
    const q = query(
      collection(db, POLLS_COLLECTION),
      where("active", "==", true)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const polls: Poll[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Poll, "id">),
        }));
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
    const colRef = collection(db, POLLS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const polls: Poll[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Poll, "id">),
        }));
        polls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        callback(polls);
      },
      (error) => {
        console.warn("[PollsService] Erro ao carregar todas as enquetes:", error);
        callback([]);
      }
    );
  } catch (err) {
    console.error("[PollsService] Erro ao buscar todas as enquetes:", err);
    return () => {};
  }
}

/**
 * Registra um voto na enquete
 */
export async function submitVote(
  pollId: string,
  optionId: string,
  voterInfo: {
    voterId?: string;
    voterName?: string;
    feedback?: string;
    rating?: number;
  } = {}
): Promise<{ success: boolean; message?: string }> {
  try {
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

      const previousVoteOptionId = getStoredVote(pollId);

      const updatedOptions = (pollData.options || []).map((opt) => {
        let newCount = opt.votesCount || 0;
        // Se o usuário está alterando o voto anterior
        if (previousVoteOptionId && opt.id === previousVoteOptionId && opt.id !== optionId) {
          newCount = Math.max(0, newCount - 1);
        }
        if (opt.id === optionId) {
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

      // Se enviou feedback opcional, armazena no histórico da enquete
      if (voterInfo.feedback && voterInfo.feedback.trim()) {
        const selectedOpt = updatedOptions.find((o) => o.id === optionId);
        const existingFeedbacks = pollData.feedbacks || [];
        const newFeedbackEntry = {
          id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          voterName: voterInfo.voterName?.trim() || "Anônimo",
          optionText: selectedOpt?.text || "Opção selecionada",
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
    setStoredVote(pollId, optionId);

    // Opcional: salva na coleção de votos auditados
    const voteRef = doc(
      db,
      VOTES_COLLECTION,
      `${pollId}_${voterInfo.voterId || "guest"}_${Date.now()}`
    );
    await setDoc(voteRef, {
      pollId,
      optionId,
      voterId: voterInfo.voterId || "guest",
      voterName: voterInfo.voterName || "Anônimo",
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
 * Garante que existe pelo menos a enquete inicial de experiência do Davvero
 */
export async function ensureDefaultDavveroPoll(): Promise<void> {
  try {
    const q = query(collection(db, POLLS_COLLECTION));
    const snap = await getDocs(q);

    if (snap.empty) {
      const defaultPoll: Omit<Poll, "id" | "createdAt" | "totalVotes"> = {
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
      };
      await createPoll(defaultPoll);
      console.log("[PollsService] Enquete padrão do Davvero criada com sucesso.");
    }
  } catch (err) {
    console.warn("[PollsService] Verificação da enquete padrão falhou:", err);
  }
}
