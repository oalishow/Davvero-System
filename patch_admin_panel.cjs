const fs = require('fs');
let file = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

file = file.replace(
  /\{activeTab === "appointments" && \(\s*<div className="space-y-4">/,
  `{activeTab === "appointments" && (
        <div className="space-y-4">
          {settings?.appointmentsExternalLink ? (
            <div className="bg-sky-50 dark:bg-sky-900/20 p-6 rounded-2xl border border-sky-100 dark:border-sky-800 text-center text-sky-800 dark:text-sky-300">
              <h3 className="text-lg font-bold mb-2">Modo Simplificado Ativo</h3>
              <p className="text-sm opacity-80 mb-4">Os agendamentos estão configurados para usar um link externo (WhatsApp/Agenda).</p>
              <button onClick={() => updateSettings({ appointmentsExternalLink: '' })} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                Restaurar Sistema Interno
              </button>
            </div>
          ) : null}`
);

fs.writeFileSync('src/components/AdminPanel.tsx', file);
