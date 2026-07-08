"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, NotebookPen, Package, FileBarChart, Settings } from "lucide-react";

const items = [
  { href: "/", label: "Panel", corto: "Panel", icon: LayoutDashboard },
  { href: "/dia", label: "Registro del día", corto: "Registro", icon: NotebookPen },
  { href: "/apartados", label: "Apartados", corto: "Apartados", icon: Package },
  { href: "/reportes", label: "Reportes", corto: "Reportes", icon: FileBarChart },
  { href: "/ajustes", label: "Ajustes", corto: "Ajustes", icon: Settings },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map(({ href, label, corto, icon: Icon }) => {
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
            <span className="md:hidden">{corto}</span>
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
