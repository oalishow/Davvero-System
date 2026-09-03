export const PASSWORD_STORAGE_KEY = "studentAdminPassword";
export const DEFAULT_ADMIN_PASSWORD = "ADMIN";
export const URL_STORAGE_KEY = "studentVerifierUrl";
export const DEFAULT_PUBLIC_URL = "https://davvero.netlify.app";
export const BACKUP_STORAGE_KEY = "davveroId_local_backup";
export const RESTORE_POINT_KEY = "davveroId_restore_point";
export const EMAIL_SETTINGS_KEY = "davveroId_email_settings";
export const DIRECTOR_NAME_KEY = "davveroId_director_name";
export const DEFAULT_DIRECTOR_NAME = "";
export const INSTITUTION_LOGO_KEY = "davveroId_institution_logo";
export const INSTITUTION_NAME_KEY = "davveroId_institution_name";
export const INSTITUTION_COLOR_KEY = "davveroId_institution_color";
export const DIRECTOR_SIGNATURE_KEY = "davveroId_director_signature";
export const CARD_LOGO_KEY = "davveroId_card_logo";
export const CARD_BACK_LOGO_KEY = "davveroId_card_back_logo";
export const CARD_FRONT_LOGO_CONFIG_KEY = "davveroId_card_front_logo_config";
export const CARD_BACK_LOGO_CONFIG_KEY = "davveroId_card_back_logo_config";
export const CARD_FRONT_TEXT_KEY = "davveroId_card_front_text";
export const CARD_BACK_TEXT_KEY = "davveroId_card_back_text";
export const CARD_VISIBLE_FIELDS_KEY = "davveroId_card_visible_fields";
export const CARD_BACK_IMAGE_KEY = "davveroId_card_back_image";
export const CARD_SIGNATURE_CONFIG_KEY = "davveroId_card_signature_config";
export const SECONDARY_BACK_LOGO_SCALE_KEY =
  "davveroId_secondary_back_logo_scale";
export const INSTITUTION_DESCRIPTION_KEY = "davveroId_institution_description";
export const CARD_DESCRIPTION_KEY = "davveroId_card_description";
export const CUSTOM_ROLES_KEY = "davveroId_custom_roles";
export const CUSTOM_COURSES_KEY = "davveroId_custom_courses";
export const APP_VERSION = "8.0b";
export const APP_BUILD = "02.09.2026";
export const SETTINGS_DOC_PATH = (appId: string) =>
  `artifacts/${appId}/public/data/students/_settings_global`;
export const ASSETS_DOC_PATH = (appId: string, assetType: string) =>
  `artifacts/${appId}/public/data/students/_asset_${assetType}`;

/**
 * Utility to extract a clean image/data string from Firestore or local storage values.
 * Handles string base64/URLs, raw objects { data, url, signature, etc. }, and purges
 * corrupt '[object Object]' or nullish string literals from storage.
 */
export function extractAssetString(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null' || trimmed === '""') {
      return null;
    }
    return trimmed;
  }
  if (typeof val === 'object') {
    const candidate = 
      val.data || 
      val.url || 
      val.base64 || 
      val.instSignature || 
      val.rectorSignature || 
      val.signature || 
      val.signatureUrl ||
      val.bishopSignature ||
      val.bishopSignatureUrl ||
      val.responsibleSignature ||
      val.fajopaDirectorSignatureUrl ||
      val.seminarRectorSignatureUrl ||
      val.signature1Url ||
      val.signature2Url ||
      val.signature3Url ||
      val.instLogo ||
      val.cardLogo ||
      val.cardBackLogo ||
      val.logoUrl ||
      val.logo2Url ||
      val.value || 
      val.src || 
      val.photoUrl || 
      val.imageUrl;
    if (candidate && candidate !== val) {
      return extractAssetString(candidate);
    }
  }
  return null;
}

