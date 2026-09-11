"use client";

import { useId } from "react";

/**
 * Brand logo for Zereyakob non-profit: a rising sun, graduation cap and open
 * book beside a small heart — children, education, care.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd77a" />
          <stop offset="1" stopColor="#f5a623" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="48" height="48" rx="13" fill={`url(#${id}-bg)`} />

      {/* rising sun */}
      <g stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <path d="M24 4.2v3.6" />
        <path d="M10.2 8.2l2.2 2.2" />
        <path d="M37.8 8.2l-2.2 2.2" />
      </g>
      <circle cx="24" cy="12.5" r="3.4" fill={`url(#${id}-sun)`} />

      {/* graduation cap */}
      <path d="M15 19.5 24 16l9 3.5-9 3.5z" fill="rgba(255,255,255,0.96)" />
      <circle cx="24" cy="16" r="1.15" fill="#1e40af" />
      <path
        d="M15 19.5v4M33 19.5v4"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* open book */}
      <path
        d="M11 29.5c3-2.4 6.4-2.8 9.8-1.4l3.2 1.3v16l-3.2-1.3c-3.4-1.4-6.8-1-9.8 1.4z"
        fill="rgba(255,255,255,0.94)"
      />
      <path
        d="M37 29.5c-3-2.4-6.4-2.8-9.8-1.4l-3.2 1.3v16l3.2-1.3c3.4-1.4 6.8-1 9.8 1.4z"
        fill="rgba(255,255,255,0.72)"
      />
      <path
        d="M24 29.4v16"
        stroke="rgba(30,64,175,0.35)"
        strokeWidth="1.5"
      />

      {/* caring heart */}
      <path
        d="M24 37.8c-.85-1.55-3.05-2.5-4.35-1.15-1.4 1.35-.6 3.3 4.35 6.7 4.95-3.4 5.75-5.35 4.35-6.7C27.05 35.3 24.85 36.25 24 37.8Z"
        fill="#ffd77a"
      />
    </svg>
  );
}