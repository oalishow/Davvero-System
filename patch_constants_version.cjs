const fs = require('fs');
let file = fs.readFileSync('src/lib/constants.ts', 'utf8');

file = file.replace(/APP_VERSION = "7\.1b";/g, 'APP_VERSION = "7.2b";');
file = file.replace(/APP_BUILD = "06\.08\.2026";/g, 'APP_BUILD = "11.08.2026";');

fs.writeFileSync('src/lib/constants.ts', file);
