const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

file = file.replace(
  /\{settings\.useGoogleScriptCertificate && \(settings\.certificateValidationUrl \|\| settings\.googleScriptCertificateUrl\) \? \(/g,
  '{(settings.certificateValidationUrl || settings.googleScriptCertificateUrl) ? ('
);

file = file.replace(
  /A validação por Google Script não está ativada nas configurações ou o link não foi fornecido\./g,
  'Nenhum link de validação de certificados foi configurado.'
);

fs.writeFileSync('src/components/Verifier.tsx', file);
