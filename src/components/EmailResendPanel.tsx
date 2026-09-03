import React, { useState, useMemo } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  Sparkles,
  UserCheck,
  Moon,
  RefreshCw,
  Search,
  Users,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Settings,
  FileText,
  Check,
  Info,
  AlertCircle
} from "lucide-react";
import type { Member } from "../types";
import { AppSettings } from "../context/SettingsContext";
import {
  sendEmailNotification,
  getCompiledEmail,
  EmailTemplateKey,
  parseEmailList
} from "../lib/emailService";

interface EmailResendPanelProps {
  members: Member[];
  settings: AppSettings;
  showAlert: (msg: string, opts?: { type?: "success" | "error" | "warning" | "info"; title?: string }) => void;
}

type ResendCategory = "card_expiring" | "certificates" | "activation" | "inactivity" | "news";

interface CategoryMeta {
  id: ResendCategory;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  templateKey: EmailTemplateKey;
  defaultSubject: string;
  actionAdvice: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "card_expiring",
    title: "Vencimento da Carteirinha (Falta 1 Mês)",
    badge: "Secretaria / Renovação",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: Clock,
    description: "Notifica alunos cuja carteirinha vencerá nos próximos 30 dias para comparecerem ou contatarem a secretaria para renovar o documento oficial.",
    templateKey: "cardExpiringSoon",
    defaultSubject: "Aviso: Sua Carteirinha Digital Vencerá em Breve ⏳ - Renovação Necessária",
    actionAdvice: "Orienta o aluno a procurar a secretaria acadêmica para emissão da nova via e atualização do QR Code."
  },
  {
    id: "certificates",
    title: "Certificados Prontos para Emissão",
    badge: "Acadêmico / Eventos",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: Award,
    description: "Reenvia aviso aos alunos informando que os certificados de eventos e cursos estão liberados para visualização e download no portal.",
    templateKey: "certificateAvailableAttendee",
    defaultSubject: "Seu Certificado Oficial Está Liberado para Emissão! 🎓",
    actionAdvice: "Envia link direto para o aluno acessar o painel e baixar seu certificado em PDF de alta qualidade."
  },
  {
    id: "activation",
    title: "Ativação de Cadastro & Boas-Vindas",
    badge: "Primeiro Acesso",
    badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    icon: Sparkles,
    description: "Reenvia instruções de primeiro acesso e ativação do cadastro com carteirinha digital para alunos aprovados ou recém-cadastrados.",
    templateKey: "accountActivation",
    defaultSubject: "Ativação de Cadastro e Acesso à Carteirinha Digital ✨",
    actionAdvice: "Permite ao aluno validar seus dados, cadastrar a foto de perfil e gerar sua credencial estudantil."
  },
  {
    id: "inactivity",
    title: "Lembrete de Inatividade & Reengajamento",
    badge: "Comunicação",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    icon: Moon,
    description: "Relembra membros que não acessaram recentemente a manterem o cadastro atualizado e conferirem eventos abertos.",
    templateKey: "inactivityReminder",
    defaultSubject: "Sentimos sua Falta no Portal Acadêmico! 📚 - Mantenha seus dados ativos",
    actionAdvice: "Convida o membro a retornar ao sistema, conferir novas publicações e agendamentos disponíveis."
  },
  {
    id: "news",
    title: "Novidades do Sistema & Comunicados",
    badge: "Informativo Geral",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    icon: Mail,
    description: "Envia comunicados gerais, avisos sobre novidades na plataforma, novos recursos e calendário acadêmico.",
    templateKey: "systemNews",
    defaultSubject: "Novidades Importantes e Atualizações no Sistema DAVVERO 🚀",
    actionAdvice: "Transmite comunicados oficiais da coordenação a toda a comunidade discente."
  }
];

