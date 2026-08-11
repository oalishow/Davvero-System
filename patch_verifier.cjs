const fs = require('fs');

let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

file = file.replace(/settings\.useGoogleScriptCertificate && settings\.googleScriptCertificateUrl/g, "settings.useGoogleScriptCertificate && (settings.certificateValidationUrl || settings.googleScriptCertificateUrl)");

file = file.replace(/href=\{settings\.googleScriptCertificateUrl\}/g, "href={settings.certificateValidationUrl || settings.googleScriptCertificateUrl}");

file = file.replace(/src=\{settings\.googleScriptCertificateUrl\}/g, "src={settings.certificateValidationUrl || settings.googleScriptCertificateUrl}");

fs.writeFileSync('src/components/Verifier.tsx', file);
