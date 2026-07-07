# Contabee 🐝 — Documento de Requisitos y Arquitectura

> **Nombre del producto:** Contabee (de "conta" + *bee*, la abeja trabajadora)
> **Estado:** Borrador v1 para revisión
> **Fecha:** 2026-07-06
> **Objetivo:** Sistema web (que funciona como web y como app instalable) para el registro
> diario de ventas y gastos de un negocio, con cierres mensuales, diseñado como **SaaS
> multiusuario, escalable y seguro**, listo para integrarse con otros sistemas más adelante.

---

## 1. Visión general

Aplicación **SaaS** (Software as a Service) de **registro diario de ventas, gastos e
ingresos**, con reportes y cierre de mes. Cada negocio tiene su cuenta aislada y varios
usuarios con roles. Se accede desde un **link (HTTPS)** tanto en computador como en celular,
y se puede **instalar como app** (PWA) sin pasar por tiendas de aplicaciones.

### Principios de diseño
1. **Escalable**: preparado para muchos negocios/usuarios sin rehacer nada.
2. **Multi-tenant**: los datos de cada negocio están aislados (a nivel de base de datos).
3. **API primero**: toda la lógica pasa por una API limpia → facilita la integración futura.
4. **Seguro por defecto**: HTTPS, autenticación, Row Level Security, validación en servidor.
5. **Los totales se calculan, no se guardan**: nunca quedan datos inconsistentes.

---

## 2. Alcance (según decisiones tomadas)

| Decisión | Elección |
|----------|----------|
| Alcance | **Multiusuario / SaaS desde el inicio** |
| Negocios por cuenta | **Varios** (un usuario puede manejar más de un negocio) |
| Dashboard con gráficas | **Sí, desde la primera versión** |
| Seguimiento de fiados/crédito | **Sí** (cliente, monto, pagado/pendiente) |
| Metas de ventas mensuales | **Sí** (versión más completa) |
| Cuadre de caja diario | **Sí** (versión más completa) |
| Moneda | **Pesos colombianos (COP), sin decimales** |
| Primer entregable | **Este documento de requisitos** |

---

## 3. Requisitos funcionales

### 3.1 Autenticación y cuentas
- **RF-01** Registro de usuario con correo y contraseña.
- **RF-02** Inicio y cierre de sesión seguro (JWT vía Supabase Auth).
- **RF-03** Recuperación de contraseña por correo.
- **RF-04** Cada usuario pertenece a uno o varios **negocios**.
- **RF-05** Roles por negocio: **dueño**, **administrador**, **empleado**.
  - *Dueño/Admin*: todo (registrar, editar, ver reportes, gestionar usuarios).
  - *Empleado*: solo registrar ventas/gastos del día; no ve reportes ni borra.

### 3.2 Registro diario
- **RF-10** Crear/abrir el registro de un **día** (por fecha) para el negocio activo.
- **RF-11** Registrar **ventas por método de pago**:
  - Efectivo
  - Crédito (fiado)
  - Tarjeta
  - Nequi
  - DaviPlata
- **RF-12** El sistema **suma automáticamente el total de ventas del día**.
- **RF-13** Registrar **gastos** como lista de conceptos, cada uno con descripción y monto
  (ej: "Aromáticas 3000", "Jabón 2000", "Mercado 50000").
- **RF-14** El sistema **suma automáticamente el total de gastos del día**.
- **RF-15** Registrar **entradas / otros ingresos** (ej: abono de un apartado), con concepto y monto.
- **RF-16** Calcular la **utilidad del día** = (ventas + entradas) − gastos.
- **RF-17** Editar y eliminar registros (según rol), con registro de auditoría.

### 3.3 Fiados / crédito
- **RF-20** Registrar un fiado: **cliente**, **monto**, fecha, estado **pendiente/pagado**.
- **RF-21** Marcar un fiado como **pagado** (con fecha de pago).
- **RF-22** Ver lista de fiados **pendientes** y **total por cobrar**.

### 3.4 Metas de ventas
- **RF-25** Definir una **meta de ventas** para el mes (por negocio).
- **RF-26** Mostrar **barra de progreso** de la meta en el dashboard (ventas del mes vs meta).

### 3.5 Cuadre de caja diario
- **RF-27** Al cerrar el día, calcular el **efectivo esperado** (ventas en efectivo + entradas en efectivo − gastos pagados en efectivo).
- **RF-28** Registrar el **efectivo real contado** y mostrar la **diferencia** (sobrante/faltante).

### 3.6 Reportes y cierre de mes
- **RF-30** Total de **ventas del mes**.
- **RF-31** Total del mes por **cada método**: efectivo, crédito, tarjeta, Nequi, DaviPlata.
- **RF-32** Total de **gastos del mes** y total de **entradas del mes**.
- **RF-33** **Utilidad del mes**.
- **RF-34** **Dashboard con gráficas** (desde la v1):
  - Ventas por día del mes (barras/línea).
  - Distribución por método de pago (torta/dona).
  - Comparativo mes actual vs mes anterior.
- **RF-35** **Exportar** el reporte mensual a **Excel y PDF**.

### 3.5 Auditoría
- **RF-40** Cada creación/edición/eliminación guarda **quién** y **cuándo**.

---

## 4. Requisitos no funcionales

