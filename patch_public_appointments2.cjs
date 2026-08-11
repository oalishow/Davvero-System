const fs = require('fs');
let file = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

file = file.replace(
  /                    \{prof\.appointmentLink \? \(\n                      <a [\s\S]*?<\/a>\n                      \{prof\.whatsappNumber && \(\n                        <div [\s\S]*?<\/div>\n                      \)\}\n                    \) : \(/,
  `                    {prof.appointmentLink ? (
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
                          <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {prof.whatsappNumber}
                          </div>
                        )}
                      </>
                    ) : (`
);

fs.writeFileSync('src/components/PublicAppointmentsList.tsx', file);
