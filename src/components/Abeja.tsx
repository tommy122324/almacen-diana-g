"use client";
import { useId } from "react";

/** La abejita del almacén (SVG animado con CSS: alas que aletean y guiño). */
export function Abeja({ size = 120, guino = false, className = "" }: { size?: number; guino?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 130 100"
      width={size}
      height={(size * 100) / 130}
      className={`${guino ? "abeja-guinar" : ""} ${className}`}
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`cuerpo-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`cabeza-${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <clipPath id={`clip-${id}`}>
          <ellipse cx="58" cy="60" rx="34" ry="25" />
        </clipPath>
      </defs>

      {/* Alas */}
      <g opacity="0.85">
        <ellipse className="abeja-ala" cx="50" cy="26" rx="15" ry="24" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5" />
        <ellipse className="abeja-ala abeja-ala-2" cx="68" cy="24" rx="15" ry="25" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5" />
      </g>

      {/* Aguijón */}
      <path d="M26 56 L12 60 L26 65 Z" fill="#78350f" />

      {/* Cuerpo con rayas */}
      <ellipse cx="58" cy="60" rx="34" ry="25" fill={`url(#cuerpo-${id})`} />
      <g clipPath={`url(#clip-${id})`} fill="#78350f">
        <rect x="40" y="30" width="9" height="60" rx="3" />
        <rect x="58" y="30" width="9" height="60" rx="3" />
      </g>
      <ellipse cx="50" cy="48" rx="12" ry="5" fill="#fff" opacity="0.35" />

      {/* Antenas */}
      <path d="M92 40 Q90 22 80 16" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M100 40 Q106 22 116 18" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="80" cy="16" r="3.5" fill="#78350f" />
      <circle cx="116" cy="18" r="3.5" fill="#78350f" />

      {/* Cabeza */}
      <circle cx="96" cy="56" r="21" fill={`url(#cabeza-${id})`} />
      {/* Cachetes */}
      <circle cx="86" cy="64" r="4" fill="#fb7185" opacity="0.45" />
      <circle cx="109" cy="64" r="4" fill="#fb7185" opacity="0.45" />
      {/* Ojos */}
      <g>
        <circle cx="90" cy="52" r="4.6" fill="#292524" />
        <circle cx="91.6" cy="50.4" r="1.6" fill="#fff" />
      </g>
      <g className="abeja-ojo-guino">
        <circle cx="104" cy="52" r="4.6" fill="#292524" />
        <circle cx="105.6" cy="50.4" r="1.6" fill="#fff" />
      </g>
      {/* Sonrisa */}
      <path d="M90 63 Q97 70 104 63" stroke="#78350f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
