const fs = require('fs');
let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const search = `{settings.useGoogleScriptCertificate && settings.googleScriptCertificateUrl && (`
const replace = `{settings.useGoogleScriptCertificate && (settings.certificateValidationUrl || settings.googleScriptCertificateUrl) && (`

file = file.replace(search, replace);

const search2 = `const url = new URL(settings.googleScriptCertificateUrl);`
const replace2 = `const url = new URL(settings.certificateValidationUrl || settings.googleScriptCertificateUrl);`
file = file.replace(search2, replace2);

const search3 = `window.open(settings.googleScriptCertificateUrl, '_blank');`
const replace3 = `window.open(settings.certificateValidationUrl || settings.googleScriptCertificateUrl, '_blank');`
file = file.replace(search3, replace3);

fs.writeFileSync('src/components/StudentPortal.tsx', file);
