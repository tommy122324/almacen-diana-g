"use client";
import { clsx } from "clsx";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/format";

/** Estilo base compartido para inputs y selects. */
export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-2xl border border-stone-200 bg-white p-5 shadow-sm", className)}>
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
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: keyof typeof TONOS;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold tabular-nums", TONOS[tone])}>{formatCOP(value)}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
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
    primary: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700",
    outline: "border border-stone-300 bg-white text-stone-700 hover:border-amber-400 hover:bg-amber-50",
    ghost: "text-stone-500 hover:bg-stone-100",
    danger: "text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
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
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    stone: "bg-stone-100 text-stone-600",
  };
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}
