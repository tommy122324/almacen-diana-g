@AGENTS.md

# Contabee 🐝

SaaS multi-tenant de registro diario de ventas, gastos, entradas, fiados y utilidad,
con reportes y cierre de mes. Web + app instalable (PWA). Ver `REQUISITOS.md` para el
detalle completo de requisitos y arquitectura.

## Stack
- Next.js 16 (App Router, TypeScript, src/) + Tailwind CSS 4
- Supabase (PostgreSQL + Auth) — multi-tenant con Row Level Security
- Recharts (gráficas), Docker (entorno), Vercel (deploy)
- Moneda: COP (pesos), enteros sin decimales

## Estructura clave
- `src/lib/supabase/` — clientes de Supabase (client / server / middleware)
- `src/middleware.ts` — refresca sesión y protege rutas
- `supabase/schema.sql` — tablas, funciones y políticas RLS (ejecutar en Supabase SQL Editor)

## Convenciones
- Toda tabla nueva debe tener RLS habilitado y políticas basadas en `es_miembro()` / `es_admin()`.
- Los totales NO se guardan: se calculan con consultas.
- Textos de la interfaz en español.

## Comandos
- `npm run dev` — desarrollo local (http://localhost:3000)
- `npm run build` / `npm start` — producción
- `docker compose up --build` — correr en contenedor (requiere .env.local)
