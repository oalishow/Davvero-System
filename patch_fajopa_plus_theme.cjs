const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  /className="relative group flex items-center justify-center py-4 w-full max-w-sm rounded-2xl bg-\[#020617\] text-white font-black uppercase tracking-widest overflow-hidden transition-all duration-500 hover:scale-\[1\.02\] active:scale-95 shadow-\[0_0_20px_rgba\(56,189,248,0\.15\)\] hover:shadow-\[0_0_30px_rgba\(56,189,248,0\.3\)\] border border-slate-800"/,
  'className="relative group flex items-center justify-center py-4 w-full max-w-sm rounded-2xl bg-white dark:bg-[#020617] text-slate-900 dark:text-white font-black uppercase tracking-widest overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:shadow-[0_0_30px_rgba(56,189,248,0.3)] border border-slate-200 dark:border-slate-800"'
);

file = file.replace(
  /<span className="text-white drop-shadow-md glitch-text-hover-only">FAJOPA<\/span>/,
  '<span className="text-slate-900 dark:text-white drop-shadow-md glitch-text-hover-only">FAJOPA</span>'
);

fs.writeFileSync('src/App.tsx', file);
