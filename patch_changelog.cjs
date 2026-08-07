const fs = require('fs');
let constants = fs.readFileSync('src/lib/constants.ts', 'utf8');

constants = constants.replace('export const APP_VERSION = "7.0b";', 'export const APP_VERSION = "7.1b";');
constants = constants.replace('export const APP_BUILD = "22.06.2026";', 'export const APP_BUILD = "06.08.2026";');

// Update CHANGELOG
constants = constants.replace(
  /export const CHANGELOG = \[\n/,
  'export const CHANGELOG = [\n  "Versão 7.1b - Atualização de Atendimentos e Correções",\n  "Renomeada a seção de Atendimentos para Seminário em todas as interfaces. Removida a opção Acadêmico do mural.",\n'
);

fs.writeFileSync('src/lib/constants.ts', constants);

let changelogModal = fs.readFileSync('src/components/ChangelogModal.tsx', 'utf8');

changelogModal = changelogModal.replace(
  "  const versions = [",
  `  const versions = [
    {
      version: 'v7.1b',
      title: 'Atualização de Atendimentos e Correções',
      changes: [
        'Renomeada a aba e nomenclaturas de Atendimentos para Seminário em toda a interface do aluno e administrador.',
        'No Mural do WhatsApp, a opção "Acadêmico (FAJOPA)" foi removida, mantendo exclusivamente as notificações de Seminário.'
      ],
      current: true,
    },`
);
changelogModal = changelogModal.replace(
  "      version: 'v7.0b',\n      title: 'Melhorias de Solicitações e Design',\n      changes: [\n        'Adicionado Modal de confirmação visual para novo cadastro/primeiro acesso.',\n        'Ao entrar em evento, botões sugerem primeiro acesso se aplicável.',\n        'Membros excluídos ou pendentes não aparecem na listagem de profissionais/agendamentos ou lista de presença geral.',\n        'Design refinado do atalho da biblioteca.',\n        'Removida a opção de adicionar novos cursos durante a atualização de membros.'\n      ],\n      current: true,",
  "      version: 'v7.0b',\n      title: 'Melhorias de Solicitações e Design',\n      changes: [\n        'Adicionado Modal de confirmação visual para novo cadastro/primeiro acesso.',\n        'Ao entrar em evento, botões sugerem primeiro acesso se aplicável.',\n        'Membros excluídos ou pendentes não aparecem na listagem de profissionais/agendamentos ou lista de presença geral.',\n        'Design refinado do atalho da biblioteca.',\n        'Removida a opção de adicionar novos cursos durante a atualização de membros.'\n      ],\n      current: false,"
);

fs.writeFileSync('src/components/ChangelogModal.tsx', changelogModal);
console.log("Patched changelog and constants");
