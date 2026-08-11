const fs = require('fs');
let file = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

file = file.replace(
  /professionalsList, setProfessionalsList\] = useState<\{ id: string, name: string, role: string, photoUrl\?: string, appointmentLink\?: string, appointmentType\?: string \}\[\]>\(\[\]\);/,
  'professionalsList, setProfessionalsList] = useState<{ id: string, name: string, role: string, photoUrl?: string, appointmentLink?: string, appointmentType?: string, whatsappNumber?: string }[]>([]);'
);

file = file.replace(
  /profMap\[p\.id\] = \{ \.\.\.p, appointmentLink: p\.id === 'prof_anderson' \? 'https:\/\/calendar\.app\.google\/shVAPdZTNeDs2PaGA' : \(p\.id === 'prof_altair' \? 'https:\/\/chat\.whatsapp\.com\/GzB9sD90aW09kPndbI38uP' : ''\), appointmentType: p\.id === 'prof_anderson' \? 'google_calendar' : \(p\.id === 'prof_altair' \? 'whatsapp' : 'other'\) \};/g,
  "profMap[p.id] = { ...p, appointmentLink: p.id === 'prof_anderson' ? 'https://calendar.app.google/shVAPdZTNeDs2PaGA' : (p.id === 'prof_altair' ? 'https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP' : ''), appointmentType: p.id === 'prof_anderson' ? 'google_calendar' : (p.id === 'prof_altair' ? 'whatsapp' : 'other'), whatsappNumber: p.whatsappNumber || '' };"
);

const replaceBlock = `                      <a 
                        href={prof.appointmentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        {prof.appointmentType === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : prof.appointmentType === "google_calendar" ? <CalendarIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                        Agendar Horário
                      </a>`;
                      
file = file.replace(
  /                      <a [\s\S]*?Agendar Horário\n                      <\/a>/,
  replaceBlock + `
                      {prof.whatsappNumber && (
                        <div className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {prof.whatsappNumber}
                        </div>
                      )}`
);

fs.writeFileSync('src/components/PublicAppointmentsList.tsx', file);
