"use client";
import { useRef, useEffect, useState } from "react";
import { Eraser } from "lucide-react";

/** Panel para firmar con el dedo o el mouse. Entrega la firma como imagen (data URL). */
export function FirmaPad({ onChange, className }: { onChange: (dataUrl: string) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1c1917";
    }
  }, []);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    dibujando.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function end() {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacio(false);
    onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function limpiar() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setVacio(true);
    onChange("");
  }

  return (
    <div className={className}>
      <div className="relative rounded-xl border border-stone-300 bg-white">
        <canvas
          ref={canvasRef}
          className="h-36 w-full touch-none rounded-xl"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {vacio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-300">
            Firma aquí ✍️
          </span>
        )}
      </div>
      <button type="button" onClick={limpiar} className="mt-1 flex items-center gap-1 text-xs text-stone-400 hover:text-rose-500">
        <Eraser className="h-3.5 w-3.5" /> Borrar firma
      </button>
    </div>
  );
}
