import React, { useState, useEffect, useRef } from 'react';
import type { Member } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../context/SettingsContext';
import { playSound } from '../lib/sounds';

interface FajopaIDCardProps {
  member: Member;
  exportMode?: boolean;
  settings?: {
    directorName?: string;
    rectorName?: string;
    instLogo?: string | null;
    cardLogo?: string | null;
    cardBackLogo?: string | null;
    cardSecondaryBackLogo?: string | null;
    cardFrontText?: string;
    cardBackText?: string;
    url?: string;
    frontLogoConfig?: { x: number; y: number; scale: number };
    backLogoConfig?: { x: number; y: number; scale: number };
    cardBackImage?: string | null;
    cardDescription?: string;
    signatureScale?: number;
    rectorSignatureScale?: number;
    secondaryBackLogoScale?: number;
    instSignature?: string | null;
    rectorSignature?: string | null;
    instName?: string;
    instColor?: string;
    visibleFields?: Record<string, boolean>;
    cardZoom?: number;
  };
}

export default function FajopaIDCard({ member, exportMode = false, settings: propSettings }: FajopaIDCardProps) {
  const { settings: cloudSettings } = useSettings();
  const settings = propSettings || cloudSettings;

  const [flipped, setFlipped] = useState(false);
  
  const handleFlip = () => {
    playSound('flip');
    setFlipped(!flipped);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const emittedAt = member.createdAt ? new Date(member.createdAt).toLocaleDateString('pt-BR') : 'N/D';
  const generatedAt = new Date().toLocaleString('pt-BR');

  const {
    directorName,
    rectorName,
    instLogo,
    cardLogo,
    cardBackLogo,
    cardSecondaryBackLogo,
    cardFrontText,
    cardBackText,
    url: baseUrl,
    frontLogoConfig,
    backLogoConfig,
    cardBackImage,
    cardDescription,
    signatureScale,
    rectorSignatureScale,
    secondaryBackLogoScale = 100,
    instSignature,
    rectorSignature,
    instName,
    instColor,
    visibleFields,
    seminariesConfig
  } = settings;

  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const displayDescription = cardDescription || 'Documento de identificação estudantil é padronizado e apresenta os dados requeridos pela Lei 12.933/2013 para comprovação de matrícula, sendo sua aceitação sujeita aos critérios dos organizadores de eventos.';
  
  const normalizedDiocese = member.diocese?.toUpperCase().trim() || '';
  const isSeminarista = member.roles?.some(r => r.trim().toUpperCase() === 'SEMINARISTA');
  const validDiocese = ['ASSIS', 'PRESIDENTE PRUDENTE', 'OURINHOS', 'ARAÇATUBA', 'ARACATUBA', 'LINS'].includes(normalizedDiocese);
  
  const seminaryOptions = (member.seminary && seminariesConfig?.[member.seminary]) || null;
  const hasSeminaryOptions = !!seminaryOptions;
  
  const showRector = (isSeminarista && validDiocese) || hasSeminaryOptions;
  const showSecondaryLogo = validDiocese || (hasSeminaryOptions && seminaryOptions?.logo);
  
  const directorNameText = directorName?.trim() || 'DIRETOR GERAL';
  const rectorNameText = seminaryOptions?.rectorName?.trim() || rectorName?.trim() || 'REITOR';
  const displaySecondaryBackLogo = seminaryOptions?.logo || cardSecondaryBackLogo;
  const displayRectorSignature = seminaryOptions?.signature || rectorSignature;
  
  const displayLogoFront = cardLogo || instLogo;
  const displayLogoBack = cardBackLogo || cardLogo || instLogo;
  
  const displayInstNameForCard = (isSeminarista && !validDiocese && instName === 'FAJOPA e SPSCJ' && !member.seminary) ? 'FAJOPA' : instName;

  useEffect(() => {
    if (exportMode) return;
    
    const calculateScale = (width: number) => {
       const isPortrait = window.innerWidth < 640 && window.innerHeight > window.innerWidth;
       // If portrait, the card is rotated 90deg, so its visual width is 378.
       // We scale it so it fits into the container width perfectly.
       // Add a slight 5% margin down on portrait to ensure it doesn't touch the very edges.
       return isPortrait ? (width * 0.95) / 378 : width / 600;
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(calculateScale(entry.contentRect.width));
      }
    });

    if (containerRef.current) observer.observe(containerRef.current);
    
    const handleWinResize = () => {
       if (containerRef.current) {
          setScale(calculateScale(containerRef.current.getBoundingClientRect().width));
       }
    };
    window.addEventListener('resize', handleWinResize);
    
    return () => {
       observer.disconnect();
       window.removeEventListener('resize', handleWinResize);
    };
  }, [exportMode]);
  
  const verificationUrl = `${cleanBaseUrl}?verify=${member.alphaCode}`;

  const safeName = member.name?.toUpperCase() || 'N/D';
  const safeRA = member.ra || 'N/D';
  const safeCourse = member.course?.toUpperCase() || 'N/D';
  const safeBirth = member.birthdate ? new Date(member.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/D';
  const safeDate = member.validityDate ? new Date(member.validityDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'Pelo Qr code';
  
  const avatarUrl = member.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=e2e8f0&color=475569`;

  const frontSide = (
    <div 
      className={`absolute w-[600px] h-[378px] print-card bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-100 overflow-hidden shadow-2xl shrink-0`} 
      style={{ 
        borderRadius: '16px', 
        border: '1px solid rgba(0,0,0,0.1)',
        WebkitBackfaceVisibility: exportMode ? 'visible' : 'hidden',
        backfaceVisibility: exportMode ? 'visible' : 'hidden',
        transform: exportMode ? 'none' : 'translate3d(0,0,0)',
        WebkitTransform: exportMode ? 'none' : 'translate3d(0,0,0)'
      }}
    >
      {/* Top Divider / Header Decor */}
      <div 
        className="absolute top-0 left-0 w-full h-[22%] border-b-4 flex items-center justify-between px-[5%] z-20 shadow-sm"
        style={{ 
          backgroundColor: '#0c1222', // Very dark for contrast
          borderBottomColor: instColor 
        }}
      >
         <h1 className="text-white font-black tracking-tighter whitespace-nowrap" style={{ fontSize: '18px' }}>
            {isSeminarista ? 'DOCUMENTO ESTUDANTIL E VOCACIONAL' : (cardFrontText || 'IDENTIFICAÇÃO ESTUDANTIL')}
         </h1>
         <span className="text-white opacity-80 text-[9px] font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded-full uppercase ml-1">
           {displayInstNameForCard}
         </span>
      </div>

      {/* Dark Red Bottom Decorative Border */}
      <div 
        className="absolute bottom-0 left-0 w-full h-[6%] z-30 flex flex-col pt-[1px]"
        style={{ 
          backgroundColor: '#7f1d1d' // Dark red
        }}
      >
        <div style={{ height: '3px', backgroundColor: '#fbbf24', width: '100%' }}></div>
        {(isSeminarista || member.seminary) && (member.seminary || validDiocese) && (
          <div className="w-full flex-1 flex items-center justify-center">
             <span className="text-white font-semibold uppercase tracking-wide opacity-95 mx-4 whitespace-nowrap" style={{ fontSize: '6px' }}>
               {member.seminary ? (member.seminary.includes('SPSCJ') || member.seminary.includes('Sagrado Coração de Jesus') ? "SPSCJ - Seminário Provincial Sagrado Coração de Jesus" : member.seminary) : "SPSCJ - Seminário Provincial Sagrado Coração de Jesus"}
             </span>
          </div>
        )}
      </div>

      {/* Bottom Footer block */}
      <div className="absolute bottom-[4%] left-0 w-[60%] h-[26%]" style={{ backgroundColor: '#0c1222', clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 0 }}></div>
      <div className="absolute bottom-0 left-0 w-[55%] h-[20%]" style={{ backgroundColor: '#0f172a', clipPath: 'polygon(0 40%, 100% 100%, 0 100%)', zIndex: 1 }}></div>

      <div 
        className="absolute bottom-[6%] left-[20%] right-[32%] h-[17%] flex items-center justify-center z-2" 
        style={{ 
          backgroundColor: '#0f172a',
          clipPath: 'polygon(5% 0, 100% 0, 100% 100%, 0 100%)' 
        }}
      >
         <span className="text-white font-bold tracking-widest uppercase pl-4 flex items-center gap-1.5" style={{ fontSize: '12px' }}>
           {(!instName || instName === 'Vero ID' || instName === 'A vero ID' || instName === 'DA VERO-ID' || instName === 'DAVVERO System' || instName === 'FAJOPA e SPSCJ') && (
              <svg viewBox="0 0 100 100" className="w-[14px] h-[14px] text-white shrink-0">
                <path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
                <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
                <path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" />
              </svg>
           )}
           {member.roles?.join(' • ') || 'ESTUDANTE'}
         </span>
      </div>

      {/* Texts over left bottom - Clean design for CÓD USO */}
      <div className="absolute bottom-[7%] left-[4%] text-white z-10 flex flex-col items-center px-2 py-1 rounded-sm border-l-2 border-cyan-400 bg-black/10">
        <span className="font-bold tracking-wider leading-none" style={{ fontSize: '8px', opacity: 0.8 }}>CÓD. USO</span>
        <span className="font-bold tracking-widest leading-none mt-1" style={{ fontSize: '13px' }}>
          {member.alphaCode}
        </span>
      </div>

      {/* Left Values List - Reduced width to avoid logo */}
      <div className="absolute top-[26%] left-[3%] w-[58%] h-[48%] flex flex-col justify-around z-20">
        {[
          { id: 'name', label: 'NOME:', value: safeName, w: '100%', isName: true, border: '1.5px' },
          { id: 'ra', label: 'R.A.:', value: safeRA, w: '50%', border: '1.5px' },
          { id: 'course', label: 'CURSO:', value: safeCourse, w: '50%', border: '1.5px' },
          { id: 'birth', label: 'NASC:', value: safeBirth, w: '50%', border: '1.5px' },
          { id: 'validity', label: 'VAL:', value: safeDate, w: '50%', border: '1.5px' },
          { id: 'diocese', label: 'DIOCESE:', value: member.diocese || '-', w: ((member.diocese?.length || 0) < 15 ? '50%' : '65%'), border: '1.5px' },
        ].filter(r => visibleFields?.[r.id]).map((row, i) => (
          <div key={i} className={`flex bg-white rounded-full border-[${row.border}] border-slate-400 overflow-hidden shadow-sm items-center ${row.isName ? 'h-[22%]' : 'h-[14%]'}`} style={{ width: row.w }}>
            <span className="bg-white text-blue-900 font-bold px-2 flex items-center justify-center h-full border-r-[1.5px] border-slate-300 tracking-tight shrink-0" style={{ fontSize: '10px' }}>
              {row.label}
            </span>
            <span className={`text-slate-800 font-bold px-2 bg-white flex-1 h-full flex items-center ${row.isName ? 'text-left justify-start whitespace-normal leading-[1.05] break-words' : 'justify-center whitespace-nowrap overflow-hidden text-ellipsis'}`} style={{ fontSize: row.isName ? '12px' : '10px' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

       {/* Center Logo FAJOPA */}
      {visibleFields.logo && (
        <div 
          className="absolute bottom-[23%] left-[36%] w-[28%] h-[50%] flex flex-col items-center justify-center opacity-95 z-10 pointer-events-none"
          style={{
            transform: `translate(${frontLogoConfig.x}px, ${frontLogoConfig.y}px) scale(${frontLogoConfig.scale / 100})`,
          }}
        >
           {displayLogoFront ? (
              <img 
                src={displayLogoFront} 
                crossOrigin="anonymous"
                alt="Logo Inst" 
                className="w-[85%] h-[85%] object-contain" 
                style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
              />
           ) : (
              <svg 
                viewBox="0 0 300 300" 
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
              >
                 {/* Left Wing (Light Blue - layered feathers) */}
                 <path d="M140,165 C110,165 40,140 10,70 C50,110 110,140 140,145 Z" fill="#2096d3"/>
                 <path d="M140,165 C100,175 30,160 5,100 C50,140 110,155 140,155 Z" fill="#1b7db0"/>
                 <path d="M140,165 C80,185 20,185 10,135 C50,170 110,175 140,165 Z" fill="#16628c"/>
                 
                 {/* Right Wing (Dark Blue - layered feathers) */}
                 <path d="M150,165 C180,165 250,140 280,70 C240,110 180,140 150,145 Z" fill="#1d2d5b"/>
                 <path d="M150,165 C190,175 260,160 285,100 C240,140 180,155 150,155 Z" fill="#18254b"/>
                 <path d="M150,165 C210,185 270,185 280,135 C240,170 180,175 150,165 Z" fill="#121b36"/>

                 {/* Bird Body/Head */}
                 <path d="M145,170 Q135,130 145,90 Q155,75 160,85 Q155,85 150,95 Q145,100 145,170 Z" fill="#2096d3" />

                 {/* Ribbon */}
                 <path d="M25,195 Q145,175 265,195 L265,220 Q145,200 25,220 Z" fill="#1d2d5b" />
                 <path d="M25,195 L5,230 L40,217 Z" fill="#0f172a" />
                 <path d="M265,195 L285,230 L250,217 Z" fill="#0f172a" />

                 <path id="ribbon-curve-front-dynamic" d="M35,214 Q145,194 255,214" fill="none" />
                 <text fill="white" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="1.2">
                    <textPath href="#ribbon-curve-front-dynamic" startOffset="50%">FIDES ET RATIO</textPath>
                 </text>

                 <text x="145" y="265" fill="#1d2d5b" fontFamily="Impact, Arial Black, sans-serif" fontSize="48" fontWeight="900" textAnchor="middle" letterSpacing="1">FAJOPA</text>
                 <text x="145" y="285" fill="#333333" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="0.3">FACULDADE JOÃO PAULO II</text>
              </svg>
           )}
        </div>
      )}

      {/* Right Area (Photo & QR Code) - Reduced height to avoid footer overlap */}
      <div className="absolute top-[20%] right-[3%] w-[28%] h-[72%] flex flex-col items-center justify-start pt-[2%] z-10">
        {visibleFields.photo && (
          <div className="w-[100%] bg-white rounded-[5%] border-[3px] border-slate-800 overflow-hidden shadow-md" style={{ aspectRatio: '3/3.5' }}>
            <img src={avatarUrl} crossOrigin="anonymous" alt="Fotografia" className="w-full h-full object-cover" />
          </div>
        )}
        
        {visibleFields.qrcode && (
          <div className={`flex flex-row items-center mt-[15%] ${showSecondaryLogo && displaySecondaryBackLogo ? 'w-[105%] ml-[5%] gap-0' : 'w-[55%]'}`}>
            <div className="flex-1 aspect-square bg-white border-[2px] border-slate-800 p-1 shadow-sm">
               <QRCodeSVG 
                value={verificationUrl} 
                size={256}
                style={{ width: '100%', height: '100%' }}
                level="M" 
                includeMargin={false}
              />
            </div>
            {showSecondaryLogo && displaySecondaryBackLogo && (
               <img src={displaySecondaryBackLogo} alt="Logo Diocese/Seminário" className="flex-none w-[50%] object-contain" />
            )}
          </div>
        )}
      </div>
    </div>
  );

  const backSide = (
    <div 
      className={`absolute w-[600px] h-[378px] print-card overflow-hidden shadow-2xl shrink-0`} 
      style={{ 
        borderRadius: '16px', 
        border: '1px solid rgba(0,0,0,0.1)',
        WebkitBackfaceVisibility: exportMode ? 'visible' : 'hidden',
        backfaceVisibility: exportMode ? 'visible' : 'hidden',
        transform: exportMode ? 'none' : 'rotateY(180deg)',
        WebkitTransform: exportMode ? 'none' : 'rotateY(180deg)',
        backgroundColor: '#f8fafc',
        backgroundImage: cardBackImage ? `url(${cardBackImage})` : 'linear-gradient(to br, #eef2ff, #f0f9ff)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Acrylic overlay for better readability if custom background is used */}
      {cardBackImage && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-0"></div>
      )}

      {/* Top left decors - Only show if NO custom background */}
      {!cardBackImage && (
        <>
          <div className="absolute top-0 left-0 w-[45%] h-[35%] bg-blue-950" style={{ clipPath: 'polygon(0 0, 100% 0, 30% 100%, 0 100%)' }}></div>
          <div className="absolute top-0 left-0 w-[35%] h-[25%] bg-cyan-500" style={{ clipPath: 'polygon(0 0, 100% 0, 40% 100%, 0 100%)' }}></div>
        </>
      )}
      
      <div className={`absolute top-[10%] w-[86%] left-[7%] text-center text-blue-950 font-bold leading-tight ${cardBackImage ? 'bg-white/80 shadow-md border border-white' : 'bg-white/95 border-[2px] border-slate-200 shadow-md'} backdrop-blur-md rounded-xl p-2 z-10 flex flex-col justify-center`} style={{ fontSize: '11px', minHeight: '40px' }}>
        Este cartão é pessoal e intransferível, sendo o usuário responsável pela utilização. Em caso de perda, avise imediatamente a secretaria da faculdade.
      </div>

      <div className="absolute top-[28%] w-full flex flex-col items-center z-10">
        <div className="w-full flex justify-center gap-10 px-4">
          {/* Signature 1: Director */}
          {(visibleFields?.signature !== false || visibleFields?.director !== false) && (
            <div className="flex flex-col items-center min-w-[140px] max-w-[180px]">
               {visibleFields?.signature !== false && (
                <div className="w-full h-[45px] border-b-[2px] border-slate-800 flex items-center justify-center pb-1">
                   {instSignature && (
                     <img 
                       src={instSignature} 
                       alt="Assinatura Diretor" 
                       className="w-auto object-contain" 
                       style={{ 
                         height: `${(signatureScale / 100) * 110}%`,
                         marginBottom: `-${(signatureScale / 100) * 6}%` 
                       }} 
                     />
                   )}
                </div>
              )}
              
              {visibleFields?.director !== false && (
                <div className="flex flex-col items-center mt-1 leading-tight text-center">
                  <div className="text-slate-800 font-bold uppercase tracking-tight text-[9px] leading-tight mb-0.5 whitespace-normal">{directorNameText}</div>
                  <div className="text-blue-900 font-bold text-[7px] leading-tight uppercase">Diretor Geral</div>
                </div>
              )}
            </div>
          )}

          {/* Signature 2: Rector */}
          {showRector && (visibleFields?.rectorSignature !== false || visibleFields?.rector !== false) && (
            <div className="flex flex-col items-center min-w-[140px] max-w-[180px]">
               {visibleFields?.rectorSignature !== false && (
                <div className="w-full h-[45px] border-b-[2px] border-slate-800 flex items-center justify-center pb-1">
                   {displayRectorSignature && (
                     <img 
                       src={displayRectorSignature} 
                       alt="Assinatura Reitor" 
                       className="w-auto object-contain" 
                       style={{ 
                         height: `${((rectorSignatureScale || 100) / 100) * 110}%`,
                         marginBottom: `-${((rectorSignatureScale || 100) / 100) * 6}%` 
                       }} 
                     />
                   )}
                </div>
              )}
              
              {visibleFields?.rector !== false && (
                <div className="flex flex-col items-center mt-1 leading-tight text-center">
                  <div className="text-slate-800 font-bold uppercase tracking-tight text-[9px] leading-tight mb-0.5 whitespace-normal">{rectorNameText}</div>
                  <div className="text-blue-900 font-bold text-[7px] leading-tight uppercase">Reitor do Seminário</div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {visibleFields.logo && (
          <div 
            className="mt-[1%] flex items-center justify-center gap-2 opacity-90 pb-1"
            style={{
              transform: `translate(${backLogoConfig.x}px, ${backLogoConfig.y}px) scale(${backLogoConfig.scale / 100})`,
            }}
          >
             <div className="w-[50px] h-[50px] shrink-0">
                {displayLogoBack ? (
                   <img 
                      src={displayLogoBack} 
                      crossOrigin="anonymous"
                      alt="Logo" 
                      className="w-full h-full object-contain" 
                      style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
                   />
                ) : (
                   <svg 
                      viewBox="0 0 300 170" 
                      className="w-full h-full pb-2"
                      style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
                   >
                      <defs>
                         <linearGradient id="wd2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1e3a8a" />
                            <stop offset="100%" stopColor="#0f172a" />
                         </linearGradient>
                         <linearGradient id="wl2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0284c7" />
                            <stop offset="100%" stopColor="#0369a1" />
                         </linearGradient>
                      </defs>

                      {/* Left Wing (Light Blue - layered feathers) */}
                      <path d="M140,165 C110,165 40,140 10,70 C50,110 110,140 140,145 Z" fill="url(#wl2)"/>
                      <path d="M140,165 C100,175 30,160 5,100 C50,140 110,155 140,155 Z" fill="url(#wl2)" opacity="0.8"/>
                      <path d="M140,165 C80,185 20,185 10,135 C50,170 110,175 140,165 Z" fill="url(#wl2)" opacity="0.6"/>
                      
                      {/* Right Wing (Dark Blue - layered feathers) */}
                      <path d="M150,165 C180,165 250,140 280,70 C240,110 180,140 150,145 Z" fill="url(#wd2)"/>
                      <path d="M150,165 C190,175 260,160 285,100 C240,140 180,155 150,155 Z" fill="url(#wd2)" opacity="0.8"/>
                      <path d="M150,165 C210,185 270,185 280,135 C240,170 180,175 150,165 Z" fill="url(#wd2)" opacity="0.6"/>

                      <path d="M145,170 Q135,130 145,90 Q155,75 160,85 Q155,85 150,95 Q145,100 145,170 Z" fill="#2096d3" />
                   </svg>
                )}
             </div>
             <div className="flex flex-col text-left">
                <div className="flex items-center gap-1">
                  <span className="text-blue-900 font-black tracking-tighter" style={{ fontSize: '22px', lineHeight: '1' }}>{cardBackText || displayInstNameForCard}</span>
                </div>
                {instName === 'FAJOPA' && (
                  <div className="bg-blue-900 text-white rounded font-bold px-1 py-0.5 text-center mt-0.5 whitespace-nowrap shadow-sm" style={{ fontSize: '8px' }}>
                     FIDES ET RATIO
                  </div>
                )}
                <span className="text-blue-800 font-bold tracking-tight mt-1 leading-none" style={{ fontSize: '9px' }}>
                  {baseUrl.replace('https://', '').replace('http://', '')}
                </span>
             </div>

             {showSecondaryLogo && cardSecondaryBackLogo && (
               <div 
                 className="ml-1 shrink-0 flex items-center justify-center transition-all"
                 style={{
                   width: `${50 * (secondaryBackLogoScale / 100)}px`,
                   height: `${50 * (secondaryBackLogoScale / 100)}px`
                 }}
               >
                 <img 
                    src={cardSecondaryBackLogo} 
                    crossOrigin="anonymous"
                    alt="Logo Secundária" 
                    className="w-full h-full object-contain" 
                    style={{ filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 1px white)' }}
                 />
               </div>
             )}
          </div>
        )}
        
        <div className="mt-[1%] w-[85%] text-center text-blue-900 font-bold leading-tight whitespace-pre-line" style={{ fontSize: '11px' }}>
          {displayDescription}
        </div>
      </div>

      <div className="absolute top-[2%] right-[4%] opacity-80 text-[7px] text-right font-bold text-blue-950 pointer-events-none leading-relaxed select-none z-20">
         ©2025 - Alison Fernando Rodrigues dos Santos - {cardFrontText || 'DAVVERO System'}<br/>
         Emitido em: {emittedAt} • Gerado digitalmente: {generatedAt}
      </div>

      {/* Bottom Footer decors */}
      <div className="absolute bottom-[8%] right-0 w-[25%] h-[15%] bg-blue-950" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>
      <div className="absolute bottom-[4%] right-0 w-[15%] h-[10%] bg-cyan-500" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>

      {visibleFields.footer && (
        <div className="absolute bottom-0 left-[5%] right-[5%] h-[14%] bg-blue-950 flex flex-col justify-center text-center px-[2%]" style={{ clipPath: 'polygon(2% 0, 98% 0, 100% 100%, 0 100%)' }}>
           <span className="text-white font-medium" style={{ fontSize: '10px' }}>
             Rua Bartolomeu de Gusmão, 531, São Miguel, Marília-SP, CEP 17506-280. Tel: (14) 3414-1965 - secretaria@fajopa.edu.br
           </span>
        </div>
      )}
    </div>
  );

  if (exportMode) {
    return (
      <div className="print:fixed print:inset-0 print:bg-white print:z-[9999] print:overflow-visible print:opacity-100 print:w-[210mm] print:h-auto print:pointer-events-auto" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
        <div id="export-card-node-internal" className="flex flex-col w-[600px] items-center p-8 bg-white print:p-0 print:bg-transparent" style={{ position: 'relative' }}>
          <div className="hidden print:block print-header">
            Identificação Estudantil - FAJOPA
          </div>
          <div className="relative w-[600px] h-[378px] print-card mb-8">
            {frontSide}
          </div>
          <div className="relative w-[600px] h-[378px] print-card">
             {backSide}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="perspective-1000 w-full max-w-[600px] aspect-[1.586/1] max-sm:portrait:aspect-[1/1.586] mx-auto cursor-pointer focus:outline-none no-print transition-transform origin-center flex items-center justify-center max-sm:portrait:my-4 sm:portrait:my-0" 
      onClick={handleFlip}
    >
      <div style={{ transform: `scale(calc(${scale} * var(--card-zoom, 1)))`, transformOrigin: 'center center' }}>
        <div className="w-[600px] h-[378px] transition-transform duration-500 max-sm:portrait:rotate-90 origin-center">
           <div 
          className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}
          style={{ 
            transformStyle: 'preserve-3d', 
            WebkitTransformStyle: 'preserve-3d',
            perspective: '1000px',
            WebkitPerspective: '1000px'
          }}
        >
          {frontSide}
          {backSide}
        </div>
        </div>
      </div>
    </div>
  );
}
