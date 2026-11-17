"use client";
// ─── Escenas de la abejita: bienvenida, despedida y celebraciones (con sonido) ───
// Solo CSS (transform/opacity) + un canvas de confeti que se apaga solo. Nada corre en segundo plano.
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useStore } from "@/lib/store";
import { hoyISO } from "@/lib/calc";
import { formatCOP } from "@/lib/format";
import { sonar, cebarAudio, sonidosActivos, setSonidosActivos, type Sonido } from "@/lib/sonidos";
import { Abeja } from "@/components/Abeja";

const primerNombre = (t: string) => t.trim().split(/\s+/)[0] ?? "";
const pocoMovimiento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------- Fondo de panal (decorativo, liviano) ---------------- */
function Panal() {
  const celdas = [
    { l: "8%", t: "14%", s: 46, d: "0s" },
    { l: "82%", t: "10%", s: 34, d: "1.2s" },
    { l: "88%", t: "62%", s: 52, d: "0.6s" },
    { l: "12%", t: "72%", s: 38, d: "1.8s" },
    { l: "50%", t: "86%", s: 30, d: "0.9s" },
    { l: "64%", t: "22%", s: 24, d: "2.2s" },
  ];
  return (
    <>
      {celdas.map((c, i) => (
        <span key={i} className="escena-hex" style={{ left: c.l, top: c.t, width: c.s, height: c.s * 1.1, animationDelay: c.d }} />
      ))}
    </>
  );
}

/* ---------------- Bienvenida ---------------- */
export function IntroAbeja() {
  const cargado = useStore((s) => s.cargado);
  const miNombre = useStore((s) => s.miNombre);
  const negocios = useStore((s) => s.negocios);
  const negocioId = useStore((s) => s.negocioActivoId);
  const [fase, setFase] = useState<-1 | 0 | 1 | 2>(-1); // -1 oculto, 0 vuela, 1 llegó, 2 se va
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!cargado) return;
    try {
      if (sessionStorage.getItem("cb-intro") === "1") return;
      sessionStorage.setItem("cb-intro", "1");
    } catch {}
    if (pocoMovimiento()) return;
    setFase(0);
    sonar("entrada");
    const t = timers.current;
    t.push(window.setTimeout(() => setFase(1), 1700));
    t.push(window.setTimeout(() => sonar("guino"), 2050));
    t.push(window.setTimeout(() => setFase(2), 3300));
    t.push(window.setTimeout(() => setFase(-1), 3950));
    return () => t.forEach(clearTimeout);
  }, [cargado]);

  if (fase === -1) return null;
  const nombre = primerNombre(miNombre);
  const negocio = negocios.find((n) => n.id === negocioId)?.nombre ?? "";
  const saltar = () => {
    timers.current.forEach(clearTimeout);
    setFase(2);
    timers.current = [window.setTimeout(() => setFase(-1), 650)];
  };

  return (
    <div className={`escena-fondo ${fase === 2 ? "escena-salir" : ""}`} onClick={saltar}>
      <Panal />
      <div className={`intro-vuelo ${fase === 2 ? "intro-irse" : ""}`}>
        <div className="abeja-flotar">
          <Abeja size={150} guino={fase >= 1} />
        </div>
        {fase >= 1 && (
          <>
            <span className="escena-chispa" style={{ left: "-10%", top: "10%" }}>✨</span>
            <span className="escena-chispa" style={{ left: "95%", top: "0%", animationDelay: "0.15s" }}>✨</span>
            <span className="escena-chispa" style={{ left: "85%", top: "80%", animationDelay: "0.3s" }}>🍯</span>
          </>
        )}
      </div>
      {fase >= 1 && (
        <div className="escena-texto">
          <h1 className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            ¡Hola{nombre ? `, ${nombre}` : ""}!
          </h1>
          {negocio && <p className="mt-2 text-lg font-bold text-stone-700">{negocio}</p>}
          <p className="mt-1 text-sm text-stone-500">Que tengas un día de muchas ventas 🍯</p>
        </div>
      )}
      <span className="escena-saltar">Toca para continuar</span>
    </div>
  );
}

