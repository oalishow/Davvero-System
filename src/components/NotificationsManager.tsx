import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Wand2,
  X,
  Bell,
  BellOff,
  Users,
  User,
  Globe,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import { createNotification, db, appId } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useDialog } from "../context/DialogContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import type { Member } from "../types";

const NOTIFICATION_TEMPLATES = [
  {
    label: "Nova Atualização",
    title: "Novidades Chegaram! 🚀",
    message: "Uma nova versão do sistema está disponível! Confira os novos recursos e melhorias no aplicativo.",
    type: "sistema",
  },
  {
    label: "Aviso de Evento",
    title: "Lembrete: Próximo Evento",
    message: "Atenção: Nosso próximo encontro já tem data e hora! Verifique os detalhes na aba 'Eventos' e confirme sua presença.",
    type: "evento",
  },
  {
    label: "Recesso/Feriado",
    title: "Aviso de Recesso 🏖️",
    message: "Informamos que entraremos em recesso nos próximos dias. Organize-se e aproveite o descanso merecido!",
    type: "sistema",
  },
  {
    label: "Prazo de Inscrição",
    title: "Últimos dias para inscrição! ⏳",
    message: "Não fique de fora! O prazo para as inscrições está se encerrando em breve. Acesse o sistema e garanta sua vaga.",
    type: "inscricao",
  },
  {
    label: "Certificados Prontos",
    title: "Certificados Disponíveis 🎓",
    message: "Boas notícias: seus certificados de participação já estão disponíveis para emissão e download no painel do aluno.",
    type: "certificado",
  },
  {
    label: "Boas-vindas",
    title: "Bem-vindo ao Novo Semestre! 🎉",
    message: "Estamos felizes em tê-lo conosco! Explore as novidades do portal e tenha um excelente período letivo.",
    type: "sistema",
  },
];

