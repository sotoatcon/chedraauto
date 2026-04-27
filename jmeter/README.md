# JMeter - Pruebas de Carga (Plantilla)

Este folder contiene una estructura base para pruebas de carga con JMeter a partir de tráfico real (HAR) del e-commerce.

## Modos: debug vs perf (listeners)

Para depurar el flujo es útil `Ver Arbol de Resultados`, pero en carga alta consume memoria/CPU porque guarda cada sample en RAM.

Se recomienda:
- **debug**: listeners detallados activos
- **perf**: desactivar `Ver Arbol de Resultados` y quedarse con `Reporte resumen` + `JTL`

Script (genera una copia del plan con sufijo):

```powershell
powershell -ExecutionPolicy Bypass -File jmeter/scripts/prepare-plan.ps1 -InputJmx jmeter/plans/Chedraui_Mobile_Navegacion_PLP_PDP_Carrito_Checkout_v1.jmx -Mode perf
```

Esto genera `..._perf.jmx` en la misma carpeta y desactiva el listener pesado.

## Cómo cambiar el ambiente (URL)

El plan usa variables para el host/protocolo. Puedes correr JMeter pasando propiedades:

```bash
jmeter -n -t jmeter/plans/Chedraui_Browse_Search_Cart.jmx -l results.jtl -JPROTOCOL=https -JHOST=www.chedraui.com.mx
```

### Ejemplo: Mobile (Android) backend-app

```bash
jmeter -n -t jmeter/plans/Chedraui_Mobile_Navegacion_PLP_PDP_Carrito_Checkout_v1_perf.jmx -l mobile_results.jtl -JBACKEND_LOGIN=... -JTHREADS=10 -JRAMP=30 -JLOOPS=1
```

Variables principales (pueden sobreescribirse con `-J...`):
- `PROTOCOL` (default: `https`)
- `HOST` (default: `www.chedraui.com.mx`)
- `WORKSPACE` (default: `master`)
- `LOCALE` (default: `es-MX`)
- `SC` (default: `1`)
- `SEARCH_TERM` (default: `tomate`)
- `SEARCH_PATH` (default: `${SEARCH_TERM}`)

Notas:
- El flujo de pago (PSP) no se incluye en esta plantilla.
- Login (Auth0/VTEXID) se recomienda tratarlo como prueba aparte; para carga masiva normalmente se usan sesiones/cookies preexistentes.