/* ---------------- Despedida ---------------- */
export function DespedidaAbeja() {
  const miNombre = useStore((s) => s.miNombre);
  const [guino, setGuino] = useState(false);
  const [vuela, setVuela] = useState(false);
  useEffect(() => {
    sonar("salida");
    const a = window.setTimeout(() => {
      setGuino(true);
      sonar("guino");
    }, 650);
    const b = window.setTimeout(() => setVuela(true), 1350);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const nombre = primerNombre(miNombre);
  return (
    <div className="escena-fondo despedida-fondo">
      <Panal />
      <div className={`despedida-abeja ${vuela ? "despedida-vuela" : ""}`}>
        <div className="despedida-saludo">
          <Abeja size={150} guino={guino} />
        </div>
      </div>
      <div className="escena-texto">
        <h1 className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          ¡Hasta pronto{nombre ? `, ${nombre}` : ""}! 👋
        </h1>
        <p className="mt-2 text-sm text-stone-500">Gracias por tu trabajo de hoy 💛</p>
      </div>
    </div>
  );
}

/** Duración de la despedida (para esperar antes de cerrar sesión). */
export const DURACION_DESPEDIDA = 2300;

/* ---------------- Celebraciones ---------------- */
export type TipoCelebracion = "meta" | "media-meta" | "record" | "ventas" | "pagado" | "entregado";
interface Celebracion {
  tipo: TipoCelebracion;
  titulo: string;
  mensaje: string;
  emoji: string;
}

/** Lanza una celebración desde cualquier parte de la app. */
export function celebrar(c: Celebracion) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Celebracion>("cb-celebrar", { detail: c }));
}

const GRANDE: TipoCelebracion[] = ["meta", "record", "ventas"];
const SONIDO: Record<TipoCelebracion, Sonido> = {
  meta: "meta",
  "media-meta": "logro",
  record: "meta",
  ventas: "logro",
  pagado: "moneda",
  entregado: "moneda",
};

function confeti(canvas: HTMLCanvasElement, cantidad: number, duracion: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  const colores = ["#f59e0b", "#f97316", "#fbbf24", "#fb7185", "#34d399", "#fde68a", "#a78bfa"];
  const ps = Array.from({ length: cantidad }, (_, i) => {
    const desdeIzq = i % 2 === 0;
    return {
      x: desdeIzq ? -10 : W + 10,
      y: H * (0.55 + Math.random() * 0.3),
      vx: (desdeIzq ? 1 : -1) * (4 + Math.random() * 7),
      vy: -(9 + Math.random() * 9),
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      c: colores[i % colores.length],
    };
  });
  const t0 = performance.now();
  let raf = 0;
  const paso = (t: number) => {
    const p = (t - t0) / duracion;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = p > 0.75 ? Math.max(0, (1 - p) * 4) : 1;
    for (const q of ps) {
      q.vy += 0.32;
      q.vx *= 0.99;
      q.x += q.vx;
      q.y += q.vy;
      q.r += q.vr;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.r);
      ctx.fillStyle = q.c;
      ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.r * 2)));
      ctx.restore();
    }
    if (p < 1) raf = requestAnimationFrame(paso);
    else ctx.clearRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(paso);
  return () => cancelAnimationFrame(raf);
}

