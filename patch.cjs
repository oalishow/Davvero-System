const fs = require('fs');
let content = fs.readFileSync('src/components/ImportWhatsappModal.tsx', 'utf8');

content = content.replace(
    `<option value="">-- Selecione o Aluno correspondente --</option>`,
    `<option value="unmatched">-- Não Correspondente (Manter nome) --</option>\n                                        <option value="livre">-- Deixar Horário Livre --</option>`
);

content = content.replace(
    `value={slot.matchedMemberId || ""}`,
    `value={slot.matchedMemberId || "unmatched"}`
);

content = content.replace(
    `border-red-300 dark:border-red-800 focus:ring-red-500`,
    `border-amber-300 dark:border-amber-800 focus:ring-amber-500`
);

content = content.replace(
    `text-red-500 absolute right-2.5`,
    `text-amber-500 absolute right-2.5`
);

fs.writeFileSync('src/components/ImportWhatsappModal.tsx', content);
console.log("Replaced");
