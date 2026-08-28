import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const versions = [
    {
      version: 'v7.4b',
      title: 'Estabilidade no Controle da Doblô e Otimizações',
      changes: [
        'Correção de permissões administrativas no painel da Doblô, garantindo edição e exclusão irrestritas para administradores.',
        'Suporte aprimorado para edição de Origem/Seminário, datas, horários e destinos no modal de edição.',
        'Tratamento automático para quilometragem com vírgula ou ponto decimal, evitando falhas de gravação.',
        'Persistência otimizada e sincronização em tempo real de logs de uso do veículo.'
      ],
      current: true,
    },
    {
      version: 'v7.3b',
      title: 'Emissão, Design e Validação de Certificados',
      changes: [
        'Suporte aprimorado para logotipos e assinaturas com fundo transparente (remoção automática de fundo branco opaco).',
        'Padronização geométrica rigorosa em proporção A4 Paisagem (297mm × 210mm) para visualização e download em alta resolução.',
        'Novos templates de certificados clássicos e contemporâneos (Esmeralda & Ouro, Excelência Navy, Renascença e Rubi).',
        'Correção e precisão no Validador Oficial com identificação estrita de participantes/organizadores por evento.',
        'Subtítulo e nomenclatura dinâmica ao baixar comprovantes de validação institucional.',
        'Portal de Certificados integrado com verificação dupla (FAJOPA Plus e Davvero System).'
      ],
      current: false,
    },
    {
      version: 'v7.2b',
      title: 'Simplificação de Abas do Seminário',
      changes: [
        'Consolidação das opções de seminário na ID do aluno, alterando para apenas uma aba de eventos.',
        'Feedback visual resiliente de notificações no perfil e alertas em tempo real.'
      ],
      current: false,
    },
    {
      version: 'v7.1b',
      title: 'Atualização de Atendimentos e Correções',
      changes: [
        'Renomeada a aba e nomenclaturas de Atendimentos para Seminário em toda a interface do aluno e administrador.',
        'No Mural do WhatsApp, a opção "Acadêmico (FAJOPA)" foi removida, mantendo exclusivamente as notificações de Seminário.'
      ],
      current: false,
    },
    {
      version: 'v7.0b',
      title: 'Melhorias de Solicitações e Design',
      changes: [
        'Adicionado Modal de confirmação visual para novo cadastro/primeiro acesso.',
        'Ao entrar em evento, botões sugerem primeiro acesso se aplicável.',
        'Membros excluídos ou pendentes não aparecem na listagem de profissionais/agendamentos ou lista de presença geral.',
        'Design refinado do atalho da biblioteca.',
        'Removida a opção de adicionar novos cursos durante a atualização de membros.'
      ],
      current: false,
    },
    {
      version: 'v6.9b',
      title: 'Integração da Biblioteca Pessoal',
      changes: [
        'Adicionada nova guia com acesso direto ao acervo digital institucional (Sophia).',
        'Melhorias de layout e visibilidade no painel de verificação de identidades.',
        'Os certificados agora podem ser consultados sem a necessidade de autenticação de administrador.'
      ],
      current: false,
    },
    {
      version: 'v6.8b',
      title: 'Proteção Contra Loop de Atualização e Correções',
      changes: [
        'Solucionado um problema em que o aplicativo entrava em loop verificando atualizações contínuas e recarregando.',
        'Corrigido problema em que a foto de passe não era exibida na tela de verificação de permissões.',
        'Incluída limitação para exibição das novidades na modal de boas-vindas.'
      ],
      current: false,
    },
    {
      version: 'v6.7b',
      title: 'Acesso com Biometria e Senha',
      changes: [
        'Adicionado suporte a métodos de biometria (Face ID, Touch ID, etc.) para desbloquear o passe.',
        'Melhorias de acesso e segurança.'
      ],
      current: false,
    },
    {
      version: 'v6.6b',
      title: 'Atualização do Sistema',
      changes: [
        'Melhorias gerais.',
        'Otimização de performance.'
      ],
      current: false,
    },
    {
      version: 'v6.3b',
      title: 'Relatórios e Otimização',
      changes: [
        'Adicionada exportação de agendamentos em PDF no Painel Admin.',
        'Filtro por profissional na geração de relatórios de agendamentos.',
        'Otimização do sistema de build e bundle do servidor.',
        'Melhorias na ordenação automática de datas e horários.',
      ],
      current: false,
    },
    {
      version: 'v6.2b',
      title: 'Melhorias de Visualização',
      changes: [
        'Aumentado o versionamento para 6.2',
        'Melhorias gerais e correções de bugs.',
      ],
      current: false,
    },
    {
      version: 'v6.1b',
      title: 'Portal Católico e Correções',
      changes: [
        'Adicionado selo "NOVO" em Ferramentas, que chegará em breve',
        'Mudança de "Liturgia" para "Portal Católico"',
        'Correção de aberturas de janelas do Portal Católico (Pocket Terço, Santo do Dia)',
        'Animação de sucesso (confirmação visual) após escaneamento bem-sucedido de QR Code'
      ],
      current: false,
    },
    {
      version: 'v6.0b',
      title: 'Links Adicionais de Liturgia',
      changes: [
        'Adicionada a seção "Orações" (Pocket Terço).',
        'Incluso atalho para o site oficial do Vaticano.',
        'Incluso atalho para Vatican News (Notícias da Igreja).',
        'Vínculos de sistema expandidos (Diretor, Reitor, etc).',
      ],
      current: false,
    },
    {
      version: 'v5.9b',
      title: 'Melhorias Visuais e de Usabilidade',
      changes: [
        'Aprimoramento na interface de instalação.',
        'Otimizada a usabilidade das abas de navegação no painel web, para acesso mobile mais fluido e intuitivo.',
        'Ajustes visuais no contador de notificações.'
      ],
      current: false,
    },
    {
      version: 'v5.8b',
      title: 'Níveis de Acesso e Gestão de Admins',
      changes: [
        'Painel para controle de múltiplas contas de administração.',
        'Níveis de acesso diferenciados: Super Admin, Administrador Padrão e Portaria/Check-in.',
        'Logs avançados de acesso e auditoria.',
      ],
      current: false,
    },
    {
      version: 'v5.7b',
      title: 'Termos de Uso e LGPD',
      changes: [
        'Adicionados Termos de Uso e privacidade (LGPD).',
        'Aceite obrigatório para novos cadastros e usuários existentes.',
        'Sistema global de controle de versão dos termos pelos administradores.'
      ],
      current: false,
    },
    {
      version: 'v5.6b',
      title: 'Melhorias na Gestão de Conta e Configurações',
      changes: [
        'Adicionado painel \'Minha Conta\' para edição de dados pessoais do aluno.',
        'Ajustes na interface e sistema de backup do painel administrativo.',
      ],
      current: false,
    },
    {
      version: 'v5.5b',
      title: 'Atualização do Sistema',
      changes: [
        'Simplificação e Foco: Redução de campos obsoletos (RG) em formulários e otimização do modal de novidades.'
      ],
      current: false,
    },
    {
      version: 'v5.4b',
      title: 'Notificações Push e Diálogos em Português',
      changes: [
        'Notificações Push: Suporte a avisos nativos no Windows, Android e iOS (Web Push).',
        'IA & Chat: Respostas da inteligência artificial agora padronizadas em Português Brasileiro (PT-BR).',
        'Sincronização: Melhorias no Service Worker para entrega em tempo real de mensagens prioritárias.'
      ],
      current: false,
    },
    {
      version: 'v5.3b',
      title: 'Agendamentos e Trocas de Horário',
      changes: [
        'Atendimentos: Visualização de horários vagos e profissionais diretamente pelo mural de Eventos/Atendimentos.',
        'Flexibilidade: Alunos agora podem trocar sua data/hora de atendimento, notificando automaticamente o profissional.'
      ],
      current: false,
    }
  ];

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[200] overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 md:p-8 w-full max-w-md animated-scale-in my-auto max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Histórico de Atualizações
          </h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 p-1.5 sm:p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-grow">
          {versions.map((v, i) => (
            <div key={v.version} className={`relative pl-4 border-l-2 ${i === 0 ? 'border-sky-500' : 'border-slate-300 dark:border-slate-600'}`}>
              <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${i === 0 ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]' : 'bg-slate-400'}`}></div>
              <span className={`text-[10px] font-bold tracking-widest uppercase ${i === 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`}>
                {v.version} {v.current && '(Atual)'}
              </span>
              <h4 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 mt-1">{v.title}</h4>
              <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1.5 list-disc pl-4">
                {v.changes.map((change, idx) => (
                  <li key={idx}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
