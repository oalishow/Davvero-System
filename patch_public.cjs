const fs = require('fs');
let c = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

const searchStr = `                    {prof.appointmentLink ? (
                      <>
                        <a 
                          href={prof.appointmentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {prof.appointmentType === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : prof.appointmentType === "google_calendar" ? <CalendarIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                          Agendar Horário
                        </a>
                        {prof.whatsappNumber && (
                          <a href={\`https://wa.me/\${prof.whatsappNumber.replace(/\\D/g, '').startsWith('55') ? prof.whatsappNumber.replace(/\\D/g, '') : '55' + prof.whatsappNumber.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center justify-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {prof.whatsappNumber}
                          </a>
                        )}
                      </>
                    ) : (
                      <button 
                        disabled
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      >
                        Indisponível
                      </button>
                    )}`;

const replaceStr = `                    {prof.appointmentLink ? (
                      <a 
                        href={prof.appointmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        {prof.appointmentType === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : prof.appointmentType === "google_calendar" ? <CalendarIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        Agendar Horário
                      </a>
                    ) : (
                      <button 
                        disabled
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      >
                        Indisponível
                      </button>
                    )}
                    {prof.whatsappNumber && (
                      <a href={\`https://wa.me/\${prof.whatsappNumber.replace(/\\D/g, '').startsWith('55') ? prof.whatsappNumber.replace(/\\D/g, '') : '55' + prof.whatsappNumber.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center justify-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {prof.whatsappNumber}
                      </a>
                    )}`;

c = c.replace(searchStr, replaceStr);
fs.writeFileSync('src/components/PublicAppointmentsList.tsx', c);
