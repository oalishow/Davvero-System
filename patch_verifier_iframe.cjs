const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const originalIframeBlock = `              <div className="relative w-full h-[75vh] min-h-[600px] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden bg-white dark:bg-slate-800">
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 animate-pulse">Carregando sistema de verificações...</p>
                  </div>
                )}
                <iframe 
                  src={settings.certificateValidationUrl || settings.googleScriptCertificateUrl} 
                  className={\`w-full h-full transition-opacity duration-500 \${iframeLoaded ? 'opacity-100' : 'opacity-0'}\`}
                  title="Validação de Certificados"
                  allow="clipboard-read; clipboard-write; display-capture"
                  onLoad={() => setIframeLoaded(true)}
                />
              </div>`;

const newButtonBlock = `              <div className="w-full bg-white dark:bg-slate-800/60 p-12 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-xl text-center flex flex-col items-center justify-center min-h-[400px]">
                 <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-6">
                   <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-4 tracking-tight">Validação de Certificados</h2>
                 <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                   O sistema de validação de certificados agora está disponível em uma plataforma externa segura. Clique no botão abaixo para acessar.
                 </p>
                 <a
                    href={settings.certificateValidationUrl || settings.googleScriptCertificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-modern px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 text-sm shadow-md transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95"
                 >
                   Acessar Sistema de Verificação <ExternalLink className="w-5 h-5" />
                 </a>
              </div>`;

file = file.replace(originalIframeBlock, newButtonBlock);

fs.writeFileSync('src/components/Verifier.tsx', file);