function parseExpirationDate(val?: string): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysUntilExpiration(val?: string): number | null {
  const d = parseExpirationDate(val);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateBR(val?: string): string {
  const d = parseExpirationDate(val);
  if (!d) return val || "A definir";
  return d.toLocaleDateString("pt-BR");
}

export default function EmailResendPanel({ members, settings, showAlert }: EmailResendPanelProps) {
  const [category, setCategory] = useState<ResendCategory>("card_expiring");
  const [expiryThreshold, setExpiryThreshold] = useState<number>(35); // default ~1 month
  const [audienceFilter, setAudienceFilter] = useState<"auto" | "all" | "diocese" | "single">("auto");
  const [selectedDiocese, setSelectedDiocese] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [customEventTitle, setCustomEventTitle] = useState<string>("Seminário Teológico de Formação");
  const [customHours, setCustomHours] = useState<string>("20");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [showRecipientList, setShowRecipientList] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [testSending, setTestSending] = useState<boolean>(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  const currentCategoryMeta = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  // Distinct dioceses
  const diocesesList = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.diocese && m.diocese.trim()) set.add(m.diocese.trim());
    });
    return Array.from(set).sort();
  }, [members]);

  // Members calculation according to category and audienceFilter
  const filteredRecipients = useMemo(() => {
    return members.filter((m) => {
      if (!m.email || !m.email.includes("@")) return false;

      // Filter by diocese if selected
      if (audienceFilter === "diocese" && selectedDiocese) {
        if (m.diocese?.toUpperCase().trim() !== selectedDiocese.toUpperCase().trim()) {
          return false;
        }
      }

      // Single member filter
      if (audienceFilter === "single") {
        return m.id === selectedMemberId;
      }

      // Auto filter logic
      if (audienceFilter === "auto") {
        if (category === "card_expiring") {
          const days = getDaysUntilExpiration(m.validityDate);
          if (days === null) return false;
          if (expiryThreshold === -1) return days < 0; // expired
          return days >= 0 && days <= expiryThreshold;
        }
        if (category === "activation") {
          // Pending or recently added
          return m.status === "PENDING" || !m.isActive || m.isApproved === false;
        }
        if (category === "inactivity") {
          return m.isActive === false || m.status === "REVOKED";
        }
      }

      return true;
    });
  }, [members, category, audienceFilter, selectedDiocese, selectedMemberId, expiryThreshold]);

  // Search filtered recipient preview
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return filteredRecipients;
    const q = searchQuery.toLowerCase().trim();
    return filteredRecipients.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.ra?.toLowerCase().includes(q) ||
        m.diocese?.toLowerCase().includes(q)
    );
  }, [filteredRecipients, searchQuery]);

  // Effective subject
  const effectiveSubject = customSubject.trim() || currentCategoryMeta.defaultSubject;

  // Generate preview email for the first recipient or a sample
  const previewSampleMember: Member = filteredRecipients[0] || {
    id: "sample",
    name: "João Silva Sauro",
    email: "aluno.exemplo@fajopa.edu.br",
    ra: "2026-0042",
    validityDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    roles: ["Seminarista", "Teologia"],
    diocese: "Marília",
    alphaCode: "FAJ-8821"
  };

  const sampleCompiled = useMemo(() => {
    const days = getDaysUntilExpiration(previewSampleMember.validityDate);
    return getCompiledEmail({
      templateKey: currentCategoryMeta.templateKey,
      customTemplates: settings?.emailTemplates,
      vars: {
        name: previewSampleMember.name,
        ra: previewSampleMember.ra || "RA-0000",
        alphaCode: previewSampleMember.alphaCode || "ALF-001",
        roles: previewSampleMember.roles?.join(", ") || "Aluno(a)",
        expiryDate: formatDateBR(previewSampleMember.validityDate),
        eventTitle: customEventTitle || "Seminário Acadêmico",
        hours: `${customHours} horas`,
        newsMessage: customMessage || "Apresentamos os novos recursos e avisos institucionais da secretaria acadêmica.",
        instName: settings?.instName || "Instituto Teológico DAVVERO",
        headerName: settings?.emailHeaderName || settings?.instName || "DAVVERO Acadêmico"
      },
      settings,
      customTitle: effectiveSubject
    });
  }, [currentCategoryMeta, previewSampleMember, customEventTitle, customHours, customMessage, settings, effectiveSubject]);

  // Test send to admin / coordinator
  const handleSendTestEmail = async () => {
    const adminEmail = settings?.secretariatNotificationEmail || settings?.smtpConfig?.user || settings?.smtpConfig?.fromEmail;
    if (!adminEmail || !adminEmail.includes("@")) {
      showAlert("Configure o e-mail da Secretaria ou do Administrador nas Configurações Gerais para receber o e-mail de teste.", {
        type: "warning",
        title: "E-mail de Destino Não Encontrado"
      });
      return;
    }

    setTestSending(true);
    try {
      const res = await sendEmailNotification(
        {
          to: adminEmail,
          subject: `[TESTE] ${sampleCompiled.subject}`,
          html: sampleCompiled.fullHtml,
          text: sampleCompiled.bodyHtml
        },
        settings?.smtpConfig
      );

      if (res.success) {
        showAlert(`E-mail de demonstração enviado com sucesso para ${adminEmail}! Verifique sua caixa de entrada.`, {
          type: "success",
          title: "E-mail de Teste Enviado"
        });
      } else {
        showAlert(`Falha ao disparar teste: ${res.error || "Erro desconhecido"}`, {
          type: "error",
          title: "Erro no Envio de Teste"
        });
      }
    } catch (err: any) {
      showAlert(`Erro: ${err.message || "Não foi possível conectar ao serviço de e-mail."}`, {
        type: "error",
        title: "Erro de Conexão"
      });
    } finally {
      setTestSending(false);
    }
  };

  // Bulk send to selected recipients
  const handleBulkSend = async () => {
    if (filteredRecipients.length === 0) {
      showAlert("Nenhum destinatário com e-mail válido foi encontrado para os filtros selecionados.", {
        type: "warning",
        title: "Lista Vazia"
      });
      return;
    }

    const confirmText = `Deseja realmente reenviar o e-mail "${effectiveSubject}" para ${filteredRecipients.length} membro(s)?`;
    if (!window.confirm(confirmText)) {
      return;
    }

    setSending(true);
    setSendProgress({ current: 0, total: filteredRecipients.length });

    let successCount = 0;
    let failCount = 0;

    // Send in friendly chunks of 5 with interpolation for each member
    const batchSize = 5;
    for (let i = 0; i < filteredRecipients.length; i += batchSize) {
      const batch = filteredRecipients.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (m) => {
          try {
            const compiled = getCompiledEmail({
              templateKey: currentCategoryMeta.templateKey,
              customTemplates: settings?.emailTemplates,
              vars: {
                name: m.name,
                ra: m.ra || "RA-0000",
                alphaCode: m.alphaCode || "ALF-001",
                roles: m.roles?.join(", ") || "Aluno(a)",
                expiryDate: formatDateBR(m.validityDate),
                eventTitle: customEventTitle || "Seminário Acadêmico",
                hours: `${customHours} horas`,
                newsMessage: customMessage || "Comunicado oficial da coordenação acadêmica.",
                instName: settings?.instName || "Instituto Teológico DAVVERO",
                headerName: settings?.emailHeaderName || settings?.instName || "DAVVERO Acadêmico"
              },
              settings,
              customTitle: effectiveSubject
            });

            const res = await sendEmailNotification(
              {
                to: m.email!,
                subject: compiled.subject,
                html: compiled.fullHtml,
                text: compiled.bodyHtml
              },
              settings?.smtpConfig
            );

            if (res.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        })
      );

      setSendProgress({ current: Math.min(i + batchSize, filteredRecipients.length), total: filteredRecipients.length });
    }

    setSending(false);
    setSendProgress(null);

    if (failCount === 0) {
      showAlert(`Reenvio concluído com sucesso total! ${successCount} e-mail(s) entregues.`, {
        type: "success",
        title: "Disparo Concluído"
      });
    } else {
      showAlert(`Reenvio finalizado: ${successCount} enviados com sucesso e ${failCount} falharam. Verifique o status do SMTP se necessário.`, {
        type: "warning",
        title: "Resultado do Envio"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <div className="bg-gradient-to-r from-sky-50 via-indigo-50/60 to-purple-50/40 dark:from-sky-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 border border-sky-200/80 dark:border-sky-800/60 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-sky-500 text-white rounded-2xl shadow-md shadow-sky-500/20 shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
                Central de Reenvio de E-mails
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Dispare avisos direcionados de certificados, carteirinhas a vencer, ativação de cadastro e inatividade.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={testSending || sending}
            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-800/80 shadow-sm transition-all disabled:opacity-50"
            title="Envia um modelo de teste para o e-mail da secretaria para conferência antes do envio geral"
          >
            {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Enviar Teste para Mim</span>
          </button>
        </div>
      </div>

      {/* Step 1: Select Category */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black">
            1
          </span>
          Selecione o Tipo de Comunicado a Reenviar
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id);
                  setCustomSubject("");
                }}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all relative ${
                  isSelected
                    ? "bg-sky-50/90 dark:bg-sky-950/30 border-sky-500 ring-2 ring-sky-500/20 shadow-md"
                    : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${isSelected ? "bg-sky-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.badgeColor}`}>
                    {cat.badge}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-snug">
                  {cat.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {cat.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Target Audience & Criteria */}
      <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black">
              2
            </span>
            Defina o Filtro de Destinatários
          </label>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {filteredRecipients.length} aluno(s) selecionado(s) com e-mail válido
          </div>
        </div>

        {/* Specific option for Expiration threshold */}
        {category === "card_expiring" && (
          <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Janela de Vencimento da Carteirinha:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: 35, label: "Falta ~1 Mês (35 dias)", badge: "Recomendado" },
                { val: 15, label: "Falta 15 dias", badge: "Urgente" },
                { val: 60, label: "Faltam 60 dias", badge: "Antecipado" },
                { val: -1, label: "Já Vencidas", badge: "Regularização" }
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setExpiryThreshold(opt.val)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-left border transition-all flex flex-col justify-between ${
                    expiryThreshold === opt.val
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-amber-200 dark:border-amber-800/40 hover:border-amber-400"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className={`text-[10px] opacity-80 font-medium ${expiryThreshold === opt.val ? "text-amber-100" : "text-amber-600 dark:text-amber-400"}`}>
                    {opt.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audience filter mode */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
          {[
            { id: "auto", label: "Filtro Automático da Regra", desc: "Apenas membros no critério" },
            { id: "all", label: "Todos os Alunos", desc: "Todos com e-mail cadastrado" },
            { id: "diocese", label: "Por Diocese / Seminário", desc: "Filtrar por região eclesiástica" },
            { id: "single", label: "Aluno Específico", desc: "Localizar 1 membro" }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAudienceFilter(mode.id as any)}
              className={`p-3 rounded-xl border text-left transition-all ${
                audienceFilter === mode.id
                  ? "bg-sky-500 text-white border-sky-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-300"
              }`}
            >
              <div className="text-xs font-bold leading-tight">{mode.label}</div>
              <div className={`text-[10px] mt-0.5 ${audienceFilter === mode.id ? "text-sky-100" : "text-slate-400"}`}>
                {mode.desc}
              </div>
            </button>
          ))}
        </div>

        {/* Diocese picker if by_diocese */}
        {audienceFilter === "diocese" && (
          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
              Selecione a Diocese:
            </label>
            <select
              value={selectedDiocese}
              onChange={(e) => setSelectedDiocese(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            >
              <option value="">-- Escolha a Diocese --</option>
              {diocesesList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Single member search */}
        {audienceFilter === "single" && (
          <div className="pt-2 space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              Selecione o Aluno:
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            >
              <option value="">-- Selecione um membro da lista --</option>
              {members
                .filter((m) => Boolean(m.email))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email}) - RA: {m.ra || "N/A"}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Step 3: Content Customization */}
      <div className="space-y-4 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black">
            3
          </span>
          Personalização do E-mail
        </label>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
              Assunto do E-mail:
            </label>
            <input
              type="text"
              value={customSubject}
              placeholder={currentCategoryMeta.defaultSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
          </div>

          {/* If certificate category, allow customizing event & hours */}
          {category === "certificates" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Título do Evento / Curso:
                </label>
                <input
                  type="text"
                  value={customEventTitle}
                  onChange={(e) => setCustomEventTitle(e.target.value)}
                  placeholder="Ex: Semana Teológica FAJOPA 2026"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Carga Horária (horas):
                </label>
                <input
                  type="text"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* If news category, allow custom text */}
          {category === "news" && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Mensagem do Comunicado:
              </label>
              <textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Digite as novidades institucionais que deseja comunicar..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Advice box */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/40 text-xs text-sky-800 dark:text-sky-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
          <span>{currentCategoryMeta.actionAdvice}</span>
        </div>
      </div>

      {/* Step 4: Recipients List & Email Preview */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowRecipientList(!showRecipientList)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 transition"
          >
            {showRecipientList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Ver Destinatários Filtrados ({filteredRecipients.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <Eye className="w-3.5 h-3.5 text-sky-500" />
            <span>Pré-visualizar Modelo do E-mail</span>
          </button>
        </div>

        {/* Expandable Recipient List */}
        {showRecipientList && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm space-y-3 p-3">
            <div className="flex items-center gap-2 px-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome, email, RA ou diocese..."
                className="w-full text-xs bg-transparent border-0 focus:ring-0 text-slate-800 dark:text-white"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Nenhum aluno encontrado com esses termos.
                </div>
              ) : (
                searchResults.map((m) => {
                  const days = getDaysUntilExpiration(m.validityDate);
                  return (
                    <div key={m.id} className="py-2 px-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-white truncate">
                          {m.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {m.email} {m.ra ? `• RA: ${m.ra}` : ""} {m.diocese ? `• ${m.diocese}` : ""}
                        </div>
                      </div>
                      {category === "card_expiring" && m.validityDate && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            days !== null && days <= 0
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          Val: {formatDateBR(m.validityDate)} {days !== null ? `(${days}d)` : ""}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Send Actions Bar */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          O reenvio é realizado com o servidor SMTP configurado nas configurações gerais.
        </div>

        <button
          type="button"
          onClick={handleBulkSend}
          disabled={sending || filteredRecipients.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>
                Enviando {sendProgress ? `${sendProgress.current}/${sendProgress.total}` : "..."}
              </span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Disparar Reenvio para {filteredRecipients.length} Aluno(s)</span>
            </>
          )}
        </button>
      </div>

      {/* Modal Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-500" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  Pré-visualização do E-mail
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                <strong>Assunto:</strong> {sampleCompiled.subject}
              </div>
              <div
                className="bg-white rounded-xl shadow p-4"
                dangerouslySetInnerHTML={{ __html: sampleCompiled.fullHtml }}
              />
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
