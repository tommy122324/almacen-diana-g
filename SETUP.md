# Contabee 🐝 — Guía de arranque (Fase 0)

## Requisitos ya instalados en tu equipo
- Node 22 ✅ · npm 11 ✅ · Git ✅ · Docker ✅

## 1) Correr la app localmente (ya funciona)
```bash
npm run dev
```
Abre http://localhost:3000 → verás la pantalla de bienvenida de Contabee.

## 2) Crear el proyecto en Supabase (gratis)
1. Entra a https://supabase.com y crea una cuenta.
2. **New Project** → nombre "contabee", elige una región cercana y una contraseña de BD.
3. Cuando esté listo, ve a **Project Settings → API** y copia:
   - `Project URL`  → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public`  → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreta)

## 3) Configurar variables de entorno
1. Copia `.env.example` como `.env.local`.
2. Pega los valores del paso anterior.
   > `.env.local` está ignorado por git: nunca se sube. ✅

## 4) Crear las tablas y la seguridad (RLS)
1. En Supabase, abre **SQL Editor → New query**.
2. Pega TODO el contenido de `supabase/schema.sql` y ejecútalo (**Run**).
3. Debe crear las tablas (negocios, ventas, gastos, fiados, etc.) con RLS activado.

## 5) Reiniciar la app
```bash
npm run dev
```
Con las variables puestas, el sistema de login ya quedará activo (se construye en Fase 1).

## Correr con Docker (opcional)
```bash
docker compose up --build
```
(Requiere `.env.local` con los valores de Supabase.)

---
Cuando termines los pasos 2–4, avísame y seguimos con la **Fase 1: MVP funcional**
(login, negocios, registro diario, fiados y cuadre).