- **RNF-01 Seguridad**: HTTPS obligatorio (Vercel), autenticación JWT, **Row Level Security**
  en PostgreSQL, validación de datos en servidor, secretos en variables de entorno.
- **RNF-02 Multi-tenant**: aislamiento estricto de datos por negocio.
- **RNF-03 Rendimiento**: respuestas < 1s en operaciones normales.
- **RNF-04 Disponibilidad**: hosting gratuito con backups automáticos (Supabase).
- **RNF-05 Usabilidad**: interfaz simple, en español, usable desde el celular con una mano.
- **RNF-06 App + Web**: PWA instalable en Android/iOS/escritorio, mismo código.
- **RNF-07 Escalabilidad**: arquitectura API-first para integraciones futuras.
- **RNF-08 Portabilidad**: entorno de desarrollo con Docker (igual a producción).
- **RNF-09 Moneda/idioma**: pesos colombianos (COP), formato local, zona horaria Colombia.

---

## 5. Arquitectura técnica

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend (web + app) | **Next.js** (React) + **PWA** | UI única para web y app instalable |
| Estilos / componentes | **Tailwind CSS** + **shadcn/ui** | UI rápida y profesional |
| Gráficas | **Recharts** | Dashboard visual |
| Backend / API | **Next.js** (Route Handlers / Server Actions) | Lógica de negocio y API |
| Base de datos | **Supabase (PostgreSQL)** | Datos + backups |
| Autenticación | **Supabase Auth** (JWT) | Login, roles, seguridad |
| Aislamiento de datos | **Row Level Security (RLS)** | Cada negocio solo ve lo suyo |
| Hosting | **Vercel** | Deploy con link + HTTPS automático |
| Contenedores | **Docker / docker-compose** | Desarrollo local reproducible |
| IA (opcional, fase futura) | **Hugging Face** | Predicción de ventas / anomalías |
| Reportes | ExcelJS (Excel) + generación PDF | Exportación mensual |

**Nota sobre Hugging Face:** se reserva para una fase posterior (predicción de ventas del
próximo mes, detección de gastos/días atípicos, o asistente "¿cómo van mis ventas?"). No es
parte del MVP para no complicar la primera entrega.

---

## 6. Modelo de datos (borrador)

```
auth.users                 (gestionado por Supabase Auth)

negocios
  id, nombre, dueño_id, creado_en

miembros
  id, negocio_id, usuario_id, rol (dueño|admin|empleado)

dias
  id, negocio_id, fecha            (único por negocio+fecha)

ventas
  id, dia_id, metodo (efectivo|credito|tarjeta|nequi|daviplata),
  monto, creado_por, creado_en

gastos
  id, dia_id, concepto (texto), monto, creado_por, creado_en

entradas
  id, dia_id, concepto (texto), monto, creado_por, creado_en

fiados
  id, negocio_id, dia_id, cliente, monto,
  estado (pendiente|pagado), fecha_pago, creado_por, creado_en

metas
  id, negocio_id, año, mes, monto_meta

cuadre_caja
  id, dia_id, efectivo_esperado, efectivo_real, diferencia, creado_por, creado_en

auditoria
  id, negocio_id, usuario_id, accion, tabla, registro_id, detalle, fecha
```

**Regla clave:** los totales (día y mes) **no se almacenan**; se calculan con consultas.
Así los reportes siempre son consistentes.

---

## 7. Plan por fases

### Fase 0 — Preparación
- Estructura del proyecto Next.js, Docker, conexión a Supabase, variables de entorno.
- Definir esquema de base de datos y políticas RLS.

### Fase 1 — MVP funcional (local)
- Registro, login y roles.
- Selección de negocio activo (multi-tenant).
- Registro diario: ventas por método, gastos, entradas; totales y utilidad del día.
- Fiados: registrar y marcar pagado.

### Fase 2 — Reportes y dashboard
- Cierre de mes: totales por método, gastos, entradas, utilidad.
- Dashboard con gráficas (ventas por día, métodos, comparativo mensual).
- Exportar a Excel y PDF.

### Fase 3 — SaaS en la nube
- PWA instalable.
- Deploy a Vercel (link + HTTPS), Supabase en producción.
- Auditoría y refinamiento de seguridad (RLS revisada, roles).

### Fase 4 — Extras (opcional)
- Modo offline con sincronización.
- IA con Hugging Face (predicción / anomalías).
- **API pública documentada** para la integración futura.

---

## 8. Riesgos y consideraciones
- **Límites del plan gratuito** (Supabase / Vercel): suficientes para arrancar; monitorear al crecer.
- **Seguridad RLS**: hay que probarla bien; un error deja datos expuestos entre negocios.
- **Backups**: confiar en los de Supabase + exportaciones periódicas.
- **Zona horaria**: fijar Colombia para que los "días" cierren correctamente.

---

## 9. Decisiones confirmadas
1. Montos en **pesos colombianos (COP)**, sin decimales. ✅
2. Un usuario puede manejar **varios negocios**. ✅
3. **Metas de ventas mensuales** con barra de progreso. ✅ (incluido)
4. **Cuadre de caja** diario (efectivo esperado vs real). ✅ (incluido)
5. Nombre y marca: **Contabee** 🐝 ✅
```
