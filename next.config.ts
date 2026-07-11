import type { NextConfig } from "next";

// Cabeceras de seguridad aplicadas a todas las respuestas.
// (No incluimos una CSP estricta de scripts para no romper Next/Tailwind; sí bloqueamos
//  el embebido en iframes, el sniffing de tipos, y forzamos HTTPS.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Salida optimizada para Docker (imagen mínima).
  output: "standalone",
  // Fija la raíz del proyecto (evita que Next tome un lockfile de una carpeta superior).
  turbopack: {
    root: __dirname,
  },
  // Identificador de la versión desplegada (para avisar cuando hay una nueva).
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
