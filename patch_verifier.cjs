const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const search = `      {verifyMode === "CERTIFICATE" && (
        <div className="w-full flex-col justify-center text-center max-w-6xl mx-auto space-y-4 min-h-[500px]">
          {(settings.certificateValidationUrl || settings.googleScriptCertificateUrl) ? (
            <>
              <div className="flex justify-between items-center no-print">
                 <button
                   onClick={() => setVerifyMode("STANDARD")}
                   className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                 >
                   <ArrowLeft className="w-4 h-4" /> Voltar
                 </button>
                 <a 
                   href={settings.certificateValidationUrl || settings.googleScriptCertificateUrl} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
                 >
                   Abrir em nova aba ↗
                 </a>
              </div>
              <div className="w-full bg-white dark:bg-slate-800/60 p-12 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-xl text-center flex flex-col items-center justify-center min-h-[400px]">
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
              </div>
            </>
          ) : (
            <div className="w-full bg-white dark:bg-slate-800/40 p-10 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg text-center flex flex-col items-center justify-center">
               <p className="text-slate-500 font-medium mb-6">Nenhum link de validação de certificados foi configurado.</p>
               <button 
                  onClick={() => setVerifyMode("STANDARD")}
                  className="btn-modern px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl"
               >
                 Voltar para Verificar Identidade
               </button>
            </div>
          )}
        </div>
      )}`;

const replace = `      {verifyMode === "CERTIFICATE" && (
        <div className="w-full flex-col justify-center text-center max-w-6xl mx-auto space-y-4 min-h-[500px]">
          <div className="flex justify-between items-center no-print">
            <button
              onClick={() => setVerifyMode("STANDARD")}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Davvero System Verifier */}
            <div className="w-full bg-white dark:bg-slate-800/60 p-8 rounded-3xl border border-sky-100 dark:border-sky-900/30 shadow-xl text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/50 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-sky-600 dark:text-sky-400" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Davvero System</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xs mx-auto text-sm leading-relaxed">
                Verifique a autenticidade de certificados emitidos internamente pela nossa plataforma.
              </p>
              
              <div className="w-full max-w-sm space-y-4">
                <input
                  type="text"
                  placeholder="Código do Certificado (ex: ABCD12-EFGH34)"
                  className="w-full p-4 rounded-xl text-sm font-mono text-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-sky-500"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter' && codeInput) {
                        handleGlobalVerify(codeInput);
                     }
                  }}
                />
                <button
                  onClick={() => handleGlobalVerify(codeInput)}
                  disabled={!codeInput || isProcessing}
                  className="w-full btn-modern px-6 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? "Verificando..." : "Validar Código"}
                </button>
              </div>
            </div>

            {/* FAJOPA Plus Verifier */}
            <div className="w-full bg-white dark:bg-slate-800/60 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-xl text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">FAJOPA Plus</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xs mx-auto text-sm leading-relaxed">
                Validação de certificados acadêmicos antigos ou emitidos pela rede FAJOPA.
              </p>
              
              {(settings.certificateValidationUrl || settings.googleScriptCertificateUrl) ? (
                <a
                  href={settings.certificateValidationUrl || settings.googleScriptCertificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-modern px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 text-sm shadow-md transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95"
                >
                  Acessar FAJOPA Plus <ExternalLink className="w-5 h-5" />
                </a>
              ) : (
                <p className="text-sm text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                  Link não configurado pelo administrador.
                </p>
              )}
            </div>
          </div>
        </div>
      )}`;

file = file.replace(search, replace);
fs.writeFileSync('src/components/Verifier.tsx', file);
