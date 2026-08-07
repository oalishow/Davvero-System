import React, { forwardRef } from 'react';
import type { Event, CertificateTemplate, Member } from '../types';
import { useSettings } from '../context/SettingsContext';

interface CertificateRendererProps {
  event: Event;
  template: CertificateTemplate;
  member: Partial<Member>;
  isOrganizer?: boolean;
}

export const CertificateRenderer = forwardRef<HTMLDivElement, CertificateRendererProps>(
  ({ event, template, member, isOrganizer }, ref) => {
    const { settings } = useSettings();

    // Use specific signature urls from template, or fallback to the carteirinha settings
    const fajopaSigUrl = template.fajopaDirectorSignatureUrl || settings.instSignature;
    const rectorSigUrl = template.seminarRectorSignatureUrl || settings.rectorSignature;
    const fajopaName = template.fajopaDirectorName || settings.directorName;
    const rectorName = template.seminarRectorName || settings.rectorName;
    
    const fontClass = template.fontFamily === 'serif' ? 'font-serif' : 
                      template.fontFamily === 'mono' ? 'font-mono' : 'font-sans';
                      
    const certHours = isOrganizer && event.organizationHours ? event.organizationHours : event.hours;
                      
    const defaultBodyText = isOrganizer
      ? `Certificamos que [NOME DO ALUNO], atuou como membro da Equipe de Organização do evento "${event.title}", em formato ${event.format}, realizado entre ${new Date(event.startDate).toLocaleDateString('pt-BR')} e ${new Date(event.endDate || event.startDate).toLocaleDateString('pt-BR')}, com carga horária total de ${certHours} horas.`
      : `Certificamos que [NOME DO ALUNO], participou com êxito do evento "${event.title}", em formato ${event.format}, realizado entre ${new Date(event.startDate).toLocaleDateString('pt-BR')} e ${new Date(event.endDate || event.startDate).toLocaleDateString('pt-BR')}, com carga horária total de ${certHours} horas.`;
    
    const bodyText = (template.bodyText || defaultBodyText)
      .replace(/\[NOME DO ALUNO\]/g, member.name || 'NOME DO ALUNO')
      .replace(/\[RA DO ALUNO\]/g, member.ra || 'RA DO ALUNO');

    // Mapeamento de temas visuais (Nano Banana Design System)
    const themes: Record<string, { bg: string, border: React.ReactNode, titleColor: string, textStyle: string }> = {
      "theme-classic": {
        bg: "bg-[#F9F7F1]",
        border: (
          <>
            <div className="absolute inset-0 border-[20px] border-[#D4AF37] m-4 pointer-events-none rounded-sm opacity-80 z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#D4AF37] m-10 pointer-events-none rounded-none opacity-60 z-0"></div>
          </>
        ),
        titleColor: "text-[#2C3E50]",
        textStyle: "text-slate-800 text-3xl font-serif text-justify leading-relaxed",
      },
      "theme-modern": {
        bg: "bg-white",
        border: (
          <>
            <div className="absolute top-0 left-0 w-32 h-32 border-t-8 border-l-8 border-sky-600 m-8 pointer-events-none z-0"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-8 border-r-8 border-sky-600 m-8 pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-sky-900 tracking-tight",
        textStyle: "text-slate-700 text-3xl font-sans text-left leading-relaxed",
      },
      "theme-theology": {
        bg: "bg-[#FAFAFA]",
        border: (
          <>
            <div className="absolute inset-0 m-0 pointer-events-none border-[30px] border-[#4A0E2E] shadow-[inset_0_0_0_4px_#D4AF37] z-0"></div>
            <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center z-0">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[800px] h-[800px] text-[#4A0E2E]">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 13.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
               </svg>
            </div>
          </>
        ),
        titleColor: "text-[#4A0E2E]",
        textStyle: "text-[#2d081c] text-4xl font-serif text-center leading-[1.8]",
      },
      "theme-solemn": {
        bg: "bg-[#0B132B]",
        border: (
          <>
            <div className="absolute inset-0 border-[4px] border-[#D4AF37] m-12 pointer-events-none opacity-40 z-0"></div>
          </>
        ),
        titleColor: "text-[#D4AF37]",
        textStyle: "text-slate-300 text-3xl font-serif text-center leading-relaxed",
      }
    };

    const currentTheme = themes[template.bgStyle] || themes["theme-classic"];

    return (
      <div 
        ref={ref} 
        className={`w-[1122px] h-[793px] relative flex flex-col justify-between p-20 overflow-hidden ${fontClass} ${currentTheme.bg}`}
      >
        {template.backgroundImageUrl && (
          <img src={template.backgroundImageUrl} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100 mix-blend-multiply" alt="Background" crossOrigin="anonymous" />
        )}
        
        {!template.backgroundImageUrl && currentTheme.border}

        <div className="relative z-10 flex flex-col items-center pt-8">
           <h1 className={`text-6xl font-black tracking-widest uppercase mb-4 ${currentTheme.titleColor}`}>CERTIFICADO</h1>
           <h2 className={`text-2xl font-medium tracking-widest ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-500'} uppercase`}>{isOrganizer ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO"}</h2>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-12 px-24">
          <p className={currentTheme.textStyle} dangerouslySetInnerHTML={{ __html: bodyText.replace(/\n/g, '<br />') }}></p>
        </div>

        <div className="relative z-10 flex flex-row items-end justify-around pb-12 w-full px-16">
          {/* Assinaturas baseadas nos flags de Settings ou diretos do editor */}
          {(template.showFajopaDirectorSignature ?? false) && (
            <div className="flex flex-col items-center text-center w-80">
              {fajopaSigUrl ? (
                <img src={fajopaSigUrl} className="h-20 mb-2 object-contain mix-blend-multiply" crossOrigin="anonymous" alt="Signature" />
              ) : (
                <div className="h-20" />
              )}
              <div className={`w-full border-b-2 ${template.bgStyle === 'theme-solemn' ? 'border-slate-500' : 'border-slate-800'} mb-4`}></div>
              <h3 className={`text-2xl font-bold ${template.bgStyle === 'theme-solemn' ? 'text-slate-100' : 'text-slate-800'}`}>{fajopaName || "Diretor FAJOPA"}</h3>
              <p className={`text-lg font-medium ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}`}>Diretor de Ensino / Acadêmico</p>
            </div>
          )}
          
          {(template.showSeminarRectorSignature ?? false) && (
            <div className="flex flex-col items-center text-center w-80">
              {rectorSigUrl ? (
                <img src={rectorSigUrl} className="h-20 mb-2 object-contain mix-blend-multiply" crossOrigin="anonymous" alt="Signature" />
              ) : (
                <div className="h-20" />
              )}
              <div className={`w-full border-b-2 ${template.bgStyle === 'theme-solemn' ? 'border-slate-500' : 'border-slate-800'} mb-4`}></div>
              <h3 className={`text-2xl font-bold ${template.bgStyle === 'theme-solemn' ? 'text-slate-100' : 'text-slate-800'}`}>{rectorName || "Reitor"}</h3>
              <p className={`text-lg font-medium ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}`}>Reitor do Seminário</p>
            </div>
          )}

          {/* Legacy Support se faltarem as novas flags, usar assinatiras originais se preenchidas */}
          {(!(template.showFajopaDirectorSignature ?? false) && !(template.showSeminarRectorSignature ?? false)) && (
            <>
              {(template.signatureName || template.signatureRole) && (
                <div className="flex flex-col items-center text-center w-80">
                  <div className="h-16" />
                  <div className={`w-full border-b-2 ${template.bgStyle === 'theme-solemn' ? 'border-slate-500' : 'border-slate-800'} mb-4`}></div>
                  <h3 className={`text-2xl font-bold ${template.bgStyle === 'theme-solemn' ? 'text-slate-100' : 'text-slate-800'}`}>{template.signatureName || "Nome do Responsável"}</h3>
                  <p className={`text-lg font-medium ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}`}>{template.signatureRole || "Cargo / Instituição"}</p>
                </div>
              )}
              
              {(template.signature2Name || template.signature2Role) && (
                <div className="flex flex-col items-center text-center w-80">
                  <div className="h-16" />
                  <div className={`w-full border-b-2 ${template.bgStyle === 'theme-solemn' ? 'border-slate-500' : 'border-slate-800'} mb-4`}></div>
                  <h3 className={`text-2xl font-bold ${template.bgStyle === 'theme-solemn' ? 'text-slate-100' : 'text-slate-800'}`}>{template.signature2Name || ""}</h3>
                  <p className={`text-lg font-medium ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}`}>{template.signature2Role || ""}</p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Assinatura / Logo */}
        <div className="absolute bottom-6 right-10 opacity-30 pointer-events-none z-10">
          <p className={`text-[12px] font-bold uppercase tracking-widest ${template.bgStyle === 'theme-solemn' ? 'text-slate-500' : 'text-slate-900'}`}>Powered by DAVVERO System & FAJOPA</p>
        </div>
      </div>
    );
  }
);

CertificateRenderer.displayName = 'CertificateRenderer';
