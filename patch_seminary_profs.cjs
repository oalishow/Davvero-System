const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

file = file.replace(
  /<div className="flex-1 grid grid-cols-2 gap-2">\n\s*<input type="text" placeholder="Nome Completo" value=\{prof\.name\} onChange=\{e => updateSeminaryProfessional\(sem, prof\.id, "name", e\.target\.value\.toUpperCase\(\)\)\} className=".*?" \/>\n\s*<input type="text" placeholder="Cargo\/Função" value=\{prof\.role\} onChange=\{e => updateSeminaryProfessional\(sem, prof\.id, "role", e\.target\.value\.toUpperCase\(\)\)\} className=".*?" \/>\n\s*<div className="col-span-2">\n\s*<input type="text" placeholder="Link de Agendamento \(opcional\)" value=\{prof\.appointmentLink \|\| ''\} onChange=\{e => updateSeminaryProfessional\(sem, prof\.id, "appointmentLink", e\.target\.value\)\} className=".*?" \/>\n\s*<\/div>\n\s*<\/div>/,
  `<div className="flex-1 grid grid-cols-2 gap-2">
                                            <input type="text" placeholder="Nome Completo" value={prof.name} onChange={e => updateSeminaryProfessional(sem, prof.id, "name", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="Cargo/Função" value={prof.role} onChange={e => updateSeminaryProfessional(sem, prof.id, "role", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="Link de Agendamento (opcional)" value={prof.appointmentLink || ''} onChange={e => updateSeminaryProfessional(sem, prof.id, "appointmentLink", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="WhatsApp (ex: (00) 00000-0000)" value={prof.whatsappNumber || ''} onChange={e => updateSeminaryProfessional(sem, prof.id, "whatsappNumber", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                          </div>`
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
