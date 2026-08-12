const fs = require('fs');

let file = fs.readFileSync('src/components/ChangelogModal.tsx', 'utf8');

file = file.replace("current: true,", "current: false,");

const newLog = `    {
      version: 'v7.3b',
      title: 'Verificador de Certificados Duplo',
      changes: [
        'Portal de Certificados agora exibe simultaneamente a opção do FAJOPA Plus e o Davvero System.',
        'Certificados nativos passam a ser emitidos com QR Code e código de validação de autenticidade.'
      ],
      current: true,
    },
    {`;

file = file.replace("    {", newLog);
fs.writeFileSync('src/components/ChangelogModal.tsx', file);