/**
 * Safe wrapper for localStorage.setItem that protects against QuotaExceededError.
 * Rejects oversized base64 assets (>60KB) to prevent storage exhaustion,
 * purges stale temporary / bulky cache items, and avoids crashing the app.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;

  // Never attempt to store huge base64 assets (>60KB) in localStorage (which has a 5MB total limit)
  if (value && value.length > 60000 && (key.includes("logo") || key.includes("signature") || key.includes("image") || key.includes("photo"))) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // Quota exceeded: clean up bulky asset caches first
    try {
      const bulkyKeys = [
        "davveroId_card_logo",
        "davveroId_institution_logo",
        "davveroId_director_signature",
        "davveroId_rector_signature",
        "davveroId_card_back_logo",
        "davveroId_card_back_image",
        "davveroId_card_secondary_back_logo"
      ];
      bulkyKeys.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });

      const keysToPurge: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          k !== key &&
          (k.startsWith("notif_cache_") ||
            k.startsWith("davveroId_offline_") ||
            k.startsWith("temp_"))
        ) {
          keysToPurge.push(k);
        }
      }
      keysToPurge.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });

      // If value is small enough, retry setItem
      if (!value || value.length <= 60000) {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch {
      // If still overflowing, don't crash the app; in-memory state will continue to work
      return false;
    }
  }
}

/**
 * Clean up legacy oversized keys from localStorage to ensure quota is healthy
 */
export function purgeOversizedLocalStorage(): void {
  if (typeof window === "undefined") return;
  const bulkyKeys = [
    "davveroId_card_logo",
    "davveroId_institution_logo",
    "davveroId_director_signature",
    "davveroId_rector_signature",
    "davveroId_card_back_logo",
    "davveroId_card_back_image",
    "davveroId_card_secondary_back_logo"
  ];
  bulkyKeys.forEach((k) => {
    try {
      const val = localStorage.getItem(k);
      if (val && val.length > 50000) {
        localStorage.removeItem(k);
      }
    } catch {}
  });
}

/**
 * Safe wrapper for sessionStorage.setItem that prevents unhandled quota exceptions.
 */
