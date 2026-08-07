const fs = require('fs');
let content = fs.readFileSync('src/components/ImportWhatsappModal.tsx', 'utf8');

content = content.replace(
    `const dateMatch = line.match(/(^|\\s)(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?/);
      if (dateMatch && !line.includes('h:')) {
        const day = dateMatch[2].padStart(2, '0');
        const month = dateMatch[3].padStart(2, '0');
        const year = dateMatch[4] ? (dateMatch[4].length === 2 ? \`20\${dateMatch[4]}\` : dateMatch[4]) : currentYear.toString();`,
    `const dateMatch = line.match(/(?:^|\\s|\\*|-|_)(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?/);
      if (dateMatch && !line.match(/^(\\d{1,2})(?:h|:00)?/i)) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3] ? (dateMatch[3].length === 2 ? \`20\${dateMatch[3]}\` : dateMatch[3]) : currentYear.toString();`
);

fs.writeFileSync('src/components/ImportWhatsappModal.tsx', content);
console.log("Patched ImportWhatsappModal");
