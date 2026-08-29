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
export const APP_VERSION = "7.5b";
export const APP_BUILD = "28.08.2026";
export const SETTINGS_DOC_PATH = (appId: string) =>
  `artifacts/${appId}/public/data/students/_settings_global`;
export const ASSETS_DOC_PATH = (appId: string, assetType: string) =>
  `artifacts/${appId}/public/data/students/_asset_${assetType}`;
export const CHANGELOG = [
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
