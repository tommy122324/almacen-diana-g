"use client";
import { clsx } from "clsx";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/format";

/** Estilo base compartido para inputs y selects. */
export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition hover:border-amber-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100/70";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-2xl border border-amber-100/80 bg-white p-5 shadow-[0_1px_2px_rgba(120,53,15,0.04),0_8px_24px_-12px_rgba(120,53,15,0.12)]", className)}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={clsx(inputCls, "cursor-pointer appearance-none pr-9 font-medium", className)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
    </div>
  );
}

const TONOS = {
  default: "text-stone-800",
  green: "text-emerald-600",
  red: "text-rose-600",
  amber: "text-amber-600",
  sky: "text-sky-600",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  esConteo = false,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: keyof typeof TONOS;
  esConteo?: boolean; // muestra un número simple (no pesos)
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-amber-100/50" />
      <div className="relative text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={clsx("relative mt-1 text-2xl font-bold tabular-nums", TONOS[tone])}>{esConteo ? value : formatCOP(value)}</div>
      {hint && <div className="relative mt-0.5 text-xs text-stone-400">{hint}</div>}
    </Card>
  );
}

export function Boton({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25 hover:from-amber-600 hover:to-orange-600",
    outline: "border border-amber-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50",
    ghost: "text-stone-500 hover:bg-amber-50 hover:text-amber-800",
    danger: "text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "green" | "red" | "stone" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    stone: "bg-stone-50 text-stone-600 ring-1 ring-inset ring-stone-200",
  };
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}
