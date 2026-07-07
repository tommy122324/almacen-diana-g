export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-amber-50 p-8 text-center">
      <div className="text-7xl">🐝</div>
      <h1 className="text-4xl font-bold text-amber-900">Contabee</h1>
      <p className="max-w-md text-lg text-amber-800">
        Control diario de ventas, gastos y utilidad para tu negocio.
      </p>
      <span className="rounded-full bg-amber-200 px-4 py-1 text-sm font-medium text-amber-900">
        Fase 0 — esqueleto del proyecto listo ✅
      </span>
      <ul className="mt-4 max-w-md space-y-1 text-left text-sm text-amber-700">
        <li>✔️ Next.js + TypeScript + Tailwind</li>
        <li>✔️ Cliente de Supabase (navegador y servidor)</li>
        <li>✔️ Base de datos con seguridad RLS (supabase/schema.sql)</li>
        <li>✔️ Docker listo para producción</li>
      </ul>
    </main>
  );
}