export function safeSessionStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const CHANGELOG = [
  "Versão 8.0b - Correção Geral de Assinaturas, Remoção do Mural & Atualização Sob Demanda",
  "Remoção definitiva e completa do módulo de Mural descontinuado, correção no carregamento e renderização de assinaturas (diretor, reitor e bispos/responsáveis) em dispositivos móveis (iOS/Safari/Android), e nova ferramenta de sincronização profunda e atualização sob demanda sem travar ou deixar o app desatualizado.",
  "Versão 7.9b - Check-in em Lote, Cartaz QR Code de Presença & Otimizações",
  "Check-in de todos os inscritos com um clique, inclusão de participantes pós-encerramento pelo administrador, geração de cartazes com QR Code para lista de presença digital com controle configurável de janelas de horários e liberação manual, remoção do rótulo 'indisponível' em agendamentos e correção de dados episcopais.",
  "Versão 7.8b - Acesso Direto a Certificados & Gerenciador de Inscrição de E-mails",
  "Acesso imediato à aba Certificados da Minha ID ao clicar em links recebidos por e-mail (sem exibição de tela de boas-vindas), controle de notificações por e-mail no perfil do usuário e link de descadastramento (opt-out) com 1 clique no rodapé dos e-mails.",
  "Versão 7.7b - Branding Davvero System & Notificações de Certificados e Carteirinhas",
  "Padronização da identidade visual de e-mails com a logo do Davvero System, notificações automatizadas para organizadores e participantes sobre disponibilidade de certificados, e disparo de e-mails para alunos quando a carteirinha for recusada ou desativada.",
  "Versão 7.6b - Multi-E-mails de Notificações & Sugestões de Edição",
  "Suporte a múltiplos destinatários para notificações da secretaria com gerenciador visual de e-mails (tags), disparo automático de alertas em sugestões de alteração de perfil e novo modelo de e-mail personalizável para edição cadastral com suporte a provedor Google Workspace (FAJOPA).",
  "Versão 7.5b - Otimização e Limpeza",
  "Limpeza minuciosa no código fonte, remoção de lixos gerados e bibliotecas obsoletas otimizando a velocidade e o tamanho da aplicação. Integração aprimorada do modal de confirmação de inscrição para eventos do Google Forms.",
  "Versão 7.4b - Estabilidade do Controle da Doblô e Otimizações",
  "Correção e aprimoramento no gerenciamento de registros da Doblô para administradores e condutores, persistência completa de seminários e quilometragem decimal.",
  "Versão 7.3b - Emissão e Validação Avançada de Certificados",
  "Suporte a logos e assinaturas com transparência, proporção estrita A4 Paisagem (297x210mm), novos temas ornamentados e correção na validação de participantes e organizadores.",
  "Versão 7.2b - Simplificação de Abas do Seminário",
  "Consolidação das opções de seminário na ID do aluno e alertas em tempo real.",
  "Versão 7.1b - Atualização de Atendimentos e Correções",
  "Renomeada a seção de Atendimentos para Seminário em todas as interfaces. Removida a opção Acadêmico do mural.",
  "Versão 7.0b - Fluxo de Eventos e Novidades",
  "Adicionados links rápidos de Sophia/Biblioteca, fixação de eventos, histórico no clique da versão, entre outras correções de interface.",
  "Versão 6.9b - Integração da Biblioteca Pessoal",
  "Adicionada nova guia com acesso ao acervo digital institucional.",
  "Versão 6.8b - Proteção Contra Loop e Foto na Verificação",
  "Correções aplicadas na ferramenta de atualizações automáticas e correção de foto oculta no painel de verificação de usuários.",
  "Versão 6.7b - Acesso com Biometria",
  "Versão 6.6b - Melhorias Gerais",
  "Versão 6.5b - Novos Efeitos Sonoros para interações",
  "Versão 6.4b - Efeitos Sonoros e Painel de Ferramentas",
  "Versão 6.3b - Melhorias na Gestão de Agendamentos e PDF",
  "Versão 6.2b - Correção e Exibição de Inscritos",
  "Versão 6.1b - Portal Católico e Animação de QR Code",
  "Versão 6.0b - Vínculos e Novos Links na Liturgia",
  "Expansão dos vínculos institucionais e novos atalhos litúrgicos (Orações, Notícias, etc)!",
  "Versão 5.9b - Melhorias Visuais e de Usabilidade",
  "Aprimoramento na interface de instalação e modalidades de exclusão/segurança. Otimizadas as posições dos Modais em todas as telas.",
  "Versão 5.8b - Níveis de Acesso para Administradores",
  "Painel de controle para o Super Admin gerenciar múltiplas contas (Portaria/Check-in, Admin), além de logs analíticos.",
  "Versão 5.7b - Termos de Uso e LGPD",
  "Adicionados Termos de Uso e privacidade (LGPD), obrigatórios para criação de conta ou acesso para usuários antigos. Implementado sistema global de controle de versão dos termos.",
  "Versão 5.6b - Melhorias na Gestão de Conta e Configurações",
  "Adicionado painel 'Minha Conta' para edição de dados pessoais do aluno e ajustes na interface e sistema de backup do painel administrativo.",
  "Versão 5.5b - Atualização do Sistema",
  "Simplificação e Foco: Redução de campos obsoletos (RG) em formulários e otimização do modal de novidades.",
  "Versão 5.4b - Notificações Push e IA em Português",
  "Push Nativo: Receba avisos no celular e Windows mesmo fora do aplicativo. IA: Chat agora responde nativamente em Português.",
  "Versão 5.3b - Agendamentos e Trocas de Horário",
  "Atendimentos: Visualização de horários vagos e alteração de data/hora pelo aluno com notificação ao profissional.",
];