export default function NotificationsManager() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<any>("sistema");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [promptAi, setPromptAi] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testingLocal, setTestingLocal] = useState(false);

  const [audienceMode, setAudienceMode] = useState<"todos" | "grupo" | "individual">("todos");
  const [selectedGroup, setSelectedGroup] = useState<string>("alunos");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const { showAlert } = useDialog();
  const {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    isDiagnosing,
    lastError,
    diagnosticLogs,
    subscribe,
    unsubscribe,
    runDiagnostics,
    sendLocalTestNotification,
    sendServerTestPush,
  } = usePushNotifications();

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member));
        setMembers(data);
      } catch (err) {
        console.error("Erro ao carregar membros:", err);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, []);

  const handleToggleSubscription = async () => {
    if (subscription) {
      const ok = await unsubscribe();
      if (ok) {
        showAlert("Notificações desativadas para este dispositivo.", { type: "info" });
      }
    } else {
      const sub = await subscribe();
      if (sub) {
        showAlert("Notificações ativadas com sucesso neste dispositivo!", { type: "success" });
      }
    }
  };

  const handleSendNotification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showAlert("Preencha o título e a mensagem da notificação.", { type: "error" });
      return;
    }

    if (audienceMode === "individual" && !selectedUserId) {
      showAlert("Por favor, selecione um usuário membro para enviar.", { type: "warning" });
      return;
    }

    setSending(true);
    try {
      // 1. Target determination
      let targetMemberIds: string[] = [];
      let targetLabel = "todos";

      if (audienceMode === "todos") {
        targetMemberIds = ["todos"];
      } else if (audienceMode === "individual") {
        targetMemberIds = [selectedUserId];
        const m = members.find((x) => x.id === selectedUserId);
        targetLabel = m ? m.name : "Usuário Específico";
      } else if (audienceMode === "grupo") {
        targetLabel = selectedGroup === "alunos" ? "Alunos e Seminaristas" : "Visitantes";
        let filtered = members;
        if (selectedGroup === "alunos") {
          filtered = members.filter((m) => !m.roles?.includes("VISITANTE") && Object.keys(m).length > 2);
        } else if (selectedGroup === "visitantes") {
          filtered = members.filter((m) => !!m.roles?.includes("VISITANTE"));
        }
        targetMemberIds = filtered.map((m) => m.id);

        if (targetMemberIds.length === 0) {
          showAlert("Não há usuários cadastrados neste grupo.", { type: "warning" });
          setSending(false);
          return;
        }
      }

      // 2. In-App notifications via Firestore
      if (audienceMode === "todos") {
        await createNotification({ recipientId: "todos", title, message, type });
      } else {
        await Promise.all(
          targetMemberIds.map((uid) => createNotification({ recipientId: uid, title, message, type }))
        );
      }

      // 3. Collect WebPush subscriptions from Firestore
      const targetSubscriptions: any[] = [];
      try {
        // Query push_subscriptions
        const subsSnap = await getDocs(collection(db, "push_subscriptions"));
        subsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.subscription && data.subscription.endpoint) {
            if (audienceMode === "todos" || targetMemberIds.includes(data.userId)) {
              targetSubscriptions.push(data.subscription);
            }
          }
        });

        // Query fcm_tokens for legacy or additional devices
        const fcmSnap = await getDocs(collection(db, "fcm_tokens"));
        fcmSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.subscription && data.subscription.endpoint) {
            // Avoid duplicate endpoints
            if (!targetSubscriptions.some((s) => s.endpoint === data.subscription.endpoint)) {
              if (audienceMode === "todos" || targetMemberIds.includes(data.userId)) {
                targetSubscriptions.push(data.subscription);
              }
            }
          }
        });
      } catch (subErr) {
        console.warn("Erro ao coletar subscrições do Firestore:", subErr);
      }

      // 4. Send WebPush broadcast via server
      let pushStats = { sent: 0, failed: 0 };
      if (targetSubscriptions.length > 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const resp = await fetch("/api/push/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              message,
              url: "/",
              subscriptions: targetSubscriptions,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          if (resp.ok) {
            const resData = await resp.json();
            pushStats = { sent: resData.sent || 0, failed: resData.failed || 0 };
          }
        } catch (pushErr: any) {
          console.warn("Erro ao despachar push broadcast pelo servidor:", pushErr);
        }
      }

      const pushSummary =
        targetSubscriptions.length > 0
          ? ` (${pushStats.sent} push(es) nativos enviados)`
          : "";

      showAlert(`Notificação enviada com sucesso para: ${targetLabel}${pushSummary}!`, { type: "success" });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      console.error("Erro ao enviar notificação:", err);
      showAlert("Falha ao enviar notificação: " + err.message, { type: "error" });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (tmpl: (typeof NOTIFICATION_TEMPLATES)[0]) => {
    setTitle(tmpl.title);
    setMessage(tmpl.message);
    setType(tmpl.type);
  };

  const generateAI = async () => {
    if (!promptAi.trim()) {
      showAlert("Por favor, digite o que você deseja comunicar.", { type: "warning" });
      return;
    }

    setGenerating(true);
    try {
      const prompt = `Você é um comunicador do Instituto Teológico DAVVERO.
Escreva um título conciso (até 45 caracteres, com 1 emoji pertinente) e uma mensagem clara, acolhedora, objetiva e sem clichês (até 220 caracteres) para o seguinte aviso:

IDEIA DO AVISO: "${promptAi}"

Retorne o resultado estritamente em um JSON no formato {"title": "...", "message": "..."}.`;

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                title: { type: "string" },
                message: { type: "string" },
              },
              required: ["title", "message"],
            },
          },
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const response = await res.json();
      if (response.text) {
        const parsed = JSON.parse(response.text);
        setTitle(parsed.title || "");
        setMessage(parsed.message || "");
        setShowAiModal(false);
        setPromptAi("");
      }
    } catch (error: any) {
      console.error("Erro na IA:", error);
      showAlert("Não foi possível gerar a mensagem pela IA. Verifique sua conexão.", { type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handleTestLocal = async () => {
    setTestingLocal(true);
    try {
      await sendLocalTestNotification();
    } finally {
      setTestingLocal(false);
    }
  };

  const handleTestServerPush = async () => {
    setTestingPush(true);
    try {
      const ok = await sendServerTestPush();
      if (ok) {
        showAlert("Push de teste enviado pelo servidor com sucesso!", { type: "success" });
      }
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <div className="space-y-6 animated-fade-in max-w-4xl p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-sky-500" />
            Compositor de Notificações
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Envie avisos, atualizações e comunicados com entrega em tempo real e push nativo no navegador/PWA.
          </p>
        </div>

        {/* Diagnostic Button */}
        <button
          type="button"
          onClick={() => {
            setShowDiagnosticsModal(true);
            runDiagnostics();
          }}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700"
          title="Abrir painel de diagnóstico e teste de conectividade VAPID/Push"
        >
          <Activity className="w-4 h-4 text-indigo-500" />
          <span>Diagnóstico Push</span>
        </button>
      </div>

      {/* Push Subscription Bar */}
      <div
        className={`border rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          subscription
            ? "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
            : "bg-sky-50/80 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl text-white shadow-md ${
              subscription ? "bg-emerald-500 shadow-emerald-500/20" : "bg-sky-500 shadow-sky-500/20"
            }`}
          >
            {subscription ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                {subscription ? "Push Nativo Ativo neste Dispositivo" : "Ativar Notificações no Navegador"}
              </h4>
              <span
                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  subscription
                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                }`}
              >
                {subscription ? "Inscrito" : permission === "denied" ? "Bloqueado" : "Disponível"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subscription
                ? "Este aparelho receberá avisos sonoros e visuais mesmo com a aba fechada."
                : "Receba comunicados e alertas instantâneos diretamente no seu celular ou computador."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleToggleSubscription}
            disabled={isSubscribing}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-2 ${
              subscription
                ? "bg-slate-200 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                : "bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20"
            }`}
          >
            {isSubscribing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : subscription ? (
              <span>Desativar Notificações</span>
            ) : (
              <span>Ativar Agora</span>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert Box with Detailed Diagnostics */}
      {lastError && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-4 space-y-2 text-rose-900 dark:text-rose-200 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{lastError.title}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-rose-200 dark:bg-rose-900/60 rounded">
                {lastError.type}
              </span>
            </div>
            <button
              onClick={() => setShowDiagnosticsModal(true)}
              className="text-xs font-bold text-rose-700 dark:text-rose-300 underline hover:text-rose-900 flex items-center gap-1 shrink-0"
            >
              <Activity className="w-3.5 h-3.5" /> Ver Diagnóstico
            </button>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300">{lastError.message}</p>
          <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl text-xs text-slate-700 dark:text-slate-300 border border-rose-100 dark:border-rose-900/40">
            <strong>Como resolver:</strong> {lastError.resolution}
          </div>
        </div>
      )}

      {/* Main Composer Layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <form onSubmit={handleSendNotification} className="space-y-4">
            {/* Audience selection */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Público Alvo do Aviso
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setAudienceMode("todos")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${
                      audienceMode === "todos"
                        ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-500"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Globe className="w-4 h-4" /> Todos (Broadcast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode("grupo")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${
                      audienceMode === "grupo"
                        ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="w-4 h-4" /> Grupo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode("individual")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${
                      audienceMode === "individual"
                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <User className="w-4 h-4" /> Individual
                  </button>
                </div>
              </div>

              {audienceMode === "grupo" && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Selecione o Grupo
                  </label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="input-modern"
                  >
                    <option value="alunos">Apenas Alunos e Seminaristas</option>
                    <option value="visitantes">Apenas Visitantes</option>
                  </select>
                </div>
              )}

              {audienceMode === "individual" && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Buscar Aluno / Usuário
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="input-modern"
                    required={audienceMode === "individual"}
                  >
                    <option value="">-- Selecione o usuário --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.ra || m.cpf || "S/ Doc"}) - {m.roles?.includes("VISITANTE") ? "Visitante" : "Aluno"}
                      </option>
                    ))}
                  </select>
                  {loadingMembers && (
                    <p className="text-[10px] text-sky-500 mt-1 animate-pulse">Carregando lista de membros...</p>
                  )}
                </div>
              )}
            </div>

            {/* Title & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Título da Notificação
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Atualização do Calendário"
                  className="input-modern"
                  maxLength={60}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Tipo
                </label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="input-modern">
                  <option value="sistema">Sistema</option>
                  <option value="evento">Evento</option>
                  <option value="carteirinha">Carteirinha</option>
                  <option value="inscricao">Inscrição</option>
                  <option value="certificado">Certificado</option>
                </select>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mensagem Principal
                </label>
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" /> IA Compositor
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite o texto da notificação..."
                className="input-modern min-h-[130px] resize-none"
                maxLength={300}
                required
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-bold">
                <span>{audienceMode === "todos" ? "Enviado com som e alerta nativo" : "Direcionado ao destinatário"}</span>
                <span>{message.length} / 300 caracteres</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {sending
                  ? "Despachando Notificação..."
                  : audienceMode === "todos"
                  ? "Enviar para Todos os Alunos"
                  : audienceMode === "grupo"
                  ? "Enviar para Grupo Selecionado"
                  : "Enviar para Aluno Específico"}
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-3 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs leading-relaxed">
                <strong>Atenção:</strong> Os avisos enviados são refletidos instantaneamente no painel dos alunos e
                notificados via WebPush nos dispositivos que autorizaram o recebimento.
              </p>
            </div>
          </form>
        </div>

        {/* Quick Templates Sidebar */}
        <div className="w-full xl:w-[280px] shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-6 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Modelos Rápidos
          </h3>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
            {NOTIFICATION_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="text-left text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all group"
              >
                <div className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-1">
                  {tmpl.label}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{tmpl.message}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAiModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden relative">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/40">
                <h3 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Compositor Inteligente IA
                </h3>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Descreva o assunto que deseja comunicar. A IA redigirá um título atraente e um texto claro e acolhedor.
                </p>
                <textarea
                  value={promptAi}
                  onChange={(e) => setPromptAi(e.target.value)}
                  placeholder="Ex: Avisar sobre a prorrogação da entrega de trabalhos finais até sexta-feira..."
                  className="input-modern min-h-[110px] text-sm resize-none"
                  autoFocus
                />
                <button
                  onClick={generateAI}
                  disabled={generating || !promptAi.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white p-3.5 rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Gerando Título e Mensagem..." : "Gerar com IA"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Diagnostics Modal */}
      {showDiagnosticsModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-500/20">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">
                      Diagnóstico do Sistema de Notificações
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verificação técnica de VAPID, Service Worker, Rede e Permissões
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDiagnosticsModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
                {/* Status Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Permissão</div>
                    <div className="flex items-center gap-1.5 font-bold">
                      {permission === "granted" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : permission === "denied" ? (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="capitalize">{permission}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Service Worker</div>
                    <div className="flex items-center gap-1.5 font-bold">
                      {"serviceWorker" in navigator ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span>{"serviceWorker" in navigator ? "Suportado" : "Ausente"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rede / Conexão</div>
                    <div className="flex items-center gap-1.5 font-bold">
                      {navigator.onLine ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span>{navigator.onLine ? "Online" : "Offline"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Subscrição</div>
                    <div className="flex items-center gap-1.5 font-bold">
                      {subscription ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Info className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{subscription ? "Inscrito" : "Inativo"}</span>
                    </div>
                  </div>
                </div>

                {/* Test Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={runDiagnostics}
                    disabled={isDiagnosing}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold hover:bg-indigo-100 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? "animate-spin" : ""}`} />
                    <span>Recarregar Testes</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestLocal}
                    disabled={testingLocal}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-xl font-bold hover:bg-sky-100 transition"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{testingLocal ? "Disparando..." : "Testar Alerta Local"}</span>
                  </button>

                  {subscription && (
                    <button
                      type="button"
                      onClick={handleTestServerPush}
                      disabled={testingPush}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold hover:bg-emerald-100 transition"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>{testingPush ? "Enviando..." : "Testar Push Servidor"}</span>
                    </button>
                  )}
                </div>

                {/* Diagnostic Logs Console */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                      Registro de Eventos Técnicos
                    </span>
                    <span>{diagnosticLogs.length} eventos</span>
                  </div>

                  <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] space-y-1.5 max-h-[220px] overflow-y-auto border border-slate-800">
                    {diagnosticLogs.length === 0 ? (
                      <p className="text-slate-500 italic">Nenhum evento registrado ainda. Clique em 'Recarregar Testes'.</p>
                    ) : (
                      diagnosticLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-slate-500 text-[10px] shrink-0 font-sans">[{log.timestamp}]</span>
                          {log.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                          {log.status === "error" && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                          {log.status === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                          {log.status === "info" && <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />}
                          <div className="flex-1">
                            <span className="font-bold text-slate-300">[{log.step}] </span>
                            <span>{log.message}</span>
                            {log.detail && <p className="text-slate-400 text-[10px] mt-0.5">{log.detail}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Help Guide */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Guia de Resolução Rápida:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                    <li>
                      <strong>Permissão Bloqueada:</strong> Clique no cadeado 🔒 na barra de endereços do navegador e permita 'Notificações'.
                    </li>
                    <li>
                      <strong>No Celular (iOS/Android):</strong> Para melhor desempenho, adicione o DAVVERO à Tela Inicial (PWA).
                    </li>
                    <li>
                      <strong>Chave VAPID:</strong> As chaves são verificadas em tempo real através do endpoint <code>/api/push/status</code>.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDiagnosticsModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
