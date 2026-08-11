const fs = require('fs');
let file = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

const replacement = `      {activeSubTab === "agendamentos" && (
        <>
          {cloudSettings?.appointmentsExternalLink ? (
            <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center mb-6">
                <HeartHandshake className="w-10 h-10 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase mb-4">Agendamentos</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                O sistema de agendamentos utiliza um canal externo (WhatsApp ou Agenda). Clique no botão abaixo para acessar.
              </p>
              <a 
                href={cloudSettings.appointmentsExternalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-modern px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-1 active:scale-95"
              >
                Acessar Canal de Agendamentos
              </a>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">`;

file = file.replace(
  /\{activeSubTab === "agendamentos" && \(\s*<>\s*<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">/,
  replacement
);

// We also need to add a closing tag `)}` before the `{activeSubTab === "grupos" && (` part.
const endReplacement = `        </div>
        )}
        </>
      )}
      {activeSubTab === "grupos" && (`;

file = file.replace(
  /<\/div>\s*\)\}\s*<\/>\s*\)\}\s*\{activeSubTab === "grupos" && \(/,
  endReplacement
);

fs.writeFileSync('src/components/PublicAppointmentsList.tsx', file);
