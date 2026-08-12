const fs = require('fs');
let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

file = file.replace(
  '  const { isSupported, subscription, subscribe } = usePushNotifications();',
  '  const { isSupported, subscription, permission, subscribe, unsubscribe } = usePushNotifications();'
);

const searchStr = `                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">`;

const replaceStr = `                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <BellRing className="w-4 h-4 text-sky-500" /> Serviço de Notificações
                    </h4>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Status Atual
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                            {!isSupported ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Não Suportado
                              </span>
                            ) : permission === "denied" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Erro (Bloqueado)
                              </span>
                            ) : subscription ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Conectado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Pendente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {subscription ? "Seu dispositivo está apto a receber comunicados urgentes." : permission === "denied" ? "Você bloqueou as notificações. Libere a permissão nas configurações do seu navegador para receber comunicados." : "Ative as notificações para receber avisos importantes da secretaria."}
                          </p>
                        </div>
                        {isSupported && (
                          <div className="flex-shrink-0 w-full sm:w-auto">
                            {!subscription && permission !== "denied" ? (
                              <button
                                onClick={() => {
                                  playSound('click');
                                  subscribe();
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95 whitespace-nowrap"
                              >
                                Ativar Notificações
                              </button>
                            ) : subscription ? (
                              <button
                                onClick={() => {
                                  playSound('click');
                                  unsubscribe();
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition active:scale-95 whitespace-nowrap"
                              >
                                Desativar
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">`;

file = file.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/StudentPortal.tsx', file);
