const fs = require('fs');
let c = fs.readFileSync('src/components/SchedulingManager.tsx', 'utf8');

const searchStr = `            <div key={prof.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
              
              <div className="flex items-center gap-4 w-full">`;

const replaceStr = `            <div key={prof.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-4 relative">
              <div className="absolute top-4 right-4">
                {prof.appointmentLink ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold shadow-sm border border-emerald-200 dark:border-emerald-800/50">Link Ativo</span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-slate-700">Sem Link</span>
                )}
              </div>
              <div className="flex items-center gap-4 w-full pr-20">`;

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/SchedulingManager.tsx', c);
