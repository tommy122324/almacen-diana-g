"use client";
import { METODO_LABEL, POLITICA_RECIBO_DEFECTO, type Recibo } from "./types";
import { formatCOP, formatFechaLarga } from "./format";
import { telefonoWhatsApp } from "./whatsapp";

export const numeroRecibo = (n: number) => String(n).padStart(4, "0");

interface OpcionesImagen {
  negocio: string;
  politica?: string;
  whatsappAlmacen?: string;
}

/** Dibuja el recibo como imagen PNG (bonita, lista para WhatsApp). */
export async function generarImagenRecibo(r: Recibo, op: OpcionesImagen): Promise<Blob> {
  try {
    await document.fonts?.ready;
  } catch {}
  const fam = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const W = 1080;
  const PAD = 70; // margen exterior
  const X0 = PAD; // borde izquierdo del papel
  const X1 = W - PAD; // borde derecho del papel
  const IN = 64; // margen interior del papel
  const CW = X1 - X0 - IN * 2; // ancho útil

  const hora = (() => {
    try {
      return new Date(r.creadoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
    } catch {
      return "";
    }
  })();
  const politica = (op.politica ?? "").trim() || POLITICA_RECIBO_DEFECTO;
  const filas: [string, string][] = [];
  if (r.cliente.trim()) filas.push(["Cliente", r.cliente.trim()]);
  if (r.telefono.trim()) filas.push(["WhatsApp", r.telefono.trim()]);
  filas.push(["Método de pago", METODO_LABEL[r.metodo] ?? r.metodo]);
  if (r.atendio.trim()) filas.push(["Te atendió", r.atendio.trim()]);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const f = (peso: number, px: number) => `${peso} ${px}px ${fam}`;

  function lineas(texto: string, font: string, ancho: number): string[] {
    ctx.font = font;
    const out: string[] = [];
    for (const parrafo of texto.split(/\n+/)) {
      let linea = "";
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        const prueba = linea ? `${linea} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > ancho && linea) {
          out.push(linea);
          linea = palabra;
        } else linea = prueba;
      }
      if (linea) out.push(linea);
    }
    return out.length ? out : [""];
  }

  // Dibuja todo; con dibujar=false solo calcula la altura.
  function pintar(dibujar: boolean): number {
    let y = PAD;
    const HEADER = 300;
    if (dibujar) {
      // Fondo cálido
      const bg = ctx.createLinearGradient(0, 0, W, canvas.height);
      bg.addColorStop(0, "#fff4e2");
      bg.addColorStop(1, "#fde6cc");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, canvas.height);
      // Papel con sombra
      ctx.save();
      ctx.shadowColor = "rgba(154, 52, 18, 0.18)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = "#ffffff";
      redondeado(X0, PAD, X1 - X0, canvas.height - PAD * 2, 44);
      ctx.fill();
      ctx.restore();
      // Encabezado con degradado
      ctx.save();
      redondeado(X0, PAD, X1 - X0, canvas.height - PAD * 2, 44);
      ctx.clip();
      const hg = ctx.createLinearGradient(X0, PAD, X1, PAD + HEADER);
      hg.addColorStop(0, "#fbbf24");
      hg.addColorStop(1, "#f97316");
      ctx.fillStyle = hg;
      ctx.fillRect(X0, PAD, X1 - X0, HEADER);
      // Círculos decorativos
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(X1 - 40, PAD + 30, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(X0 + 60, PAD + HEADER + 10, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Logo
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(W / 2, PAD + 92, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = f(400, 58);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐝", W / 2, PAD + 96);
      // Nombre del negocio
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "alphabetic";
      ctx.font = f(800, 50);
      ctx.fillText(ajustar(op.negocio, f(800, 50), CW), W / 2, PAD + 205);
      ctx.font = f(600, 28);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("RECIBO DE COMPRA", W / 2, PAD + 250);
    }
    y = PAD + HEADER + 60;

    // Número y fecha
    if (dibujar) {
      const txt = `N° ${numeroRecibo(r.numero)}`;
      ctx.font = f(800, 40);
      const tw = ctx.measureText(txt).width + 64;
      ctx.fillStyle = "#fff7ed";
      redondeado(W / 2 - tw / 2, y - 44, tw, 64, 32);
      ctx.fill();
      ctx.strokeStyle = "#fed7aa";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#c2410c";
      ctx.textAlign = "center";
      ctx.fillText(txt, W / 2, y + 2);
      ctx.font = f(500, 28);
      ctx.fillStyle = "#78716c";
      ctx.fillText(`${formatFechaLarga(r.fecha)}${hora ? ` · ${hora}` : ""}`, W / 2, y + 62);
    }
    y += 110;

    // Separador tipo ticket
    if (dibujar) separador(y);
    y += 60;

    // Filas de datos
    for (const [k, v] of filas) {
      if (dibujar) {
        ctx.textAlign = "left";
        ctx.font = f(500, 30);
        ctx.fillStyle = "#a8a29e";
        ctx.fillText(k, X0 + IN, y);
        ctx.textAlign = "right";
        ctx.font = f(700, 32);
        ctx.fillStyle = "#292524";
        ctx.fillText(ajustar(v, f(700, 32), CW * 0.62), X1 - IN, y);
      }
      y += 58;
    }

    // Detalle de la compra
    if (r.detalle.trim()) {
      y += 10;
      const ls = lineas(r.detalle.trim(), f(500, 30), CW - 48);
      const alto = 70 + ls.length * 42;
      if (dibujar) {
        ctx.fillStyle = "#fafaf9";
        redondeado(X0 + IN, y - 34, CW, alto, 24);
        ctx.fill();
        ctx.textAlign = "left";
        ctx.font = f(700, 24);
        ctx.fillStyle = "#a8a29e";
        ctx.fillText("🛍️  DETALLE DE LA COMPRA", X0 + IN + 24, y + 6);
        ctx.font = f(500, 30);
        ctx.fillStyle = "#44403c";
        ls.forEach((l, i) => ctx.fillText(l, X0 + IN + 24, y + 52 + i * 42));
      }
      y += alto + 10;
    }

    // Total
    y += 20;
    if (dibujar) {
      const tg = ctx.createLinearGradient(X0 + IN, y, X1 - IN, y + 130);
      tg.addColorStop(0, "#fff7ed");
      tg.addColorStop(1, "#ffedd5");
      ctx.fillStyle = tg;
      redondeado(X0 + IN, y, CW, 130, 28);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = f(700, 30);
      ctx.fillStyle = "#9a3412";
      ctx.fillText("TOTAL", X0 + IN + 36, y + 76);
      ctx.textAlign = "right";
      ctx.font = f(800, 60);
      ctx.fillStyle = "#c2410c";
      ctx.fillText(formatCOP(r.total), X1 - IN - 36, y + 86);
    }
    y += 130 + 60;

    // Separador
    if (dibujar) separador(y);
    y += 60;

    // Política de cambios
    const lp = lineas(politica, f(500, 26), CW);
    if (dibujar) {
      ctx.textAlign = "left";
      ctx.font = f(700, 26);
      ctx.fillStyle = "#57534e";
      ctx.fillText("🔄  Cambios y garantías", X0 + IN, y);
      ctx.font = f(500, 26);
      ctx.fillStyle = "#78716c";
      lp.forEach((l, i) => ctx.fillText(l, X0 + IN, y + 44 + i * 36));
    }
    y += 44 + lp.length * 36 + 40;

    // Pie
    const wa = op.whatsappAlmacen?.trim() ? telefonoWhatsApp(op.whatsappAlmacen) : "";
    if (dibujar) {
      ctx.textAlign = "center";
      ctx.font = f(800, 36);
      ctx.fillStyle = "#ea580c";
      ctx.fillText("¡Gracias por tu compra! 💛", W / 2, y + 10);
      ctx.font = f(500, 24);
      ctx.fillStyle = "#a8a29e";
      ctx.fillText("Conserva este recibo para cualquier cambio o reclamo.", W / 2, y + 56);
      if (wa) ctx.fillText(`WhatsApp del almacén: +${wa}`, W / 2, y + 92);
    }
    y += wa ? 130 : 95;
    return y + PAD;
  }

  function redondeado(x: number, y: number, w: number, h: number, rad: number) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function separador(y: number) {
    // Muescas laterales (efecto ticket) + línea punteada
    const bg = ctx.getImageData(10, y, 1, 1).data;
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.beginPath();
    ctx.arc(X0, y, 24, 0, Math.PI * 2);
    ctx.arc(X1, y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X0 + 40, y);
    ctx.lineTo(X1 - 40, y);
    ctx.stroke();
    ctx.restore();
  }

  function ajustar(texto: string, font: string, ancho: number): string {
    ctx.font = font;
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1);
    return `${t}…`;
  }

  canvas.width = W;
  canvas.height = 2000;
  const alto = pintar(false);
  canvas.width = W;
  canvas.height = Math.ceil(alto);
  pintar(true);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/png"),
  );
}

export function nombreArchivoRecibo(r: Recibo) {
  return `Recibo_${numeroRecibo(r.numero)}.png`;
}

/** Mensaje corto que acompaña la imagen en WhatsApp. */
export function mensajeRecibo(r: Recibo, negocio: string) {
  const nombre = r.cliente.trim().split(/\s+/)[0];
  return `Hola${nombre ? ` ${nombre}` : ""} 👋, te compartimos el recibo de tu compra N° ${numeroRecibo(r.numero)} en ${negocio}. ¡Gracias por preferirnos! 🐝`;
}

/** ¿El dispositivo puede compartir archivos (celular)? */
export function puedeCompartirArchivo(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Copia la imagen al portapapeles (PC). */
export async function copiarImagen(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
