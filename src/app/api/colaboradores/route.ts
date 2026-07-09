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

// Crear colaborador
export async function POST(req: NextRequest) {
  const { negocioId, nombre, email, password } = await req.json();
  if (!negocioId || !email || !password) {
    return NextResponse.json({ error: "Faltan datos (correo y contraseña)" }, { status: 400 });
  }
  const auth = await verificarAdmin(negocioId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar la llave de servicio en Vercel." }, { status: 500 });

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
  });
  if (error || !creado.user) {
    return NextResponse.json({ error: error?.message || "No se pudo crear el usuario" }, { status: 400 });
  }
  const { error: e2 } = await admin.from("miembros").insert({
    negocio_id: negocioId,
    usuario_id: creado.user.id,
    rol: "empleado",
    email: String(email).trim(),
    nombre: (nombre as string) || "",
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

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar la llave de servicio en Vercel." }, { status: 500 });

  await admin.from("miembros").delete().eq("negocio_id", negocioId).eq("usuario_id", usuarioId);
  await admin.auth.admin.deleteUser(usuarioId);
  return NextResponse.json({ ok: true });
}
