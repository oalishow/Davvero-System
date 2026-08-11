const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const oldHeroRegex = /\{settings\.fajopaPlusEnabled && \(\s*<div className="flex justify-center mb-6 no-print print:hidden">[\s\S]*?<\/div>\s*\)\}/;

const newFajopaPlusHero = `          {settings.fajopaPlusEnabled && (
            <div className="flex justify-center mb-6 mt-2 no-print print:hidden">
              <a 
                href={settings.fajopaPlusUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative group flex items-center justify-center py-4 w-full max-w-sm rounded-2xl bg-[#020617] text-white font-black uppercase tracking-widest overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:shadow-[0_0_30px_rgba(56,189,248,0.3)] border border-slate-800"
              >
                {/* Animated Gradient Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                
                {/* Glitch/Neon Text Container */}
                <div className="relative z-10 flex items-center gap-2 drop-shadow-md text-xl sm:text-2xl">
                  <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">FAJOPA</span>
                  <span className="text-sky-500 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">PLUS</span>
                </div>
              </a>
            </div>
          )}`;

file = file.replace(oldHeroRegex, newFajopaPlusHero);

fs.writeFileSync('src/App.tsx', file);
