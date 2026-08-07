const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const target1 = `    const normalizeString = (str: string) => {
      return str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\\s+/g, ' ').trim();
    };`;

content = content.replace(target1, '');

const target2 = `  const [deleteProgress, setDeleteProgress] = useState<{current: number, total: number} | null>(null);`;
const replacement2 = `  const [deleteProgress, setDeleteProgress] = useState<{current: number, total: number} | null>(null);

  const normalizeString = (str: string) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\\s+/g, ' ').trim();
  };`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched normalizeString in AdminAppointments!");
