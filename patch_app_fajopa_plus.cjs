const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  /\{\(settings\.sophiaEnabled \|\| settings\.libraryEnabled \|\| settings\.avaEnabled \|\| settings\.contemplacaoEnabled\)/g,
  '{(settings.fajopaPlusEnabled || settings.sophiaEnabled || settings.libraryEnabled || settings.avaEnabled || settings.contemplacaoEnabled)'
);

file = file.replace(
  /\[settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length === 4\s*\?\s*"grid-cols-2 lg:grid-cols-4"\s*:\s*\[settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length === 3\s*\?\s*"grid-cols-3"\s*:\s*\[settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length === 2\s*\?\s*"grid-cols-2"\s*:\s*"grid-cols-1"/g,
  `[settings.fajopaPlusEnabled, settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length >= 4 
                 ? "grid-cols-2 lg:grid-cols-4" 
                 : [settings.fajopaPlusEnabled, settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 3
                ? "grid-cols-3"
                : [settings.fajopaPlusEnabled, settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 2
                ? "grid-cols-2"
                : "grid-cols-1"`
);

const buttonString = `              {settings.fajopaPlusEnabled && (
                <a 
                  href={settings.fajopaPlusUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-1 sm:px-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-tighter transition-all duration-300 hover:from-amber-600 hover:to-amber-700 hover:-translate-y-1 hover:shadow-lg active:scale-95 border border-amber-400 dark:border-amber-700/50 min-w-0 text-center group shadow-md"
                >
                  <Sparkles className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-300 text-amber-100" />
                  <span className="w-full px-1 leading-tight whitespace-normal">FAJOPA PLUS</span>
                </a>
              )}
`;

file = file.replace(
  /\{settings\.sophiaEnabled && \(/,
  buttonString + '              {settings.sophiaEnabled && ('
);

fs.writeFileSync('src/App.tsx', file);
