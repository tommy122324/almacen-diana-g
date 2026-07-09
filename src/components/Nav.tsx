"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, NotebookPen, Package, FileBarChart, Settings, Clock, ListChecks } from "lucide-react";
import { useStore } from "@/lib/store";

const items = [
  { href: "/", label: "Panel", corto: "Panel", icon: LayoutDashboard, soloAdmin: false },
  { href: "/dia", label: "Registro del día", corto: "Registro", icon: NotebookPen, soloAdmin: false },
  { href: "/apartados", label: "Apartados", corto: "Apartados", icon: Package, soloAdmin: false },
  { href: "/tareas", label: "Tareas", corto: "Tareas", icon: ListChecks, soloAdmin: false },
  { href: "/nomina", label: "Nómina", corto: "Nómina", icon: Clock, soloAdmin: false },
  { href: "/reportes", label: "Reportes", corto: "Reportes", icon: FileBarChart, soloAdmin: true },
  { href: "/ajustes", label: "Ajustes", corto: "Ajustes", icon: Settings, soloAdmin: true },
];

export function Nav() {
  const path = usePathname();
  const esAdmin = useStore((s) => s.esAdmin);
  const visibles = items.filter((i) => !i.soloAdmin || esAdmin);
  return (
    <nav className="flex gap-1 md:flex-col">
      {visibles.map(({ href, label, corto, icon: Icon }) => {
        // El colaborador ve nombres en primera persona
        let etiqueta = label;
        let etiquetaCorta = corto;
        if (!esAdmin && href === "/nomina") { etiqueta = "Mi entrada"; etiquetaCorta = "Entrada"; }
        if (!esAdmin && href === "/tareas") { etiqueta = "Mis tareas"; etiquetaCorta = "Tareas"; }
        const activo = path === href;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors md:flex-row md:gap-2 md:text-sm",
              activo ? "bg-amber-500 text-white shadow-sm" : "text-stone-500 hover:bg-stone-100",
            )}
          >
            <Icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" />
            <span className="md:hidden">{etiquetaCorta}</span>
            <span className="hidden md:inline">{etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}
