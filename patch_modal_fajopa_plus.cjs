const fs = require('fs');
let file = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

file = file.replace(
  /const \[avaLink, setAvaLink\] = useState\(cloudSettings\.avaLink \|\| 'https:\/\/fajopa\.net\/ava\/'\);/g,
  "const [fajopaPlusUrl, setFajopaPlusUrl] = useState(cloudSettings.fajopaPlusUrl || 'https://plus.fajopa.org');\n  const [fajopaPlusEnabled, setFajopaPlusEnabled] = useState(cloudSettings.fajopaPlusEnabled ?? true);\n  const [avaLink, setAvaLink] = useState(cloudSettings.avaLink || 'https://fajopa.net/ava/');"
);

file = file.replace(
  /avaLink,\s*avaEnabled,/g,
  "fajopaPlusUrl,\n        fajopaPlusEnabled,\n        avaLink,\n        avaEnabled,"
);

const fajopaPlusBlock = `                      <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                        <label className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fajopaPlusEnabled}
                            onChange={(e) => setFajopaPlusEnabled(e.target.checked)}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          Ativar Botão Destaque "FAJOPA PLUS"
                        </label>
                        {fajopaPlusEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-amber-600/70 dark:text-amber-500 uppercase mb-1">
                              Link do FAJOPA PLUS
                            </label>
                            <input
                              type="text"
                              value={fajopaPlusUrl}
                              onChange={(e) => setFajopaPlusUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                              placeholder="https://plus.fajopa.org"
                            />
                          </div>
                        )}
                      </div>
`;

file = file.replace(
  /(<div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800\/50 rounded-xl border border-slate-100 dark:border-slate-700\/50">\s*<label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">\s*<input\s*type="checkbox"\s*checked=\{sophiaEnabled\})/g,
  fajopaPlusBlock + '\n                      $1'
);

fs.writeFileSync('src/components/SettingsModal.tsx', file);
