import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida optimizada para Docker (imagen mínima).
  output: "standalone",
  // Fija la raíz del proyecto (evita que Next tome un lockfile de una carpeta superior).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
