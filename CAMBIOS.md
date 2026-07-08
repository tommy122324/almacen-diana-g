# Almacén Diana G 🐝 — Plan de cambios (post-producción)

> Cambios pedidos por el cliente, organizados por fases (de lo rápido a lo grande).

## Fase 4 — Correcciones y ajustes rápidos
- **[BUG] Apartados vs Pedidos** (#6): al borrar un pedido se borró un apartado. Investigar y corregir (integridad de datos). **Prioridad alta.**
- **Quitar "Tarjeta de crédito"** (#4): dejar solo "Tarjeta". Ajustar métodos en la app y en la base (enum).
- **Voz** (#1): misma voz en celular y computador; arreglar la demora al reproducir en celular.
- **Velocidad** (#5): optimizar carga y respuesta sin cambiar la lógica.

## Fase 5 — Cuadre de caja v2 + Panel
- **Nueva fórmula de efectivo neto** (#2):
  - El usuario ingresa el efectivo que quedó HOY en la caja (efectivo contado real).
  - Fórmula: `efectivo neto = utilidad en efectivo + caja de ayer − caja de hoy`.
    - Ejemplo: hoy 74, ayer 31, utilidad efectivo 53 → 53 + 31 − 74 = **10**.
  - En el **panel principal**: mostrar **Utilidad total** y **Utilidad efectivo neto total**, con
    entre paréntesis lo acumulado que debería haber en efectivo (igual que en los reportes).
  - En el panel: elegir **fechas específicas** para ver todo por el rango que el usuario cuadre.
    Las demás operaciones siguen igual.
- **Botón "¿Cuadró?"** (#3):
  - Al ingresar el valor → mostrar "Calculando…".
  - Donde dice "efectivo neto" mostrar **Cuadró / No cuadró**.
  - Si el usuario dice **Sí** → marcar el día en **verde**.
  - Si dice **No** → pedir la diferencia (positiva o negativa) y marcar el día en **rojo**.
  - Quitar el campo "Diferencia" actual (se habilita solo cuando se responde "No").

## Fase 6 — Pedidos mejorados + WhatsApp
- **Mensaje al entregar** (#7): al marcar un pedido como "entregado", enviar por WhatsApp:
  "Hola, te escribimos de Almacén Diana. Encargaste [producto]; te confirmamos que ya llegó
  a la tienda. ¡Te esperamos con emoción!" — el producto sale de la descripción del pedido.
- **Mejor interfaz** para gestionar pedidos (ya son varias acciones).

## Fase 7 — Usuarios, roles, códigos y control de horario (la más grande)
- **Panel de administración de usuarios** (#8): el admin crea/edita/elimina usuarios y les asigna
  permisos.
- **Generación de códigos** (#8): un módulo donde el admin pone el número que envía y los números
  que reciben; al enviar, se genera un código nuevo válido **30 minutos**.
- **Usuario "Colaborador"** (#8.1) (nombre bonito para el trabajador):
  - Entra por el login normal; luego el sistema le pide el **código** para desbloquear las funciones
    (el mismo código del módulo anterior).
  - Permisos limitados: **solo agregar** (no editar ni eliminar), y **solo ve el día en que entra**.
  - Solo ve: Panel y Registro (ventas, gastos, entradas) y registro de apartados/pedidos.
    No ve reportes ni generación de códigos.
  - **Registro de hora de entrada**: el sistema valida contra la hora oficial de Bogotá (no la del
    dispositivo). Si registra después de las **9:15**, muestra alerta: "Tu tiempo de retraso será
    descontado de tu sueldo de la próxima quincena. Descuento: [cálculo]" — usando el salario mínimo
    de Colombia por minuto.
- **Control del admin**: recibe la hora registrada cada día, puede ver quién llegó tarde y generar
  un **PDF por usuario** con el resumen del mes.
- **Multi-dispositivo en tiempo real**: varios usuarios a la vez; el admin ve lo que agregó cada
  colaborador en el día (todo entrelazado; solo cambian los permisos).

---

## Decisiones tomadas ✅
1. **WhatsApp del pedido** (#7): enlace `wa.me` (gratis, un toque para enviar).
2. **Códigos** (#8): se envían **por correo** (gratis y automático).
3. **Fórmula del efectivo neto** (#2), confirmada — una sola fórmula cubre los dos casos:
   `efectivo neto = utilidad en efectivo + caja de ayer − caja de hoy`
   - Si caja hoy > caja ayer → equivale a `utilidad − (hoy − ayer)`.
   - Si caja hoy < caja ayer → equivale a `utilidad + (ayer − hoy)`.

## Orden de ejecución propuesto
1. 🐛 Bug apartados/pedidos (#6) — **urgente (datos)**.
2. Quitar "Tarjeta de crédito", dejar "Tarjeta" (#4).
3. Voz: misma en cel/compu + arreglar demora en celular (#1).
4. Velocidad general (#5).
5. Cuadre de caja v2: nueva fórmula del efectivo neto (#2).
6. Botón ¿Cuadró? verde/rojo + panel con fechas y utilidades (#3).
7. Pedidos: mensaje WhatsApp al entregar (wa.me) + mejor interfaz (#7).
8. Fase grande (#8, #8.1): usuarios/roles, códigos por correo, colaborador,
   registro de hora + descuentos, PDF por usuario, multi-dispositivo.
   (Esta se subdivide en pasos cuando lleguemos.)
