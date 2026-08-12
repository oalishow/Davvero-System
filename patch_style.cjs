const fs = require('fs');
let c = fs.readFileSync('src/components/AppointmentsPanel.tsx', 'utf8');

const searchStr = `            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Meu Seminário</span>`;

const replaceStr = `            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col" style={{gridColumn: '1 / -1'}}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Meu Seminário</span>`;

c = c.replace(searchStr, replaceStr);

const searchStr2 = `          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Meu Seminário</span>`;

const replaceStr2 = `          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700" style={{gridColumn: '1 / -1'}}>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Meu Seminário</span>`;

c = c.replace(searchStr2, replaceStr2);

fs.writeFileSync('src/components/AppointmentsPanel.tsx', c);
