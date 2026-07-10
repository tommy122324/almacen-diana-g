// ─── Almacén Diana G 🐝 — API: gestión de colaboradores (solo admin) ───
// Usa la llave de servicio (SUPABASE_SERVICE_ROLE_KEY) que vive SOLO en el servidor.
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

async function verificarAdmin(negocioId: string) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: miembro } = await supa
    .from("miembros")
    .select("rol")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (!miembro || !["dueño", "admin"].includes(miembro.rol as string)) {
    return { error: "No tienes permiso", status: 403 as const };
  }
  return { user };
}

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Límite de intentos por usuario (deterrente básico contra abuso). En memoria del servidor.
const intentos = new Map<string, number[]>();
function dentroDelLimite(clave: string, max: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const previos = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= max) {
    intentos.set(clave, previos);
    return false;
  }
  previos.push(ahora);
  intentos.set(clave, previos);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crear colaborador
export async function POST(req: NextRequest) {
  const { negocioId, nombre, email, password } = await req.json();
  if (!negocioId || !email || !password) {
    return NextResponse.json({ error: "Faltan datos (correo y contraseña)" }, { status: 400 });
  }
  const correo = String(email).trim().toLowerCase();
  const clave = String(password);
  if (!EMAIL_RE.test(correo)) {
    return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
  }
  if (clave.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }
  const auth = await verificarAdmin(negocioId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Máximo 30 colaboradores creados por administrador por hora.
  if (!dentroDelLimite(`crear:${auth.user.id}`, 30, 3600_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." }, { status: 429 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar la llave de servicio en Vercel." }, { status: 500 });

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
  });
  if (error || !creado.user) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el usuario" }, { status: 400 });
  }
  const { error: e2 } = await admin.from("miembros").insert({
    negocio_id: negocioId,
    usuario_id: creado.user.id,
    rol: "empleado",
    email: correo,
    nombre: String(nombre ?? "").slice(0, 80),
  });
  if (e2) {
    // Revertir el usuario si no se pudo asociar
    await admin.auth.admin.deleteUser(creado.user.id);
    return NextResponse.json({ error: e2.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Eliminar colaborador
export async function DELETE(req: NextRequest) {
  const { negocioId, usuarioId } = await req.json();
  if (!negocioId || !usuarioId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const auth = await verificarAdmin(negocioId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // No permitir eliminarse a sí mismo (evita quedar sin acceso).
  if (usuarioId === auth.user.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo." }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar la llave de servicio en Vercel." }, { status: 500 });

  // Verificar el rol del objetivo: nunca se puede eliminar al dueño.
  const { data: objetivo } = await admin
    .from("miembros")
    .select("rol")
    .eq("negocio_id", negocioId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (!objetivo) return NextResponse.json({ error: "El colaborador no existe." }, { status: 404 });
  if (objetivo.rol === "dueño") {
    return NextResponse.json({ error: "No se puede eliminar al dueño del negocio." }, { status: 403 });
  }

  await admin.from("miembros").delete().eq("negocio_id", negocioId).eq("usuario_id", usuarioId);
  await admin.auth.admin.deleteUser(usuarioId);
  return NextResponse.json({ ok: true });
}
