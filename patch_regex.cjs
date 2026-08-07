const fs = require('fs');
let content = fs.readFileSync('src/components/ImportWhatsappModal.tsx', 'utf8');

content = content.replace(
    `const cleanName = rawName.replace(/\\(\\w+\\)/g, '').replace(/[-*(]*cancelado[)*]*/i, '').trim();`,
    `const cleanName = rawName.replace(/[-*(]*cancelado[)*]*/i, '').trim();`
);

fs.writeFileSync('src/components/ImportWhatsappModal.tsx', content);
console.log("Patched regex");
