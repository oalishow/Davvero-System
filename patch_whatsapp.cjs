const fs = require('fs');

let pubList = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');
let appPanel = fs.readFileSync('src/components/AppointmentsPanel.tsx', 'utf8');

const searchStrPub = `                    {prof.whatsappNumber && (
                      <a href={\`https://wa.me/\${prof.whatsappNumber.replace(/\\D/g, '').startsWith('55') ? prof.whatsappNumber.replace(/\\D/g, '') : '55' + prof.whatsappNumber.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center justify-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {prof.whatsappNumber}
                      </a>
                    )}`;

const replaceStrPub = `                    {prof.whatsappNumber && (
                      <a href={\`https://wa.me/\${prof.whatsappNumber.replace(/\\D/g, '').startsWith('55') ? prof.whatsappNumber.replace(/\\D/g, '') : '55' + prof.whatsappNumber.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="w-full mt-3 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                        <MessageCircle className="w-4 h-4 fill-white" />
                        Falar no WhatsApp
                      </a>
                    )}`;

pubList = pubList.replace(searchStrPub, replaceStrPub);
fs.writeFileSync('src/components/PublicAppointmentsList.tsx', pubList);

const searchStrApp = `                  {selectedProfessional && professionals.find(p => p.id === selectedProfessional)?.whatsappNumber && (
                    <div className="mt-4 p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800/50 flex flex-col items-center text-center">
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold mb-1 uppercase tracking-wider">Contato do Profissional</span>
                      <a href={\`https://wa.me/\${professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '').startsWith('55') ? professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '') : '55' + professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-sm font-black text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        {professionals.find(p => p.id === selectedProfessional)?.whatsappNumber}
                      </a>
                    </div>
                  )}`;

const replaceStrApp = `                  {selectedProfessional && professionals.find(p => p.id === selectedProfessional)?.whatsappNumber && (
                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center">
                      <a href={\`https://wa.me/\${professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '').startsWith('55') ? professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '') : '55' + professionals.find(p => p.id === selectedProfessional)?.whatsappNumber?.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <MessageCircle className="w-5 h-5 text-white fill-white" />
                        Falar no WhatsApp
                      </a>
                    </div>
                  )}`;

appPanel = appPanel.replace(searchStrApp, replaceStrApp);
fs.writeFileSync('src/components/AppointmentsPanel.tsx', appPanel);

