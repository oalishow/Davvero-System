const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

if (!content.includes('deletedBy?: string;')) {
    content = content.replace(
        `deletedAt?: string;`,
        `deletedAt?: string;\n  deletedBy?: string;`
    );
}

if (!content.includes('{log.deletedBy && <span className="text-[10px] ml-2 text-rose-500">Excluído por: {log.deletedBy}</span>}')) {
    content = content.replace(
        `<p className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate line-through">{log.name} - {log.destination} ({log.date})</p>`,
        `<p className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate line-through">{log.name} - {log.destination} ({log.date})</p>
                       {log.deletedBy && <p className="text-[10px] text-rose-500 font-bold mt-1">Excluído por: {log.deletedBy}</p>}`
    );
}
fs.writeFileSync('src/components/RecycleBinModal.tsx', content);

let content2 = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');
if (!content2.includes('deletedBy?: string;')) {
    content2 = content2.replace(
        `deletedAt?: string;`,
        `deletedAt?: string;\n  deletedBy?: string;`
    );
}

if (!content2.includes('deletedBy: currentUser?.name || "Admin"')) {
    content2 = content2.replace(
        `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: new Date().toISOString() });`,
        `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: new Date().toISOString(), deletedBy: currentUser?.name || "Admin" });`
    );
}
fs.writeFileSync('src/components/DobloControl.tsx', content2);
console.log("Patched deletedBy");
