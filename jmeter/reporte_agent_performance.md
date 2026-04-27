# Reporte Agent (Plantilla) — Performance APIs (Web y Android)

Este documento sirve como plantilla “audit-able” para documentar pruebas de performance de APIs que simulan el flujo del usuario (Web y Mobile Android) en ambiente productivo. Está pensado para reutilizarse en futuras ejecuciones y para dejar trazabilidad clara de: qué se probó, cómo se ejecutó, qué se observó y qué faltó.

---

## 0) Convenciones

- **TZ**: `America/Mexico_City` (ajustar si aplica).
- **pXX**: percentiles de latencia (ms) por paso/servicio (p50/p90/p95/p99).
- **Error rate**: `%Error` de JMeter por sampler/paso.
- **Throughput**: Rendimiento de JMeter (req/s, req/min según listener/reporte).
- **Paso**: “Transaction Controller” o agrupación funcional del flujo.
- **Servicio**: request específico (HTTP sampler) dentro del paso.

---

## 1) Título

**Reporte de performance de APIs (Web y Android) — Prod — [YYYY-MM-DD HH:MM–HH:MM TZ]**

---

## 2) Resumen Ejecutivo

**Objetivo**
- Identificar degradación (latencia, errores, throughput) por paso/servicio bajo carga escalonada.

**Resultado clave (llenar al final)**
- [Ej. “A partir de 40 hilos se observa incremento de p95 en Step X y %Error en Servicio Y”.]
- [Ej. “El primer cuello de botella es …”.]

**Notas operativas**
- Las pruebas **no finalizaron compra** (checkout incompleto / purchase no ejecutado) por condiciones del ambiente/datos.
- Estas pruebas miden **APIs**; no equivalen a performance de UI/UX (render, FPS, interacción).

---

## 3) Alcance y No Alcance

**Alcance**
- Medición de performance de servicios/APIs invocados en un flujo simulado (Web y Android).
- Métricas por request y por paso: latencia (p50/p90/p95/p99), %Error, throughput, payload (bytes).

**No alcance**
- Métricas de UI (render, FPS, tiempo percibido real, ANR).
- Compra real / “Purchase” (si el plan no ejecuta la última fase).
- Comparación exacta “tiempo usuario” vs “tiempo API” (JMeter mide tiempos de request; la UI incluye más factores).

**Limitaciones conocidas**
- Variabilidad de Prod (caching/CDN, tráfico real, cambios en backend).
- El resultado con 1 usuario/hilo no es representativo de carga productiva.
- Datos dependientes: `CSV`, tokens, cookies, headers (si cambian, cambian los resultados).

---

## 4) Datos Operativos Principales (inputs)

> Nota: si un dato aún no existe, dejarlo explícito como **TBD**.

- **Usuarios promedio hora pico**: `A` (**TBD** si no se tiene)
- **% sesiones con addToCart**: `B%`
- **Productos agregados promedio por sesión (en sesiones con carrito)**: `C`
- **% que inicia checkout (sobre sesiones con carrito)**: `D%`
- **% que completa compra (sobre quienes iniciaron checkout)**: `E%`

**Fuente de estos números**
- [Ej. GA4 / VTEX / Data Team / Observabilidad]
- Fecha de referencia: [YYYY-MM-DD a YYYY-MM-DD]

---

## 5) Configuración de Pruebas (reproducibilidad)

### 5.1 Herramientas

- JMeter: [versión]
- Java: [versión]
- SO / Máquina: [hostname / specs]
- Ejecución: GUI / no-GUI (recomendado: no-GUI para carga)

### 5.2 Planes ejecutados (JMX)

**Web**
- Debug: `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Navegacion_PLP_PDP_Carrito_Checkout_v2.jmx`
- Perf: `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Navegacion_PLP_PDP_Carrito_Checkout_v2_perf.jmx`

**Mobile (Android)**
- Debug: `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Mobile_Navegacion_PLP_PDP_Carrito_Checkout_v1.jmx`
- Perf: `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Mobile_Navegacion_PLP_PDP_Carrito_Checkout_v1_perf.jmx`

### 5.3 Parámetros de ejecución

- `THREADS`: [n]
- `RAMP`: [segundos]
- `LOOPS`: [n]
- Think time: [ON/OFF], variables `TT_*` (ver sección 5.4)

**Comando ejemplo (no-GUI)**
```powershell
C:\Users\atcon\Desktop\Jmeter\bin\jmeter.bat -n `
  -t "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\[PLAN]_perf.jmx" `
  -l "C:\temp\[salida].jtl" `
  -JTHREADS=40 -JRAMP=60 -JLOOPS=1
