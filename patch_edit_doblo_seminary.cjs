const fs = require('fs');
let content = fs.readFileSync('src/components/EditDobloModal.tsx', 'utf8');

if (!content.includes('seminary: string;')) {
    content = content.replace(
        `name: string;`,
        `name: string;
  seminary?: string;`
    );
}

if (!content.includes('AVAILABLE_SEMINARIES')) {
    content = content.replace(
        `import { useDialog } from "../context/DialogContext";`,
        `import { useDialog } from "../context/DialogContext";
import { AVAILABLE_SEMINARIES } from "../types";`
    );
}

if (!content.includes('const [seminary, setSeminary]')) {
    content = content.replace(
        `const [name, setName] = useState(log.name);`,
        `const [name, setName] = useState(log.name);
  const [seminary, setSeminary] = useState(log.seminary || "");`
    );
}

if (!content.includes('seminary,')) {
    content = content.replace(
        `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, log.id), {
        name,`,
        `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, log.id), {
        name,
        seminary,`
    );
}

// Add the input for seminary
if (!content.includes('Seminário / Origem')) {
    content = content.replace(
        `<div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nome do Condutor</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
          </div>`,
        `<div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nome do Condutor</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Seminário / Origem</label>
            <select value={seminary} onChange={e => setSeminary(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-slate-300 focus:border-emerald-500">
              <option value="">Selecione...</option>
              {AVAILABLE_SEMINARIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>`
    );
}

fs.writeFileSync('src/components/EditDobloModal.tsx', content);
