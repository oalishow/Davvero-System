const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `<th className="px-4 py-3">Condutor / Destino</th>`,
    `<th className="px-4 py-3">Condutor / Destino</th>`
);

content = content.replace(
    `<div className="font-medium text-slate-800 dark:text-slate-200">{log.name}</div>
                        <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={log.destination}>{log.destination || "-"}</div>`,
    `<div className="font-medium text-slate-800 dark:text-slate-200">{log.name}</div>
                        {log.seminary && <div className="text-[10px] text-emerald-600 dark:text-emerald-400 max-w-[150px] truncate" title={log.seminary}>{log.seminary}</div>}
                        <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={log.destination}>{log.destination || "-"}</div>`
);

content = content.replace(
    `head: [['Data', 'Condutor', 'Destino', 'Saída', 'Chegada', 'Km Total', 'Assinado']],`,
    `head: [['Data', 'Condutor', 'Seminário', 'Destino', 'Saída', 'Chegada', 'Km Total', 'Assinado']],`
);

content = content.replace(
    `log.name,
          log.destination || "-",`,
    `log.name,
          log.seminary || "-",
          log.destination || "-",`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