```

### 5.4 Think time (simulación de usuario)

**Objetivo**
- Introducir pausas realistas entre fases (buscar, leer PDP, decidir, etc.) para no “sobre-acelerar” el flujo.

**Variables sugeridas (ejemplos)**
- `TT_BOOT_DELAY_MS`, `TT_BOOT_RANGE_MS`
- `TT_SEARCH_DELAY_MS`, `TT_SEARCH_RANGE_MS`
- `TT_PLP_DELAY_MS`, `TT_PLP_RANGE_MS`
- `TT_PDP_TAP_DELAY_MS`, `TT_PDP_TAP_RANGE_MS`
- `TT_PDP_VIEW_DELAY_MS`, `TT_PDP_VIEW_RANGE_MS`
- `TT_PLP_ADD_DELAY_MS`, `TT_PLP_ADD_RANGE_MS`
- `TT_CART_DELAY_MS`, `TT_CART_RANGE_MS`
- `TT_CHECKOUT_DELAY_MS`, `TT_CHECKOUT_RANGE_MS`

> Nota: los valores finales deben acordarse con el equipo (rangos realistas por dispositivo/UX).

---

## 6) Modelo de carga (cómo dimensionar)

### 6.1 Conversión de sesiones/hora pico a hilos

Cuando exista **sesiones/hora pico**, usar:

`THREADS ≈ sesiones_hora_pico * (duración_promedio_sesión_seg / 3600)`

Cómo obtener `duración_promedio_sesión_seg`:
- Ejecutar `LOOPS=1` con `THREADS=1` y think time ON.
- Tomar el tiempo total del **sampler padre** (Transaction Controller con `includeTimers=true`) como aproximación.
- Ideal: medir p50/p95 de duración total y elegir un valor conservador (ej. p95) para dimensionar.

### 6.2 Estrategia escalonada (cuando falta pico)

Ejemplo de escalera:
- 1 → 5 → 10 → 20 → 40 → 80 → 120 → 160 (detener si hay degradación fuerte)

En cada escalón:
- Mantener constantes: plan, datos, `LOOPS`, think time, entorno.
- Registrar: p95/p99 por paso, %Error, throughput.

---

## 7) Resultados — Web

### 7.1 Mapa del flujo (pasos)

Lista de pasos (llenar con los nombres reales del plan):
1. `01 - ...`
2. `02 - ...`
3. `03 - ...`
4. `04 - ...`
5. `05 - ...`
6. `06 - ...`
7. `07 - ...`
8. `08 - ...`

### 7.2 Ejecuciones escalonadas (tabla por ejecución)

> Repetir este bloque por cada escalón (THREADS).

**Ejecución Web #N**
- Fecha/hora: [YYYY-MM-DD HH:MM–HH:MM TZ]
- `THREADS`: [n], `RAMP`: [s], `LOOPS`: [n]
- Archivo JTL: `[ruta]`

**Tabla por paso (recomendado)**
- Columnas mínimas: Paso, #Muestras, p90, p95, p99, %Error, Throughput, Avg Bytes.
- Opcional: Media, Min, Max, StdDev, KB/sec, Sent KB/sec.

**Tabla por servicio (opcional si se requiere detalle)**
- Columnas: Servicio (URL/endpoint), Método, %Error, p95/p99, Throughput, Avg Bytes.

### 7.3 Hallazgos (top degradación)

- Top 5 por **p99**:
  - [Paso/Servicio] — p99=[ms] — Observación
- Top 5 por **%Error**:
  - [Paso/Servicio] — %Error=[x%] — Código(s) HTTP / mensaje
- Cambios notables vs escalón anterior:
  - [Ej. “Aumenta p95 en getPLP…”]

---

## 8) Resultados — Mobile (Android)

> Misma estructura que “Resultados — Web”, pero especificando que el flujo corresponde a los servicios del APK.

### 8.1 Mapa del flujo (pasos)

1. `01 - Bootstrap OrderForm (getCheckoutOrderForm)`
2. `02 - PLP Mobile ...`
3. `03 - PDP ...`
4. `04 - Add to cart ...`
5. `05 - Cart ...`
6. `06 - Checkout ...`

### 8.2 Ejecuciones escalonadas (tabla por ejecución)

**Ejecución Mobile #N**
- Fecha/hora: [YYYY-MM-DD HH:MM–HH:MM TZ]
- `THREADS`: [n], `RAMP`: [s], `LOOPS`: [n]
- Archivo JTL: `[ruta]`

**Tabla por paso**
- Columnas mínimas: Paso, #Muestras, p90, p95, p99, %Error, Throughput, Avg Bytes.

### 8.3 Hallazgos (top degradación)

- Top 5 por p99: …
- Top 5 por %Error: …
- Diferencias vs Web (si aplica): …

---

## 9) Comparativo Web vs Mobile (opcional, recomendado)

**Misma condición de carga (si aplica)**
- `THREADS`: [n], `RAMP`: [s], `LOOPS`: [n]

**Tabla comparativa por paso**
- Paso (Web) vs Paso (Mobile)
- p95/p99
- %Error
- Throughput

**Notas**
- No necesariamente deben “calcar” endpoints; Mobile puede usar “backend-app” agregador y Web puede ir directo a VTEX/GraphQL u otros.

---

## 10) Conclusiones

**Capacidad observada**
- Hasta `THREADS=[n]` se mantiene: p95 <= [ms], %Error <= [x%] (si aplica).

**Primer punto de degradación**
- Escalón: `THREADS=[n]`
- Paso/Servicio: [nombre]
- Síntoma: [p95/p99 sube, %Error sube, timeouts, 4xx/5xx]

**Riesgos**
- [Ej. “Endpoint crítico con p99 inestable bajo carga…”]

---

## 11) Recomendaciones y Próximos Pasos

1) Obtener **sesiones/hora pico** para dimensionar “carga productiva equivalente”.  
2) Ejecutar prueba “productiva” (THREADS calculados) y comparar con escalera.  
3) Definir umbrales (SLO/SLI) por paso: p95/p99 y %Error máximos.  
4) Si aplica, agregar observabilidad correlacionada (APM, logs, rate limits, errores de negocio).  
5) Para performance de UI: usar herramientas específicas (no es parte de JMeter).

---

## 12) Anexos

### 12.1 Evidencia
- Capturas (Summary Report) por escalón.
- Logs relevantes (errores, códigos, mensajes).
- Configuración de datos (CSV/JSON) usada en la prueba.

### 12.2 Variables (inventario)

- Listar `__P(...)` relevantes del plan y su valor en la corrida:
  - `THREADS`, `RAMP`, `LOOPS`
  - `DATA_DIR`, rutas CSV
  - `TT_*`
  - [otros]

