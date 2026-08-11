const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// For global professionals
file = file.replace(
  /<input type="text" placeholder="Ex: DIRETOR ESPIRITUAL" value=\{prof\.role\} onChange=\{\(e\) => updateGlobalProfessional\(prof\.id, "role", e\.target\.value\.toUpperCase\(\)\)\} className="w-full bg-slate-50 dark:bg-slate-900\/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1\.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500\/50" \/>\s*<\/div>\s*<\/div>/,
  `<input type="text" placeholder="Ex: DIRETOR ESPIRITUAL" value={prof.role} onChange={(e) => updateGlobalProfessional(prof.id, "role", e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Link de Agendamento (WhatsApp / Agenda)</label>
                                  <input type="text" placeholder="Ex: https://chat.whatsapp.com/..." value={prof.appointmentLink || ''} onChange={(e) => updateGlobalProfessional(prof.id, "appointmentLink", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                              </div>`
);

// For seminary professionals
file = file.replace(
  /<input type="text" placeholder="Cargo\/Função" value=\{prof\.role\} onChange=\{e => updateSeminaryProfessional\(sem, prof\.id, "role", e\.target\.value\.toUpperCase\(\)\)\} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1\.5 text-xs outline-none" \/>\s*<\/div>/,
  `<input type="text" placeholder="Cargo/Função" value={prof.role} onChange={e => updateSeminaryProfessional(sem, prof.id, "role", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <div className="col-span-2">
                                              <input type="text" placeholder="Link de Agendamento (opcional)" value={prof.appointmentLink || ''} onChange={e => updateSeminaryProfessional(sem, prof.id, "appointmentLink", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            </div>
                                          </div>`
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
