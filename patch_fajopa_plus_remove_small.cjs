const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{settings\.fajopaPlusEnabled && \(\s*<a\s*href=\{settings\.fajopaPlusUrl\}[\s\S]*?<\/a>\s*\)\}/g;
file = file.replace(regex, "");

fs.writeFileSync('src/App.tsx', file);
