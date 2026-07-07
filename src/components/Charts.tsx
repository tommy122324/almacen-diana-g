"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { PuntoDia } from "@/lib/calc";
import { formatCOP, formatNum } from "@/lib/format";

const COLORES = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6"];

export function VentasBarChart({ data }: { data: PuntoDia[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatNum(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
        <Tooltip formatter={(v) => formatCOP(Number(v))} labelFormatter={(l) => `Día ${l}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="utilidad" name="Utilidad" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IngresosMetodoChart({ data }: { data: { nombre: string; valor: number }[] }) {
  const conValor = data.filter((d) => d.valor > 0);
  if (conValor.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-stone-400">Sin ingresos registrados hoy.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={conValor} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatNum(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={92} />
        <Tooltip formatter={(v) => formatCOP(Number(v))} />
        <Bar dataKey="valor" name="Ingresos" radius={[0, 4, 4, 0]}>
          {conValor.map((_, i) => (
            <Cell key={i} fill={COLORES[i % COLORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComparativoChart({
  data,
}: {
  data: { periodo: string; ventas: number; gastos: number; utilidad: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="periodo" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatNum(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
        <Tooltip formatter={(v) => formatCOP(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="utilidad" name="Utilidad" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MetodosPieChart({ data }: { data: { nombre: string; valor: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-zinc-400">Sin ventas en el periodo.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" outerRadius={90}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORES[i % COLORES.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => formatCOP(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
