"use client";
import { formatNum, parseMonto } from "@/lib/format";

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
}

/** Campo para montos en COP: muestra "12.345" y entrega el número 12345. */
export function MoneyInput({ value, onChange, placeholder, className, onEnter, autoFocus }: Props) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-stone-400">$</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value ? formatNum(value) : ""}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(parseMonto(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-7 pr-3 text-right font-medium tabular-nums text-stone-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      />
    </div>
  );
}
