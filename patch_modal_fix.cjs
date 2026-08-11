const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

file = file.replace(
  /\{useGoogleScriptCertificate && \(\s*<div>/g,
  '{useGoogleScriptCertificate && (\n                        <>\n                          <div>'
);

file = file.replace(
  /<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>/g,
  '<\/div>\n                        </>\n                      )}\n                    </div>\n                  </div>\n                </div>'
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
