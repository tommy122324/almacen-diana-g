"use client";
import Swal from "sweetalert2";

// Toast pequeño arriba a la derecha para confirmar acciones.
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: true,
  didOpen: (t) => {
    t.addEventListener("mouseenter", Swal.stopTimer);
    t.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

/** Aviso de éxito (ej: "Cambios guardados"). */
export function avisar(titulo = "Cambios guardados") {
  Toast.fire({ icon: "success", title: titulo });
}

/** Aviso de error. */
export function avisarError(titulo = "Ocurrió un problema") {
  Toast.fire({ icon: "error", title: titulo });
}

/** Recordatorio en modal: NO se cierra solo, el usuario debe cerrarlo. */
export function recordatorio(titulo: string, html?: string) {
  return Swal.fire({
    icon: "info",
    title: titulo,
    html,
    confirmButtonText: "Entendido",
    confirmButtonColor: "#f59e0b",
  });
}

/** Diálogo de confirmación genérico. Devuelve true si el usuario acepta. */
export async function confirmar(
  titulo: string,
  texto = "",
  confirmText = "Sí",
): Promise<boolean> {
  const r = await Swal.fire({
    title: titulo,
    text: texto,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#f59e0b",
    cancelButtonColor: "#a8a29e",
    reverseButtons: true,
  });
  return r.isConfirmed;
}

/** Diálogo de confirmación para eliminar. Devuelve true si el usuario acepta. */
export async function confirmarEliminar(
  texto = "Esta acción no se puede deshacer.",
): Promise<boolean> {
  const r = await Swal.fire({
    title: "¿Eliminar?",
    text: texto,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#e11d48",
    cancelButtonColor: "#a8a29e",
    reverseButtons: true,
  });
  return r.isConfirmed;
}
