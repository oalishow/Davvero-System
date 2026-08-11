const fs = require('fs');
let file = fs.readFileSync('src/components/SchedulingManager.tsx', 'utf8');

file = file.replace(
  /appointmentType: "whatsapp"/,
  'appointmentType: "whatsapp",\n        whatsappNumber: ""'
);

file = file.replace(
  /<div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">([\s\S]*?)<\/div>\s*<\/div>\s*<button/g,
  `<div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Tipo de Link</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {getIcon(prof.appointmentType)}
                    </div>
                    <select
                      value={prof.appointmentType || "whatsapp"}
                      onChange={(e) => handleUpdate(prof.id, "appointmentType", e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none"
                    >
                      <option value="whatsapp">WhatsApp (Grupo/Privado)</option>
                      <option value="google_calendar">Google Agenda</option>
                      <option value="other">Outro Link</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">URL de Redirecionamento</label>
                  <input
                    type="text"
                    value={prof.appointmentLink || ""}
                    onChange={(e) => handleUpdate(prof.id, "appointmentLink", e.target.value)}
                    placeholder="Ex: https://..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">WhatsApp (Opcional)</label>
                  <input
                    type="text"
                    value={prof.whatsappNumber || ""}
                    onChange={(e) => handleUpdate(prof.id, "whatsappNumber", e.target.value)}
                    placeholder="Ex: (00) 00000-0000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                </div>
              </div>
              <button`
);

fs.writeFileSync('src/components/SchedulingManager.tsx', file);
