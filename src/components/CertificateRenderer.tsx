import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Event, CertificateTemplate, Member } from '../types';
import { useSettings } from '../context/SettingsContext';
import { extractAssetString } from '../lib/constants';

interface CertificateRendererProps {
  event: Event;
  template: CertificateTemplate;
  member: Partial<Member>;
  isOrganizer?: boolean;
  id?: string;
}

export const CertificateRenderer = forwardRef<HTMLDivElement, CertificateRendererProps>(
  ({ event, template, member, isOrganizer, id }, ref) => {
    const { settings } = useSettings();

    // Signatures URLs and names fallback
    const isDioceseEvent = Boolean(event.isDiocese || event.dioceseId);

    const localDirectorSig = typeof window !== "undefined" ? extractAssetString(localStorage.getItem("davveroId_director_signature") || sessionStorage.getItem("davveroId_director_signature")) : null;
    const localRectorSig = typeof window !== "undefined" ? extractAssetString(localStorage.getItem("davveroId_rector_signature") || sessionStorage.getItem("davveroId_rector_signature")) : null;

    const showFajopaDirector = template.showFajopaDirectorSignature !== undefined 
      ? template.showFajopaDirectorSignature 
      : (!isDioceseEvent || Boolean(template.fajopaDirectorSignatureUrl || template.fajopaDirectorName));

    const showSeminarRector = template.showSeminarRectorSignature !== undefined 
      ? template.showSeminarRectorSignature 
      : (!isDioceseEvent || Boolean(template.seminarRectorSignatureUrl || template.seminarRectorName));

    const fajopaSigUrl = extractAssetString(template.fajopaDirectorSignatureUrl || (showFajopaDirector ? (settings.instSignature || localDirectorSig) : undefined));
    const rectorSigUrl = extractAssetString(template.seminarRectorSignatureUrl || (showSeminarRector ? (settings.rectorSignature || localRectorSig) : undefined));
    const fajopaName = template.fajopaDirectorName || settings.directorName || "Diretor FAJOPA";
    const rectorName = template.seminarRectorName || settings.rectorName || "Reitor";

    // Custom / Diocese Responsibles with Diocese Config Fallbacks
    const dioceseConfig = isDioceseEvent ? (
      (event.dioceseId && settings.diocesesConfig?.[event.dioceseId]) ||
      (event.diocese && settings.diocesesConfig?.[event.diocese.toUpperCase().trim()]) ||
      (settings.diocesesConfig ? (Object.values(settings.diocesesConfig) as any[]).find(d => d?.name?.toUpperCase() === event.diocese?.toUpperCase()) : undefined)
    ) : undefined;

    const sig1Name = template.signature1Name ?? template.signatureName ?? (isDioceseEvent ? (dioceseConfig as any)?.bishopName || (dioceseConfig as any)?.responsibleName : undefined);
    const sig1Role = template.signature1Role ?? template.signatureRole ?? (isDioceseEvent ? (dioceseConfig as any)?.bishopTitle || (dioceseConfig as any)?.responsibleRole || "Bispo Diocesano" : undefined);
    const sig1Url = extractAssetString(template.signature1Url || template.signatureUrl || (isDioceseEvent ? ((dioceseConfig as any)?.bishopSignatureUrl || (dioceseConfig as any)?.signatureUrl || (dioceseConfig as any)?.signature || (dioceseConfig as any)?.bishopSignature || (dioceseConfig as any)?.responsibleSignature) : undefined));
    const showSig1 = template.showSignature1 !== undefined 
      ? template.showSignature1 
      : (isDioceseEvent || Boolean(sig1Name || sig1Role || sig1Url));

    const sig2Name = template.signature2Name;
    const sig2Role = template.signature2Role;
    const sig2Url = extractAssetString(template.signature2Url);
    const showSig2 = template.showSignature2 !== undefined 
      ? template.showSignature2 
      : Boolean(sig2Name || sig2Role || sig2Url);

    const sig3Name = template.signature3Name;
    const sig3Role = template.signature3Role;
    const sig3Url = extractAssetString(template.signature3Url);
    const showSig3 = template.showSignature3 !== undefined 
      ? template.showSignature3 
      : Boolean(sig3Name || sig3Role || sig3Url);

    // Font Family resolution
    const fontClass = 
      template.fontFamily === 'serif' ? 'font-serif' :
      template.fontFamily === 'mono' ? 'font-mono' :
      template.fontFamily === 'cinzel' ? 'font-serif tracking-wider' :
      template.fontFamily === 'script' ? 'italic font-serif' :
      template.fontFamily === 'merriweather' ? 'font-serif' :
      template.fontFamily === 'montserrat' ? 'font-sans tracking-wide' : 'font-sans';

    // Calculation of hours (Safe: never outputs "null", "undefined", or 0)
    const rawHours = isOrganizer && event.organizationHours ? event.organizationHours : event.hours;
    const hasValidHours = rawHours && String(rawHours).trim() !== "" && String(rawHours).toLowerCase() !== "null" && String(rawHours).toLowerCase() !== "undefined" && Number(rawHours) !== 0;
    const hoursText = hasValidHours ? `, com carga horária total de ${rawHours} horas` : "";

    const defaultBodyText = isOrganizer
      ? `Certificamos que [NOME DO ALUNO], atuou com distinção como membro da Equipe de Organização do evento "${event.title}", em formato ${event.format || 'acadêmico'}, realizado entre ${new Date(event.startDate).toLocaleDateString('pt-BR')} e ${new Date(event.endDate || event.startDate).toLocaleDateString('pt-BR')}${hoursText}.`
      : `Certificamos que [NOME DO ALUNO], participou com êxito e assiduidade do evento "${event.title}", em formato ${event.format || 'acadêmico'}, realizado entre ${new Date(event.startDate).toLocaleDateString('pt-BR')} e ${new Date(event.endDate || event.startDate).toLocaleDateString('pt-BR')}${hoursText}.`;

    // Clean body text (strip any literal "null horas" or "undefined horas" from user edits)
    const bodyText = (template.bodyText || defaultBodyText)
      .replace(/\[NOME DO ALUNO\]/g, member.name || 'NOME DO PARTICIPANTE')
      .replace(/\[RA DO ALUNO\]/g, member.ra || 'RA DO ALUNO')
      .replace(/null horas/gi, '')
      .replace(/undefined horas/gi, '');

    // Typography customization styles
    const customFontSize = template.fontSize ? `${template.fontSize}px` : undefined;
    const customFontWeight = template.isBold ? 'font-bold' : 'font-normal';
    const customTextAlign = 
      template.textAlign === 'left' ? 'text-left' :
      template.textAlign === 'center' ? 'text-center' :
      template.textAlign === 'right' ? 'text-right' : 'text-justify';

    const textBoxWidthClass = 
      template.textBoxWidth === 'narrow' ? 'max-w-[720px] px-4' :
      template.textBoxWidth === 'wide' ? 'max-w-[980px] px-8' :
      template.textBoxWidth === 'full' ? 'w-full px-2' : 'max-w-[880px] px-6';

    // Signatures configuration
    const sigHeight = template.signatureSize || 65;
    const sigOffsetY = template.signatureOffsetY || 0;
    const sigLineGap = template.signatureLineGap ?? -4;
    const sigDistributionClass = 
      template.signaturePosition === 'center' ? 'justify-center gap-16' :
      template.signaturePosition === 'left' ? 'justify-start gap-12' :
      template.signaturePosition === 'right' ? 'justify-end gap-12' :
      template.signaturePosition === 'space-between' ? 'justify-between px-10' :
      'justify-around px-8';

    // Event Logo 1 configuration
    const logoSource = template.logoUrl || (template.showLogo ? event.imageUrl : undefined);
    const logoHeight = template.logoSize || 70;
    const logoPos = template.logoPosition || "top-center";

    // Event Logo 2 configuration (Secondary Logo)
    const logo2Source = template.logo2Url;
    const showLogo2 = (template.showLogo2 ?? true) && Boolean(logo2Source);
    const logo2Height = template.logo2Size || 60;
    const logo2Pos = template.logo2Position || "top-right";

    // Background Transparency & Opacity
    const bgOpacity = typeof template.backgroundOpacity === 'number' ? template.backgroundOpacity / 100 : 1;

    // Institution Address & Contact
    const instAddress = template.institutionAddress !== undefined ? template.institutionAddress : (template.showInstitutionFooter !== false ? settings.instAddress : undefined);
    const instEmail = template.institutionEmail !== undefined ? template.institutionEmail : (template.showInstitutionFooter !== false ? settings.instEmail : undefined);
    const showInstFooter = template.showInstitutionFooter ?? Boolean(instAddress || instEmail);
    const instFooterOffsetY = template.institutionFooterOffsetY || 0;

    // Design Themes Library
    const themes: Record<string, { bg: string; border: React.ReactNode; titleColor: string; subtitleColor: string; defaultTextStyle: string; signatureLineColor: string; nameColor: string; roleColor: string; watermarkColor: string }> = {
      "theme-classic": {
        bg: "bg-[#FDFBF7]",
        border: (
          <>
            <div className="absolute inset-0 border-[16px] border-[#C5A059] m-3 pointer-events-none rounded-none opacity-85 z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#C5A059] m-8 pointer-events-none rounded-none opacity-60 z-0"></div>
            {/* Cantoneiras decorativas */}
            <div className="absolute top-7 left-7 w-8 h-8 border-t-2 border-l-2 border-[#C5A059] pointer-events-none z-0"></div>
            <div className="absolute top-7 right-7 w-8 h-8 border-t-2 border-r-2 border-[#C5A059] pointer-events-none z-0"></div>
            <div className="absolute bottom-7 left-7 w-8 h-8 border-b-2 border-l-2 border-[#C5A059] pointer-events-none z-0"></div>
            <div className="absolute bottom-7 right-7 w-8 h-8 border-b-2 border-r-2 border-[#C5A059] pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-[#1E293B]",
        subtitleColor: "text-[#C5A059]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#C5A059]",
        nameColor: "text-slate-900",
        roleColor: "text-slate-600",
        watermarkColor: "text-slate-900",
      },
      "theme-modern": {
        bg: "bg-white",
        border: (
          <>
            <div className="absolute top-0 left-0 w-36 h-36 border-t-8 border-l-8 border-sky-600 m-6 pointer-events-none z-0"></div>
            <div className="absolute bottom-0 right-0 w-36 h-36 border-b-8 border-r-8 border-sky-600 m-6 pointer-events-none z-0"></div>
            <div className="absolute inset-x-8 top-0 h-1.5 bg-gradient-to-r from-sky-600 via-indigo-500 to-sky-600 pointer-events-none z-0"></div>
            <div className="absolute inset-x-8 bottom-0 h-1.5 bg-gradient-to-r from-sky-600 via-indigo-500 to-sky-600 pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-sky-950 tracking-tight",
        subtitleColor: "text-sky-600",
        defaultTextStyle: "text-slate-700 text-[26px] leading-[1.65]",
        signatureLineColor: "border-sky-600",
        nameColor: "text-slate-900",
        roleColor: "text-slate-500",
        watermarkColor: "text-slate-800",
      },
      "theme-theology": {
        bg: "bg-[#FCF9F9]",
        border: (
          <>
            <div className="absolute inset-0 m-0 pointer-events-none border-[26px] border-[#4A0E2E] shadow-[inset_0_0_0_3px_#D4AF37] z-0"></div>
            <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.035] pointer-events-none flex items-center justify-center z-0">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[700px] h-[700px] text-[#4A0E2E]">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm0 13.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
               </svg>
            </div>
          </>
        ),
        titleColor: "text-[#4A0E2E]",
        subtitleColor: "text-[#9E2A2B]",
        defaultTextStyle: "text-[#2d081c] text-[27px] leading-[1.75]",
        signatureLineColor: "border-[#4A0E2E]",
        nameColor: "text-[#2d081c]",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#4A0E2E]",
      },
      "theme-solemn": {
        bg: "bg-[#0B132B]",
        border: (
          <>
            <div className="absolute inset-0 border-[3px] border-[#D4AF37] m-8 pointer-events-none opacity-50 z-0"></div>
            <div className="absolute inset-0 border border-[#D4AF37] m-11 pointer-events-none opacity-30 z-0"></div>
            <div className="absolute top-10 left-10 w-6 h-6 border-t-2 border-l-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute top-10 right-10 w-6 h-6 border-t-2 border-r-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute bottom-10 left-10 w-6 h-6 border-b-2 border-l-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute bottom-10 right-10 w-6 h-6 border-b-2 border-r-2 border-[#D4AF37] pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-[#E5B842]",
        subtitleColor: "text-slate-300",
        defaultTextStyle: "text-slate-200 text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#D4AF37]/60",
        nameColor: "text-slate-100",
        roleColor: "text-slate-400",
        watermarkColor: "text-slate-400",
      },
      "theme-fajopa": {
        bg: "bg-[#F8FAFC]",
        border: (
          <>
            <div className="absolute inset-0 border-[14px] border-[#1E3A8A] m-2 pointer-events-none z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#0D9488] m-7 pointer-events-none opacity-70 z-0"></div>
          </>
        ),
        titleColor: "text-[#1E3A8A]",
        subtitleColor: "text-[#0D9488]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#1E3A8A]",
        nameColor: "text-slate-900",
        roleColor: "text-slate-600",
        watermarkColor: "text-slate-800",
      },
      "theme-diplomatic": {
        bg: "bg-[#F7FAF7]",
        border: (
          <>
            <div className="absolute inset-0 border-[18px] border-[#064E3B] m-2 pointer-events-none shadow-[inset_0_0_0_2px_#D4AF37] z-0"></div>
            <div className="absolute inset-0 border border-[#D4AF37] m-8 pointer-events-none opacity-80 z-0"></div>
          </>
        ),
        titleColor: "text-[#064E3B]",
        subtitleColor: "text-[#B45309]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#064E3B]",
        nameColor: "text-slate-900",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#064E3B]",
      },
      "theme-minimal": {
        bg: "bg-white",
        border: (
          <>
            <div className="absolute inset-0 border border-slate-300 m-8 pointer-events-none z-0"></div>
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-900 pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-slate-900 tracking-widest",
        subtitleColor: "text-slate-500",
        defaultTextStyle: "text-slate-700 text-[25px] leading-[1.65]",
        signatureLineColor: "border-slate-800",
        nameColor: "text-slate-900",
        roleColor: "text-slate-500",
        watermarkColor: "text-slate-800",
      },
      "theme-parchment": {
        bg: "bg-[#F5EBE0]",
        border: (
          <>
            <div className="absolute inset-0 border-[18px] border-[#5C3D2E] m-2 pointer-events-none opacity-90 z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#8C6239] m-8 pointer-events-none opacity-60 z-0"></div>
          </>
        ),
        titleColor: "text-[#5C3D2E]",
        subtitleColor: "text-[#8C6239]",
        defaultTextStyle: "text-[#3D2619] text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#5C3D2E]",
        nameColor: "text-[#3D2619]",
        roleColor: "text-[#6B4B35]",
        watermarkColor: "text-[#5C3D2E]",
      },
      "theme-laurel": {
        bg: "bg-[#FCFDFD]",
        border: (
          <>
            <div className="absolute inset-0 border-[14px] border-[#9A7B38] m-3 pointer-events-none z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#9A7B38] m-8 pointer-events-none opacity-60 z-0"></div>
          </>
        ),
        titleColor: "text-[#785E23]",
        subtitleColor: "text-[#9A7B38]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#9A7B38]",
        nameColor: "text-slate-900",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#785E23]",
      },
      "theme-emerald-gold": {
        bg: "bg-[#F4F9F6]",
        border: (
          <>
            <div className="absolute inset-0 border-[20px] border-[#064E3B] m-2 pointer-events-none shadow-[inset_0_0_0_3px_#D4AF37] z-0"></div>
            <div className="absolute inset-0 border border-[#D4AF37] m-8 pointer-events-none opacity-70 z-0"></div>
            <div className="absolute top-9 left-9 w-10 h-10 border-t-2 border-l-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute top-9 right-9 w-10 h-10 border-t-2 border-r-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute bottom-9 left-9 w-10 h-10 border-b-2 border-l-2 border-[#D4AF37] pointer-events-none z-0"></div>
            <div className="absolute bottom-9 right-9 w-10 h-10 border-b-2 border-r-2 border-[#D4AF37] pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-[#064E3B]",
        subtitleColor: "text-[#D97706]",
        defaultTextStyle: "text-[#062c22] text-[26px] leading-[1.7]",
        signatureLineColor: "border-[#064E3B]",
        nameColor: "text-[#064E3B]",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#064E3B]",
      },
      "theme-academic-navy": {
        bg: "bg-[#F8FAFC]",
        border: (
          <>
            <div className="absolute inset-0 border-[16px] border-[#0F172A] m-2 pointer-events-none shadow-[inset_0_0_0_3px_#38BDF8] z-0"></div>
            <div className="absolute inset-0 border border-[#38BDF8] m-8 pointer-events-none opacity-60 z-0"></div>
            <div className="absolute inset-x-12 top-0 h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent pointer-events-none z-0"></div>
            <div className="absolute inset-x-12 bottom-0 h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-[#0F172A]",
        subtitleColor: "text-[#0284C7]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.68]",
        signatureLineColor: "border-[#0F172A]",
        nameColor: "text-slate-900",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#0F172A]",
      },
      "theme-renaissance": {
        bg: "bg-[#FAF5EF]",
        border: (
          <>
            <div className="absolute inset-0 border-[22px] border-[#78350F] m-2 pointer-events-none shadow-[inset_0_0_0_4px_#B45309] z-0"></div>
            <div className="absolute inset-0 border-[2px] border-[#B45309] m-9 pointer-events-none opacity-80 z-0"></div>
            <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-[#B45309] pointer-events-none z-0"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-[#B45309] pointer-events-none z-0"></div>
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-[#B45309] pointer-events-none z-0"></div>
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-[#B45309] pointer-events-none z-0"></div>
          </>
        ),
        titleColor: "text-[#78350F]",
        subtitleColor: "text-[#B45309]",
        defaultTextStyle: "text-[#451A03] text-[26px] leading-[1.72]",
        signatureLineColor: "border-[#78350F]",
        nameColor: "text-[#451A03]",
        roleColor: "text-[#92400E]",
        watermarkColor: "text-[#78350F]",
      },
      "theme-contemporary-ruby": {
        bg: "bg-[#FFFBFB]",
        border: (
          <>
            <div className="absolute inset-0 border-[16px] border-[#881337] m-2 pointer-events-none shadow-[inset_0_0_0_2px_#E11D48] z-0"></div>
            <div className="absolute inset-0 border border-[#E11D48] m-8 pointer-events-none opacity-50 z-0"></div>
          </>
        ),
        titleColor: "text-[#881337] tracking-tight",
        subtitleColor: "text-[#BE123C]",
        defaultTextStyle: "text-slate-800 text-[26px] leading-[1.68]",
        signatureLineColor: "border-[#881337]",
        nameColor: "text-[#881337]",
        roleColor: "text-slate-600",
        watermarkColor: "text-[#881337]",
      },
    };

    const currentTheme = themes[template.bgStyle] || themes["theme-classic"];

    const titleText = template.titleText || "CERTIFICADO";
    
    // Exact subtitle resolution: ensure no mismatch between organizer and participant modes
    let subtitleText = template.subtitleText;
    if (!subtitleText || subtitleText.trim() === "") {
      subtitleText = isOrganizer ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO";
    } else if (isOrganizer && subtitleText.toUpperCase().includes("PARTICIPAÇÃO")) {
      subtitleText = "DE ORGANIZAÇÃO";
    } else if (!isOrganizer && subtitleText.toUpperCase().includes("ORGANIZAÇÃO")) {
      subtitleText = "DE PARTICIPAÇÃO";
    }

    return (
      <div 
        ref={ref} 
        id={id || `cert-node-${isOrganizer ? "org" : "part"}-${event.id}`}
        className={`w-[1123px] h-[794px] min-w-[1123px] min-h-[794px] max-w-[1123px] max-h-[794px] aspect-[297/210] relative flex flex-col justify-between p-14 overflow-hidden select-none box-border ${fontClass} ${currentTheme.bg}`}
      >
        {/* Custom background image overlay with custom opacity/transparency */}
        {template.backgroundImageUrl && (
          <img 
            src={template.backgroundImageUrl} 
            className="absolute inset-0 w-full h-full object-cover z-0 mix-blend-multiply transition-opacity pointer-events-none" 
            style={{ opacity: bgOpacity }}
            alt="Background" 
            crossOrigin={template.backgroundImageUrl.startsWith('data:') ? undefined : "anonymous"}
            loading="eager"
            decoding="sync"
          />
        )}
        
        {(!template.backgroundImageUrl || template.keepFrameWithCustomBg) && currentTheme.border}

        {/* Top Header Section with Logo and Titles */}
        <div className="relative z-10 flex flex-col items-center pt-2 shrink-0">
          
          {/* Logo 1 positioning: top-left or top-right absolute, or top-center inline */}
          {logoSource && logoPos === "top-left" && (
            <div className="absolute top-0 left-4 z-20">
              <img 
                src={logoSource} 
                alt="Event Logo 1" 
                style={{ height: `${logoHeight}px` }} 
                className="object-contain max-w-[180px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                crossOrigin={logoSource.startsWith('data:') ? undefined : "anonymous"}
                loading="eager"
                decoding="sync"
              />
            </div>
          )}

          {logoSource && logoPos === "top-right" && (
            <div className="absolute top-0 right-4 z-20">
              <img 
                src={logoSource} 
                alt="Event Logo 1" 
                style={{ height: `${logoHeight}px` }} 
                className="object-contain max-w-[180px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                crossOrigin={logoSource.startsWith('data:') ? undefined : "anonymous"}
                loading="eager"
                decoding="sync"
              />
            </div>
          )}

          {/* Logo 2 positioning (Secondary Logo) */}
          {showLogo2 && logo2Source && logo2Pos === "top-left" && (
            <div className="absolute top-0 left-4 z-20">
              <img 
                src={logo2Source} 
                alt="Logo Secundária" 
                style={{ height: `${logo2Height}px` }} 
                className="object-contain max-w-[180px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                crossOrigin={logo2Source.startsWith('data:') ? undefined : "anonymous"}
                loading="eager"
                decoding="sync"
              />
            </div>
          )}

          {showLogo2 && logo2Source && logo2Pos === "top-right" && (
            <div className="absolute top-0 right-4 z-20">
              <img 
                src={logo2Source} 
                alt="Logo Secundária" 
                style={{ height: `${logo2Height}px` }} 
                className="object-contain max-w-[180px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                crossOrigin={logo2Source.startsWith('data:') ? undefined : "anonymous"}
                loading="eager"
                decoding="sync"
              />
            </div>
          )}

          {/* Top-center logos row if either or both are top-center */}
          {(logoSource && logoPos === "top-center") || (showLogo2 && logo2Source && logo2Pos === "top-center") ? (
            <div className="mb-2.5 flex items-center justify-center gap-6">
              {logoSource && logoPos === "top-center" && (
                <img 
                  src={logoSource} 
                  alt="Event Logo 1" 
                  style={{ height: `${logoHeight}px` }} 
                  className="object-contain max-w-[200px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                  crossOrigin={logoSource.startsWith('data:') ? undefined : "anonymous"}
                  loading="eager"
                  decoding="sync"
                />
              )}
              {showLogo2 && logo2Source && logo2Pos === "top-center" && (
                <img 
                  src={logo2Source} 
                  alt="Logo Secundária" 
                  style={{ height: `${logo2Height}px` }} 
                  className="object-contain max-w-[200px] drop-shadow-sm bg-transparent pointer-events-none select-none" 
                  crossOrigin={logo2Source.startsWith('data:') ? undefined : "anonymous"}
                  loading="eager"
                  decoding="sync"
                />
              )}
            </div>
          ) : null}

          <h1 className={`text-5xl sm:text-6xl font-black tracking-widest uppercase mb-1.5 text-center ${currentTheme.titleColor}`}>
            {titleText}
          </h1>
          <h2 className={`text-xl sm:text-2xl font-semibold tracking-widest uppercase text-center ${currentTheme.subtitleColor}`}>
            {subtitleText}
          </h2>
        </div>

        {/* Central Body Content Section */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 my-4 px-8 overflow-hidden">
          <div className={`${textBoxWidthClass} w-full flex items-center justify-center`}>
            <p 
              className={`${currentTheme.defaultTextStyle} ${customFontWeight} ${customTextAlign}`}
              style={{
                fontSize: customFontSize,
              }}
              dangerouslySetInnerHTML={{ __html: bodyText.replace(/\n/g, '<br />') }}
            ></p>
          </div>
        </div>

        {/* Signatures Row with strict alignment & offset controls - leveled lines */}
        <div 
          className={`relative z-10 flex flex-row items-start ${sigDistributionClass} w-full pb-8 shrink-0 transition-transform`}
          style={{
            transform: `translateY(${sigOffsetY}px)`,
          }}
        >
          {/* Se NÃO for evento de Diocese e estiver ativado Diretor FAJOPA */}
          {showFajopaDirector && (
            <div className="flex flex-col items-center text-center w-[260px] max-w-[280px] shrink-0">
              <div 
                className="w-full flex items-end justify-center leading-none"
                style={{ 
                  height: `${sigHeight}px`,
                  minHeight: `${sigHeight}px`,
                  maxHeight: `${sigHeight}px`,
                  marginBottom: `${sigLineGap}px`
                }}
              >
                {fajopaSigUrl ? (
                  <img 
                    src={fajopaSigUrl} 
                    style={{ maxHeight: `${sigHeight}px` }}
                    className="block max-w-[220px] object-contain transition-all pointer-events-none select-none" 
                    referrerPolicy="no-referrer"
                    loading="eager"
                    decoding="sync"
                    alt="Assinatura Diretor" 
                  />
                ) : (
                  <div className="w-full" style={{ height: `${sigHeight}px` }} />
                )}
              </div>
              <div className={`w-full border-b-2 ${currentTheme.signatureLineColor} mb-2 shrink-0`}></div>
              <h3 className={`text-xl font-bold leading-tight min-h-[28px] flex items-center justify-center ${currentTheme.nameColor}`}>
                {fajopaName || "Diretor FAJOPA"}
              </h3>
              <p className={`text-sm font-medium leading-tight mt-0.5 min-h-[20px] ${currentTheme.roleColor}`}>
                Diretor de Ensino / Acadêmico
              </p>
            </div>
          )}
          
          {/* Se NÃO for evento de Diocese e estiver ativado Reitor do Seminário */}
          {showSeminarRector && (
            <div className="flex flex-col items-center text-center w-[260px] max-w-[280px] shrink-0">
              <div 
                className="w-full flex items-end justify-center leading-none"
                style={{ 
                  height: `${sigHeight}px`,
                  minHeight: `${sigHeight}px`,
                  maxHeight: `${sigHeight}px`,
                  marginBottom: `${sigLineGap}px`
                }}
              >
                {rectorSigUrl ? (
                  <img 
                    src={rectorSigUrl} 
                    style={{ maxHeight: `${sigHeight}px` }}
                    className="block max-w-[220px] object-contain transition-all pointer-events-none select-none" 
                    referrerPolicy="no-referrer"
                    loading="eager"
                    decoding="sync"
                    alt="Assinatura Reitor" 
                  />
                ) : (
                  <div className="w-full" style={{ height: `${sigHeight}px` }} />
                )}
              </div>
              <div className={`w-full border-b-2 ${currentTheme.signatureLineColor} mb-2 shrink-0`}></div>
              <h3 className={`text-xl font-bold leading-tight min-h-[28px] flex items-center justify-center ${currentTheme.nameColor}`}>
                {rectorName || "Reitor"}
              </h3>
              <p className={`text-sm font-medium leading-tight mt-0.5 min-h-[20px] ${currentTheme.roleColor}`}>
                Reitor do Seminário
              </p>
            </div>
          )}

          {/* Assinaturas dos Responsáveis da Diocese ou Personalizadas */}
          {(isDioceseEvent || (!showFajopaDirector && !showSeminarRector) || showSig1 || showSig2 || showSig3) && (
            <>
              {/* Responsável 1 */}
              {showSig1 && (
                <div className="flex flex-col items-center text-center w-[260px] max-w-[280px] shrink-0">
                  <div 
                    className="w-full flex items-end justify-center leading-none"
                    style={{ 
                      height: `${sigHeight}px`,
                      minHeight: `${sigHeight}px`,
                      maxHeight: `${sigHeight}px`,
                      marginBottom: `${sigLineGap}px`
                    }}
                  >
                    {sig1Url ? (
                      <img 
                        src={sig1Url} 
                        style={{ maxHeight: `${sigHeight}px` }}
                        className="block max-w-[220px] object-contain transition-all pointer-events-none select-none" 
                        referrerPolicy="no-referrer"
                        loading="eager"
                        decoding="sync"
                        alt="Assinatura Responsável 1" 
                      />
                    ) : (
                      <div className="w-full" style={{ height: `${sigHeight}px` }} />
                    )}
                  </div>
                  <div className={`w-full border-b-2 ${currentTheme.signatureLineColor} mb-2 shrink-0`}></div>
                  <h3 className={`text-xl font-bold leading-tight min-h-[28px] flex items-center justify-center ${currentTheme.nameColor}`}>
                    {sig1Name || "Nome do Responsável"}
                  </h3>
                  <p className={`text-sm font-medium leading-tight mt-0.5 min-h-[20px] ${currentTheme.roleColor}`}>
                    {sig1Role || (isDioceseEvent ? "Coordenador(a) Diocesano(a)" : "Cargo / Função")}
                  </p>
                </div>
              )}
              
              {/* Responsável 2 */}
              {showSig2 && (
                <div className="flex flex-col items-center text-center w-[260px] max-w-[280px] shrink-0">
                  <div 
                    className="w-full flex items-end justify-center leading-none"
                    style={{ 
                      height: `${sigHeight}px`,
                      minHeight: `${sigHeight}px`,
                      maxHeight: `${sigHeight}px`,
                      marginBottom: `${sigLineGap}px`
                    }}
                  >
                    {sig2Url ? (
                      <img 
                        src={sig2Url} 
                        style={{ maxHeight: `${sigHeight}px` }}
                        className="block max-w-[220px] object-contain transition-all pointer-events-none select-none" 
                        referrerPolicy="no-referrer"
                        loading="eager"
                        decoding="sync"
                        alt="Assinatura Responsável 2" 
                      />
                    ) : (
                      <div className="w-full" style={{ height: `${sigHeight}px` }} />
                    )}
                  </div>
                  <div className={`w-full border-b-2 ${currentTheme.signatureLineColor} mb-2 shrink-0`}></div>
                  <h3 className={`text-xl font-bold leading-tight min-h-[28px] flex items-center justify-center ${currentTheme.nameColor}`}>
                    {sig2Name || (isDioceseEvent ? "Bispo / Assessor Eclesial" : "Segundo Responsável")}
                  </h3>
                  <p className={`text-sm font-medium leading-tight mt-0.5 min-h-[20px] ${currentTheme.roleColor}`}>
                    {sig2Role || (isDioceseEvent ? "Diocese / Pastoral" : "Cargo / Função")}
                  </p>
                </div>
              )}

              {/* Responsável 3 (Opcional) */}
              {showSig3 && (
                <div className="flex flex-col items-center text-center w-[260px] max-w-[280px] shrink-0">
                  <div 
                    className="w-full flex items-end justify-center leading-none"
                    style={{ 
                      height: `${sigHeight}px`,
                      minHeight: `${sigHeight}px`,
                      maxHeight: `${sigHeight}px`,
                      marginBottom: `${sigLineGap}px`
                    }}
                  >
                    {sig3Url ? (
                      <img 
                        src={sig3Url} 
                        style={{ maxHeight: `${sigHeight}px` }}
                        className="block max-w-[220px] object-contain transition-all pointer-events-none select-none" 
                        referrerPolicy="no-referrer"
                        loading="eager"
                        decoding="sync"
                        alt="Assinatura Responsável 3" 
                      />
                    ) : (
                      <div className="w-full" style={{ height: `${sigHeight}px` }} />
                    )}
                  </div>
                  <div className={`w-full border-b-2 ${currentTheme.signatureLineColor} mb-2 shrink-0`}></div>
                  <h3 className={`text-xl font-bold leading-tight min-h-[28px] flex items-center justify-center ${currentTheme.nameColor}`}>
                    {sig3Name || "Terceiro Responsável"}
                  </h3>
                  <p className={`text-sm font-medium leading-tight mt-0.5 min-h-[20px] ${currentTheme.roleColor}`}>
                    {sig3Role || "Cargo / Função"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Verification QR Code & Authentication Stamp */}
        <div className="absolute bottom-5 left-9 z-20 flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-200">
            <QRCodeSVG 
               value={`${typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?cert=` : ''}${event.id.slice(0,8).toUpperCase()}-${(member.id || member.ra || "DOC").slice(0,8).toUpperCase()}`} 
               size={54} 
               level="M" 
               includeMargin={false} 
            />
          </div>
          <div className={`flex flex-col ${template.bgStyle === 'theme-solemn' ? 'text-slate-400' : 'text-slate-600'}`}>
             <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 opacity-80">Autenticidade Oficial</p>
             <p className="text-[12px] font-mono font-bold tracking-wider">{event.id.slice(0,8).toUpperCase()}-{(member.id || member.ra || "DOC").slice(0,8).toUpperCase()}</p>
          </div>
        </div>

        {/* Center-Bottom: Institution Address & Contact (Clean, discreet & official with adjustable vertical offset) */}
        {showInstFooter && (instAddress || instEmail) && (
          <div 
            className="absolute inset-x-0 mx-auto max-w-[640px] text-center z-20 pointer-events-none px-4 transition-all"
            style={{ bottom: `${16 + instFooterOffsetY}px` }}
          >
            <p className={`text-[10px] leading-tight font-medium tracking-normal ${template.bgStyle === 'theme-solemn' ? 'text-slate-400/90' : 'text-slate-600/90'}`}>
              {instAddress && <span>{instAddress}</span>}
              {instAddress && instEmail && <span className="mx-1.5 opacity-60">•</span>}
              {instEmail && <span className="font-mono">{instEmail}</span>}
            </p>
          </div>
        )}

        {/* Institution Brand Stamp */}
        <div className="absolute bottom-5 right-9 opacity-40 pointer-events-none z-20">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${currentTheme.watermarkColor}`}>
            Powered by DAVVERO System & FAJOPA
          </p>
        </div>
      </div>
    );
  }
);

CertificateRenderer.displayName = 'CertificateRenderer';
