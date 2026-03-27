# JMeter - Pruebas de Carga (Plantilla)

Este folder contiene una estructura base para pruebas de carga con JMeter a partir de tráfico real (HAR) del e-commerce.

## Cómo cambiar el ambiente (URL)

El plan usa variables para el host/protocolo. Puedes correr JMeter pasando propiedades:

```bash
jmeter -n -t jmeter/plans/Chedraui_Browse_Search_Cart.jmx -l results.jtl -JPROTOCOL=https -JHOST=www.chedraui.com.mx
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

