const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the fajopaPlusEnabled block from the grid
file = file.replace(
  /\{\(settings\.fajopaPlusEnabled \|\| settings\.sophiaEnabled \|\| settings\.libraryEnabled \|\| settings\.avaEnabled \|\| settings\.contemplacaoEnabled\)/g,
  '{(settings.sophiaEnabled || settings.libraryEnabled || settings.avaEnabled || settings.contemplacaoEnabled)'
);

file = file.replace(
  /\[settings\.fajopaPlusEnabled, settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length >= 4\s*\?\s*"grid-cols-2 lg:grid-cols-4"\s*:\s*\[settings\.fajopaPlusEnabled, settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length === 3\s*\?\s*"grid-cols-3"\s*:\s*\[settings\.fajopaPlusEnabled, settings\.sophiaEnabled, settings\.libraryEnabled, settings\.avaEnabled, settings\.contemplacaoEnabled\]\.filter\(Boolean\)\.length === 2\s*\?\s*"grid-cols-2"\s*:\s*"grid-cols-1"/g,
  `[settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 4 
                 ? "grid-cols-2 lg:grid-cols-4" 
                 : [settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 3
                ? "grid-cols-3"
                : [settings.sophiaEnabled, settings.libraryEnabled, settings.avaEnabled, settings.contemplacaoEnabled].filter(Boolean).length === 2
                ? "grid-cols-2"
                : "grid-cols-1"`
);

const fajopaPlusButton = `
              {settings.fajopaPlusEnabled && (
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

file = file.replace(fajopaPlusButton, "");

const fajopaPlusHero = `
          {settings.fajopaPlusEnabled && (
            <div className="flex justify-center mb-6 no-print print:hidden">
              <a 
                href={settings.fajopaPlusUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative group flex items-center justify-center gap-3 py-4 px-8 w-full max-w-sm rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white font-black uppercase tracking-widest shadow-xl shadow-amber-500/30 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/40 hover:-translate-y-1 active:scale-95 border border-amber-300/50"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <Sparkles className="w-6 h-6 animate-pulse text-amber-100 relative z-10" />
                <span className="text-sm sm:text-base relative z-10 drop-shadow-md">Acessar FAJOPA PLUS</span>
                <Sparkles className="w-6 h-6 animate-pulse text-amber-100 relative z-10" />
              </a>
            </div>
          )}
`;

file = file.replace(
  /\{\(settings\.sophiaEnabled \|\| settings\.libraryEnabled \|\| settings\.avaEnabled \|\| settings\.contemplacaoEnabled\)/,
  fajopaPlusHero + '          {(settings.sophiaEnabled || settings.libraryEnabled || settings.avaEnabled || settings.contemplacaoEnabled)'
);

fs.writeFileSync('src/App.tsx', file);
