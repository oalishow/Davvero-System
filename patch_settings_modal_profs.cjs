const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

file = file.replace(
  /                                <div className="col-span-2">\n                                  <label className="text-\[9px\] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Link de Agendamento \(WhatsApp \/ Agenda\)<\/label>\n                                  <input type="text" placeholder="Ex: https:\/\/chat\.whatsapp\.com\/..." value=\{prof\.appointmentLink \|\| ''\} onChange=\{\(e\) => updateGlobalProfessional\(prof\.id, "appointmentLink", e\.target\.value\)\} className="w-full bg-slate-50 dark:bg-slate-900\/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1\.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500\/50" \/>\n                                <\/div>/,
  `                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Tipo de Link</label>
                                  <select value={prof.appointmentType || "whatsapp"} onChange={(e) => updateGlobalProfessional(prof.id, "appointmentType", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none">
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="google_calendar">Google Agenda</option>
                                    <option value="other">Outro Link</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Link de Agendamento</label>
                                  <input type="text" placeholder="Ex: https://..." value={prof.appointmentLink || ''} onChange={(e) => updateGlobalProfessional(prof.id, "appointmentLink", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">WhatsApp (Opcional - Exibido abaixo do botão)</label>
                                  <input type="text" placeholder="Ex: (00) 00000-0000" value={prof.whatsappNumber || ''} onChange={(e) => updateGlobalProfessional(prof.id, "whatsappNumber", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>`
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
