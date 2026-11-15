import { ImageResponse } from "next/og";
import { obtenerReciboPublico } from "./datos";
import { formatCOP, formatFechaCorta } from "@/lib/format";

export const alt = "Recibo de compra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Vista previa que muestra WhatsApp al enviar el link del recibo.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await obtenerReciboPublico(id);
  const negocio = d?.negocio ?? "Almacén";
  const numero = d ? String(d.recibo.numero).padStart(4, "0") : "----";
  const total = d ? formatCOP(d.recibo.total) : "";
  const cliente = d?.recibo.cliente.trim() ?? "";
  const fecha = d ? formatFechaCorta(d.recibo.fecha) : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fdf3e4", padding: 40 }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: 40,
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: "0 20px 50px rgba(154,52,18,0.18)",
          }}
        >
          {/* Panel naranja */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 470,
              padding: 50,
              background: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 4, opacity: 0.9 }}>RECIBO DE COMPRA</div>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 800, marginTop: 18, lineHeight: 1.1 }}>{negocio}</div>
            </div>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: "rgba(255,255,255,0.95)",
                color: "#c2410c",
                borderRadius: 999,
                padding: "14px 34px",
                fontSize: 44,
                fontWeight: 800,
              }}
            >
              N° {numero}
            </div>
          </div>
          {/* Datos */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "50px 60px" }}>
            {cliente ? <div style={{ display: "flex", fontSize: 30, color: "#a8a29e" }}>Cliente</div> : null}
            {cliente ? <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#292524", marginBottom: 26 }}>{cliente}</div> : null}
            <div style={{ display: "flex", fontSize: 30, color: "#a8a29e" }}>Total</div>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 800, color: "#c2410c", lineHeight: 1.1 }}>{total}</div>
            <div style={{ display: "flex", fontSize: 30, color: "#78716c", marginTop: 26 }}>{fecha ? `Fecha: ${fecha}` : ""}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#ea580c", marginTop: 30, fontWeight: 700 }}>Toca para ver tu recibo completo</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
