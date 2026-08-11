const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

file = file.replace(
  /const \[appointmentsEnabled, setAppointmentsEnabled\] = useState\(cloudSettings\.appointmentsEnabled \?\? true\);/,
  "const [appointmentsEnabled, setAppointmentsEnabled] = useState(cloudSettings.appointmentsEnabled ?? true);\n  const [appointmentsExternalLink, setAppointmentsExternalLink] = useState(cloudSettings.appointmentsExternalLink || '');"
);

file = file.replace(
  /appointmentsEnabled,(\s+)professionals,/,
  "appointmentsEnabled,\n        appointmentsExternalLink,$1professionals,"
);

file = file.replace(
  /<label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">\s*<input\s*type="checkbox"\s*checked=\{appointmentsEnabled\}\s*onChange=\{\(e\) => setAppointmentsEnabled\(e\.target\.checked\)\}\s*className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"\s*\/>\s*Exibir "Seminário" no App\s*<\/label>/,
  `<label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={appointmentsEnabled}
                          onChange={(e) => setAppointmentsEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        Exibir "Seminário" no App
                      </label>
                      <div className="mt-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Link Externo para Agendamentos (WhatsApp/Google Agenda)</label>
                        <input
                          type="text"
                          value={appointmentsExternalLink}
                          onChange={e => setAppointmentsExternalLink(e.target.value)}
                          placeholder="Ex: https://chat.whatsapp.com/..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none font-bold text-slate-700 dark:text-slate-300 focus:border-sky-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Se preenchido, o sistema de agendamentos interno será desativado e este link será exibido.</p>
                      </div>`
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
