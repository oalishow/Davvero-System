const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `import { Member } from "../types";`,
    `import { Member, AVAILABLE_SEMINARIES } from "../types";`
);

content = content.replace(
    `name: string;
  date: string;`,
    `name: string;
  seminary?: string;
  date: string;`
);

content = content.replace(
    `const [name, setName] = useState(currentUser?.name || "");

  useEffect(() => {
    if (currentUser?.name) {
      setName(currentUser.name);
    }
  }, [currentUser?.name]);`,
    `const [name, setName] = useState(currentUser?.name || "");
  const [seminary, setSeminary] = useState(currentUser?.seminary || "");

  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name);
    if (currentUser?.seminary) setSeminary(currentUser.seminary);
  }, [currentUser?.name, currentUser?.seminary]);`
);

content = content.replace(
    `await addDoc(collection(db, \`artifacts/\${appId}/public/data/doblo_logs\`), {
        name,
        date,`,
    `await addDoc(collection(db, \`artifacts/\${appId}/public/data/doblo_logs\`), {
        name,
        seminary,
        date,`
);

// We need to add the seminary select to the form.
content = content.replace(
    `<div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Nome do Condutor</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>`,
    `<div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Nome do Condutor</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Seminário / Origem</label>
              <select value={seminary} onChange={e => setSeminary(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500">
                 <option value="">Selecione...</option>
                 {AVAILABLE_SEMINARIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
