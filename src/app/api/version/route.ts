import { NextResponse } from "next/server";

// Devuelve el identificador de la versión desplegada actualmente.
// La app lo consulta para saber si hay una versión más nueva que la que tiene cargada.
export const dynamic = "force-dynamic";

export async function GET() {
  const id = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