export function Celebraciones() {
  const [actual, setActual] = useState<Celebracion | null>(null);
  const cola = useRef<Celebracion[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Desbloquea el audio con el primer toque
  useEffect(() => {
    const f = () => cebarAudio();
    window.addEventListener("pointerdown", f, { once: true });
    window.addEventListener("keydown", f, { once: true });
    return () => {
      window.removeEventListener("pointerdown", f);
      window.removeEventListener("keydown", f);
    };
  }, []);

  useEffect(() => {
    const f = (e: Event) => {
      const c = (e as CustomEvent<Celebracion>).detail;
      if (!c) return;
      cola.current.push(c);
      setActual((a) => a ?? cola.current.shift() ?? null);
    };
    window.addEventListener("cb-celebrar", f);
    return () => window.removeEventListener("cb-celebrar", f);
  }, []);

  useEffect(() => {
    if (!actual) return;
    const grande = GRANDE.includes(actual.tipo);
    sonar(SONIDO[actual.tipo]);
    const dur = grande ? 4200 : 2600;
    let parar = () => {};
    if (canvas.current && !pocoMovimiento()) parar = confeti(canvas.current, grande ? 160 : 60, grande ? 3200 : 2000);
    const t = window.setTimeout(() => setActual(cola.current.shift() ?? null), dur);
    return () => {
      clearTimeout(t);
      parar();
    };
  }, [actual]);

  if (!actual) return null;
  const grande = GRANDE.includes(actual.tipo);
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className={`celebra-caja ${grande ? "celebra-grande" : ""}`} key={actual.titulo + actual.mensaje}>
        <div
          className="pointer-events-auto relative flex items-center gap-3 rounded-3xl border border-amber-200 bg-white/95 px-4 py-3 shadow-[0_20px_50px_-15px_rgba(154,52,18,0.45)] backdrop-blur"
          onClick={() => setActual(cola.current.shift() ?? null)}
        >
          <div className="celebra-abeja shrink-0">
            <div className="abeja-flotar">
              <Abeja size={grande ? 78 : 58} guino />
            </div>
          </div>
          <div className="min-w-0">
            <div className={`font-extrabold text-stone-800 ${grande ? "text-lg sm:text-xl" : "text-base"}`}>
              {actual.emoji} {actual.titulo}
            </div>
            <div className="text-sm text-stone-500">{actual.mensaje}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Vigilante de logros (metas, ventas del día, récords) ---------------- */
const HITOS_VENTAS = [10, 20, 30, 50, 75, 100, 150];

function leer(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function guardar(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

export function VigilanteLogros() {
  const cargado = useStore((s) => s.cargado);
  const negocioId = useStore((s) => s.negocioActivoId);
  const ventas = useStore((s) => s.ventas);
  const metas = useStore((s) => s.metas);
  const iniciado = useRef("");

  useEffect(() => {
    if (!cargado || !negocioId) return;
    const hoy = hoyISO();
    const mes = hoy.slice(0, 7);
    const sesion = `${negocioId}-${hoy}`;
    const primera = iniciado.current !== sesion; // primera revisión: no celebrar lo que ya pasó (salvo la meta)
    iniciado.current = sesion;

    const delNegocio = ventas.filter((v) => v.negocioId === negocioId);
    const deHoy = delNegocio.filter((v) => v.fecha === hoy);
    const totalHoy = deHoy.reduce((s, v) => s + v.monto, 0);
    const pend: Celebracion[] = [];

    // 1) Muchas ventas hoy
    const kV = `cb-logro-${negocioId}-${hoy}-ventas`;
    const hito = [...HITOS_VENTAS].reverse().find((h) => deHoy.length >= h) ?? 0;
    if (hito > Number(leer(kV) ?? 0)) {
      guardar(kV, String(hito));
      if (!primera) pend.push({ tipo: "ventas", emoji: "🔥", titulo: `¡${hito} ventas hoy!`, mensaje: "¡Qué día tan bueno! Sigan así 🐝" });
    }

    // 2) Meta del mes (y la mitad)
    const [a, m] = mes.split("-").map(Number);
    const meta = metas.find((x) => x.negocioId === negocioId && x.anio === a && x.mes === m);
    if (meta && meta.montoMeta > 0) {
      const totalMes = delNegocio.filter((v) => v.fecha.startsWith(mes)).reduce((s, v) => s + v.monto, 0);
      const kM = `cb-logro-${negocioId}-${mes}-meta`;
      const kH = `cb-logro-${negocioId}-${mes}-media`;
      if (totalMes >= meta.montoMeta && !leer(kM)) {
        guardar(kM, "1");
        guardar(kH, "1");
        pend.push({ tipo: "meta", emoji: "🏆", titulo: "¡Cumplimos la meta del mes!", mensaje: `Llegamos a ${formatCOP(meta.montoMeta)}. ¡Felicitaciones a todo el equipo!` });
      } else if (totalMes >= meta.montoMeta / 2 && !leer(kH)) {
        guardar(kH, "1");
        if (!primera) pend.push({ tipo: "media-meta", emoji: "🎯", titulo: "¡Vamos por la mitad de la meta!", mensaje: "Ya llevamos el 50% del mes. ¡A seguir!" });
      }
    }

    // 3) Récord de ventas en un día (con suficiente historial cargado)
    const porDia = new Map<string, number>();
    for (const v of delNegocio) if (v.fecha < hoy) porDia.set(v.fecha, (porDia.get(v.fecha) ?? 0) + v.monto);
    const kR = `cb-logro-${negocioId}-${hoy}-record`;
    if (porDia.size >= 20 && totalHoy > Math.max(...porDia.values()) && !leer(kR)) {
      guardar(kR, "1");
      pend.push({ tipo: "record", emoji: "🚀", titulo: "¡Nuevo récord de ventas!", mensaje: `Hoy van ${formatCOP(totalHoy)}: el mejor día registrado.` });
    }

    if (document.visibilityState === "visible") pend.forEach(celebrar);
  }, [cargado, negocioId, ventas, metas]);

  return null;
}

/* ---------------- Botón de sonido ---------------- */
export function BotonSonido({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const f = () => setOn(sonidosActivos());
    f();
    window.addEventListener("cb-sonidos", f);
    return () => window.removeEventListener("cb-sonidos", f);
  }, []);
  return (
    <button
      onClick={() => {
        setSonidosActivos(!on);
        if (!on) sonar("guino");
      }}
      className={className}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Sonidos: {on ? "activados" : "apagados"}
    </button>
  );
}
