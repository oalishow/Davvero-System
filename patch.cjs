const fs = require('fs');

// 1. Update StudentPortal.tsx
let sp = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

// Replace the two buttons with one
const oldButtons = `            {(member?.roles?.some(r => ["SEMINARISTA", "PADRE", "REITOR", "VICE-REITOR", "PSICÓLOGA", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL"].includes(r.toUpperCase()))) && (
              <>
                <button
                  onClick={() => setActiveTab("appointments")}
                  className={\`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border \${
                    activeTab === "appointments"
                      ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                  } \${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}\`}
                >
                  <HeartHandshake className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Seminário</span>
                </button>
                <button
                  onClick={() => setActiveTab("seminary_events")}
                  className={\`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border \${
                    activeTab === "seminary_events"
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                  } \${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}\`}
                >
                  <CalendarHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Seminário</span>
                </button>
              </>
            )}`;

const newButton = `            {(member?.roles?.some(r => ["SEMINARISTA", "PADRE", "REITOR", "VICE-REITOR", "PSICÓLOGA", "DIRETOR ESPIRITUAL", "DIRETORA ESPIRITUAL"].includes(r.toUpperCase()))) && (
              <button
                onClick={() => setActiveTab("seminary_events")}
                className={\`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border \${
                  activeTab === "seminary_events"
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                } \${member?.isApproved === false ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}\`}
              >
                <CalendarHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Eventos Seminário</span>
              </button>
            )}`;

sp = sp.replace(oldButtons, newButton);
fs.writeFileSync('src/components/StudentPortal.tsx', sp);

// 2. Update ChangelogModal.tsx
let cl = fs.readFileSync('src/components/ChangelogModal.tsx', 'utf8');
cl = cl.replace('current: true,', 'current: false,');
const newLog = `    {
      version: 'v7.2b',
      title: 'Simplificação de Abas do Seminário',
      changes: [
        'Consolidação das opções de seminário na ID do aluno, alterando para apenas uma aba de eventos.',
        'Feedback visual resiliente de notificações no perfil e alertas em tempo real.'
      ],
      current: true,
    },
    {`;
cl = cl.replace('    {', newLog);
fs.writeFileSync('src/components/ChangelogModal.tsx', cl);
