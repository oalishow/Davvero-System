const fs = require('fs');
let content = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const bannerOld = `        <div ref={portalContainerRef} className="w-full flex flex-col items-center animate-fade-in mt-10 max-w-sm sm:max-w-[600px] mx-auto scroll-mt-[350px] sm:scroll-mt-32">
          <div className="w-full flex justify-between items-center mb-6 px-2 no-print print:hidden">`;
const bannerNew = `        <div ref={portalContainerRef} className="w-full flex flex-col items-center animate-fade-in mt-10 max-w-sm sm:max-w-[600px] mx-auto scroll-mt-[350px] sm:scroll-mt-32">
          {isSupported && !subscription && !isOverrideMode && (
             <div className="w-full mb-6 no-print">
                <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      <div className="bg-sky-500 p-2.5 rounded-xl text-white shadow-md">
                         <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Não perca nada!</h4>
                         <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Ative as notificações em segundo plano para receber avisos importantes, mesmo com o app fechado. Não gasta bateria.</p>
                      </div>
                   </div>
                   <button
                      onClick={() => {
                        playSound('click');
                        subscribe();
                      }}
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 whitespace-nowrap"
                   >
                      Ativar Notificações
                   </button>
                </div>
             </div>
          )}
          <div className="w-full flex justify-between items-center mb-6 px-2 no-print print:hidden">`;
content = content.replace(bannerOld, bannerNew);

fs.writeFileSync('src/components/StudentPortal.tsx', content);
console.log("Patched banner");
