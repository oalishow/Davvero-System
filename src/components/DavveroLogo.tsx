import React, { useState } from 'react';

interface DavveroLogoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  color?: string;
  fallbackToSvg?: boolean;
}

export function DavveroLogoSvg({
  color = "currentColor",
  className = "w-full h-full",
  shieldStroke = 5.5,
  crossStroke = 3,
}: {
  color?: string;
  className?: string;
  shieldStroke?: number;
  crossStroke?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ color }} xmlns="http://www.w3.org/2000/svg">
      {/* Shield Outline */}
      <path
        d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={shieldStroke}
        strokeLinejoin="round"
      />
      {/* Hollow Cross */}
      <path
        d="M42,15 L58,15 L58,28 L71,28 L71,44 L58,44 L58,65 L42,65 L42,44 L29,44 L29,28 L42,28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={crossStroke}
        strokeLinejoin="round"
      />
      {/* Academic Cap / Mortarboard */}
      <g transform="translate(20, 38) scale(0.6)">
        <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
        <path
          d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z"
          fill="currentColor"
          opacity="0.85"
        />
        <path
          d="M50,45 L78,55 L78,70"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="78" cy="72" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

export function getDavveroSvgHtml(color = '#0284c7', size = 38): string {
  return `<svg viewBox="0 0 100 100" style="width: ${size}px; height: ${size}px; color: ${color}; display: inline-block; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg"><path d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round" /><path d="M42,15 L58,15 L58,28 L71,28 L71,44 L58,44 L58,65 L42,65 L42,44 L29,44 L29,28 L42,28 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" /><g transform="translate(20, 38) scale(0.6)"><path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" /><path d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z" fill="currentColor" opacity="0.85" /><path d="M50,45 L78,55 L78,70" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="78" cy="72" r="4" fill="currentColor"/></g></svg>`;
}

export default function DavveroLogo({
  src,
  alt = "DAVVERO Logo",
  className = "w-full h-full object-contain",
  iconClassName = "w-full h-full",
  color,
  fallbackToSvg = true,
}: DavveroLogoProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setImgError(true)}
      />
    );
  }

  if (fallbackToSvg) {
    return <DavveroLogoSvg color={color} className={iconClassName} />;
  }

  return (
    <img
      src="/icon-512.png"
      alt={alt}
      className={className}
      onError={(e) => {
        // Fallback to inline svg if image fails
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
