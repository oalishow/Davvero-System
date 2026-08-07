import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Send, Sparkles, AlertCircle, RefreshCw, Wand2, X, Bell, BellOff, Users, User, Globe } from "lucide-react";
import { createNotification, db, appId } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useDialog } from "../context/DialogContext";
import { usePushNotifications } from "../hooks/usePushNotifications";
import type { Member } from "../types";

const NOTIFICATION_TEMPLATES = [
  {
    label: "Nova Atualização",
    title: "Novidades Chegaram! 🚀",
    message: "Uma nova atualização está disponível! Atualize a página e confira as melhorias preparadas especialmente para você.",
    type: "sistema",
  },
  {
    label: "Aviso de Evento",
    title: "Lembrete: Nosso Evento",
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
    message: "Boas notícias: seus certificados de participação já estão disponíveis para emissão no painel.",
    type: "certificado",
  },
  {
    label: "Boas-vindas",
    title: "Bem-vindo ao Novo Semestre! 🎉",
    message: "Estamos felizes em tê-lo conosco! Explore as novidades do portal e tenha um excelente semestre de estudos.",
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

  const [audienceMode, setAudienceMode] = useState<"todos" | "grupo" | "individual">("todos");
  const [selectedGroup, setSelectedGroup] = useState<string>("alunos");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  const { showAlert } = useDialog();
  const { isSupported, subscription, subscribe } = usePushNotifications();

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
        setMembers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, []);

  const handleSendNotification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showAlert("Preencha todos os campos.", { type: "error" });
      return;
    }

    if (audienceMode === "individual" && !selectedUserId) {
      showAlert("Por favor, selecione um usuário membro para enviar.", { type: "warning" });
      return;
    }

    setSending(true);
    try {
      // 1. Definição do Público-alvo (Audience)
      let targetMemberIds: string[] = [];
      let targetLabel = "todos";

      if (audienceMode === "todos") {
        targetMemberIds = ["todos"];
      } else if (audienceMode === "individual") {
        targetMemberIds = [selectedUserId];
        const m = members.find(x => x.id === selectedUserId);
        targetLabel = m ? m.name : "Usuário Específico";
      } else if (audienceMode === "grupo") {
        targetLabel = selectedGroup === "alunos" ? "Alunos e Seminaristas" : "Visitantes";
        let filtered = members;
        if (selectedGroup === "alunos") {
          filtered = members.filter(m => !m.roles?.includes("VISITANTE") && Object.keys(m).length > 2);
        } else if (selectedGroup === "visitantes") {
          filtered = members.filter(m => !!m.roles?.includes("VISITANTE"));
        }
        targetMemberIds = filtered.map(m => m.id);
        
        if (targetMemberIds.length === 0) {
          showAlert("Não há usuários neste grupo no momento.", { type: "warning" });
          setSending(false);
          return;
        }
      }

      // 2. Create Firestore notifications (for in-app display)
      // Se for um broadcast global, cria apenas 1 notificação com recipient="todos".
      // Se for grupo/individual, cria uma notificação individual por ID.
      if (audienceMode === "todos") {
        await createNotification({ recipientId: "todos", title, message, type });
      } else {
        await Promise.all(targetMemberIds.map(uid => 
          createNotification({ recipientId: uid, title, message, type })
        ));
      }

      // 3. Fetch subscriptions from Firestore para Push Nativo
      let targetSubscriptions: any[] = [];
      const subPath = "push_subscriptions";
      try {
        const subsSnapshot = await getDocs(collection(db, subPath));
        if (audienceMode === "todos") {
          targetSubscriptions = subsSnapshot.docs.map(doc => doc.data());
        } else {
          // Send push to matching device only
          // Our push subscriptions currently might or might not have user ID associated.
          // Since our subscription logic typically saves the browser token, if we linked it using device or user, we filter.
          // IF we don't have user IDs in push_subscriptions, we can only safely do "todos", but we will try filtering if user field exists.
          targetSubscriptions = subsSnapshot.docs
            .map(doc => doc.data())
            .filter(sub => targetMemberIds.includes(sub.userId) || audienceMode === "todos"); 
          // Note: If sub.userId is missing, individual push might be skipped, which is fine since in-app still works.
        }
      } catch (subErr) {
        console.error(`Error fetching subscriptions for path: ${subPath}`, subErr);
      }

      // 4. Send Push Notification Broadcast (Native)
      if (targetSubscriptions.length > 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const resp = await fetch("/api/push/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, message, url: "/", subscriptions: targetSubscriptions }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          const result = await resp.json();
          if (result.expiredEndpoints && result.expiredEndpoints.length > 0) {
             console.log("Cleanup expired subscriptions:", result.expiredEndpoints);
          }
        } catch (pushErr) {
          console.error("Cloud Push error:", pushErr);
        }
      }

      showAlert(`Notificação enviada a: ${targetLabel} com sucesso!`, { type: "success" });
      setTitle("");
      setMessage("");
    } catch (err: any) {
      console.error("Erro ao enviar notificação:", err);
      showAlert("Falha ao enviar notificação: " + err.message, { type: "error" });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (tmpl: typeof NOTIFICATION_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setMessage(tmpl.message);
    setType(tmpl.type);
  };

  const generateAI = async () => {
    if (!promptAi.trim()) {
      showAlert("Por favor, digite o que você deseja avisar ou comunicar.", { type: "warning" });
      return;
    }

    setGenerating(true);
    try {
      const prompt = `Você é um excelente comunicador responsável por avisos para alunos de um instituto de teologia.
Escreva um título curto (até 50 caracteres, podendo ter um emoji no final) e uma mensagem clara, objetiva, engajadora e diversificada (evite clichês e use vocabulário rico, variando o tom, até 250 caracteres) para a seguinte ideia de notificação:

IDEIA DO AVISO: "${promptAi}"

Retorne o resultado estritamente em um JSON com os campos 'title' (o título) e 'message' (a mensagem completa). Crie algo amigável, caloroso e com linguagem diversificada.`;

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
                message: { type: "string" }
              },
              required: ["title", "message"]
            }
          }
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const response = await res.json();
      const responseText = response.text;
      if (responseText) {
        const jsonContent = JSON.parse(responseText);
        setTitle(jsonContent.title || "");
        setMessage(jsonContent.message || "");
        setShowAiModal(false);
        setPromptAi("");
      }
    } catch (error: any) {
      console.error("Erro ao gerar texto com IA", error);
      showAlert("Não foi possível gerar a notificação pela IA. Verifique sua chave da API do Gemini.", { type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animated-fade-in max-w-3xl lg:max-w-4xl p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl relative">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Send className="w-6 h-6 text-sky-500" />
          Compositor de Notificações
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Envie avisos, atualizações e informações em tempo real para todos os alunos conectados no aplicativo.
        </p>
      </div>

      {isSupported && !subscription && (
        <div className="bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-2 rounded-xl text-white shadow-lg shadow-sky-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Ativar Notificações no Desktop/Celular</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receba avisos nativos mesmo com o navegador fechado.</p>
            </div>
          </div>
          <button
            onClick={subscribe}
            className="bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition active:scale-95 border border-sky-100 dark:border-sky-800"
          >
            Ativar Agora
          </button>
        </div>
      )}

      {subscription && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3 flex items-center gap-3">
          <div className="bg-emerald-500 p-1.5 rounded-lg text-white">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Push Native Ativo neste dispositivo</span>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Público Alvo
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setAudienceMode("todos")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${audienceMode === "todos" ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"}`}
                  >
                    <Globe className="w-4 h-4" /> Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode("grupo")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${audienceMode === "grupo" ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"}`}
                  >
                    <Users className="w-4 h-4" /> Grupo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode("individual")}
                    className={`flex-1 p-3 text-sm font-bold rounded-xl border flex justify-center items-center gap-2 transition-colors ${audienceMode === "individual" ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"}`}
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
                    Buscar Usuário / Membro
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="input-modern"
                    required={audienceMode === "individual"}
                  >
                    <option value="">-- Selecione o usuário --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.ra || m.cpf || 'S/ Doc'}) - {m.roles?.includes("VISITANTE") ? "Visitante" : "Aluno"}</option>
                    ))}
                  </select>
                  {loadingMembers && <p className="text-[10px] text-sky-500 mt-1 animate-pulse">Carregando membros...</p>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Título da Notificação
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização Importante"
                className="input-modern"
                maxLength={60}
                required
              />
            </div>

            <div>
               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Tipo da Notificação
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-modern"
              >
                <option value="sistema">Aviso do Sistema</option>
                <option value="evento">Evento ou Reunião</option>
                <option value="carteirinha">Carteirinha</option>
                <option value="inscricao">Inscrição</option>
                <option value="certificado">Certificado</option>
              </select>
            </div>

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
                placeholder="Digite a mensagem para os alunos..."
                className="input-modern min-h-[140px] resize-none"
                maxLength={300}
                required
              />
              <div className="flex justify-end text-[10px] text-slate-400 mt-1 font-bold">
                {message.length} / 300 caracteres
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {sending ? "Enviando Notificação..." : audienceMode === "todos" ? "Enviar para Todos (Broadcast)" : audienceMode === "grupo" ? "Enviar para Grupo" : "Enviar para Usuário"}
              </button>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-3 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs leading-relaxed">
                <strong>Atenção:</strong> {audienceMode === "todos" ? "O broadcast enviará esta notificação para o painel de TODOS os usuários imediatamente." : audienceMode === "grupo" ? "Esta notificação será enviada para o painel de todos os membros do grupo selecionado." : "A notificação será processada imediatamente para o usuário selecionado."} Esta ação não poderá ser desfeita.
              </p>
            </div>
          </form>
        </div>

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
                <div className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-1">{tmpl.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{tmpl.message}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showAiModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-950/30">
              <h3 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                L.A.I.A Compositor
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Descreva de forma simples o que você quer avisar aos alunos, a nossa Inteligência Artificial criará um texto engajador e direto.
              </p>
              <textarea
                value={promptAi}
                onChange={(e) => setPromptAi(e.target.value)}
                placeholder="Ex: Avisar que a entrega de trabalhos foi prorrogada para a próxima sexta devido ao feriado..."
                className="input-modern min-h-[100px] text-sm resize-none"
                autoFocus
              />
              <button
                onClick={generateAI}
                disabled={generating || !promptAi.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Gerando Título e Texto..." : "Gerar Notificação"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
