const fs = require('fs');
let file = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');

if (!file.includes('fajopaPlusEnabled')) {
  file = file.replace(
    /avaEnabled: boolean;/g,
    'avaEnabled: boolean;\n  fajopaPlusUrl: string;\n  fajopaPlusEnabled: boolean;'
  );
  file = file.replace(
    /avaEnabled: true,/g,
    "avaEnabled: true,\n  fajopaPlusUrl: 'https://plus.fajopa.org',\n  fajopaPlusEnabled: true,"
  );
  fs.writeFileSync('src/context/SettingsContext.tsx', file);
}
