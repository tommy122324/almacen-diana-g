import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// En Next.js 16 el antiguo "middleware" se llama ahora "proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas EXCEPTO:
     * - _next/static, _next/image (recursos)
     * - favicon y archivos de imagen
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
