const fs = require('fs');

let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const oldBlock = `                {settings.useGoogleScriptCertificate && settings.googleScriptCertificateUrl ? (
                  <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-700 text-center shadow-lg flex flex-col items-center justify-center gap-6 min-h-[400px]">
                    <ShieldCheck className="w-16 h-16 text-emerald-500" />
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2">Portal de Certificados</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Acesse seu histórico completo e faça o download dos certificados das atividades que você participou.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          const url = new URL(settings.googleScriptCertificateUrl);
                          url.searchParams.append('name', member.name || '');
                          url.searchParams.append('doc', member.ra || (member as any).cpf || '');
                          window.open(url.toString(), '_blank');
                        } catch (e) {
                          window.open(settings.googleScriptCertificateUrl, '_blank');
                        }
                      }}
                      className="btn-modern px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 text-sm shadow-md transition-all active:scale-95"
                    >
                      <ExternalLink className="w-5 h-5" /> Acessar Meus Certificados
                    </button>
                  </div>
                ) : (
                  <>`;

const newBlock = `                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  {settings.useGoogleScriptCertificate && settings.googleScriptCertificateUrl && (
                    <div className="flex-1 bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-3xl shadow-lg flex flex-col justify-between items-start text-white relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 opacity-10">
                         <ShieldCheck className="w-32 h-32" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                          <ExternalLink className="w-5 h-5" /> FAJOPA Plus
                        </h3>
                        <p className="text-sm text-emerald-50 max-w-sm mb-6">
                          Acesse seu histórico completo e certificados externos no sistema legando do FAJOPA Plus.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          try {
                            const url = new URL(settings.googleScriptCertificateUrl);
                            url.searchParams.append('name', member.name || '');
                            url.searchParams.append('doc', member.ra || (member as any).cpf || '');
                            window.open(url.toString(), '_blank');
                          } catch (e) {
                            window.open(settings.googleScriptCertificateUrl, '_blank');
                          }
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-sm backdrop-blur-sm border border-white/20"
                      >
                        Acessar Portal FAJOPA
                      </button>
                    </div>
                  )}
                  
                  <div className="flex-1 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between items-start relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05]">
                         <ShieldCheck className="w-32 h-32 text-slate-900 dark:text-white" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                          <ShieldCheck className="w-5 h-5 text-sky-500" /> Davvero System
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                          Seus certificados nativos gerados pelos eventos internos. Verificáveis pelo código QR e autenticidade.
                        </p>
                      </div>
                      <button
                         onClick={() => {
                            const el = document.getElementById("davvero-certificates-list");
                            if(el) el.scrollIntoView({behavior: 'smooth'});
                         }}
                         className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-sm"
                      >
                         Ver Certificados Abaixo
                      </button>
                  </div>
                </div>

                <div id="davvero-certificates-list">
                  <>`;

file = file.replace(oldBlock, newBlock);

const endOldBlock = `                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full inline-block mb-4">
                          <ShieldCheck className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhum certificado disponível</h3>
                        <p className="text-sm text-slate-500">
                          Você ainda não possui certificados emitidos ou liberados no momento.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}`;

const endNewBlock = `                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full inline-block mb-4">
                          <ShieldCheck className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhum certificado disponível</h3>
                        <p className="text-sm text-slate-500">
                          Você ainda não possui certificados emitidos ou liberados no momento.
                        </p>
                      </div>
                    )}
                  </>
                </div>
              </motion.div>
            )}`;

file = file.replace(endOldBlock, endNewBlock);

fs.writeFileSync('src/components/StudentPortal.tsx', file);
