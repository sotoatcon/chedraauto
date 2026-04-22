# Contexto de Agente - JMeter (Performance)

Este documento sirve como referencia rápida para trabajar el módulo de performance con JMeter dentro de este repositorio.

## Objetivo del proyecto (JMeter)

Madurar la suite de performance del e-commerce mapeando y simulando flujos end-to-end, por ejemplo:

- Búsquedas (Search).
- PLP (Product Listing Page) / navegación por listados.
- PDP (Product Detail Page).
- Agregar al carrito y validar carrito (cuando aplique).

La meta es contar con una secuencia reproducible para pruebas de performance, con datos parametrizables, y con posibilidad de variar ambiente/host sin tocar el `.jmx`.

## Rutas importantes (Windows)

- Planes JMeter dentro del repo:
  - `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter`
  - Plan(es): `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans`
  - Plan base anterior (respaldo): `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Browse_Search_Cart.jmx`
- Plan actualizado (HAR 2026-04-06): `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Navegacion_PLP_PDP_Carrito_Checkout.jmx`
- Plan simulacion usuarios v2 (2026-04-07): `C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Navegacion_PLP_PDP_Carrito_Checkout_v2.jmx`
- Binario JMeter (bat) instalado localmente:
  - `C:\Users\atcon\Desktop\Jmeter\bin\jmeter.bat`

## Estructura actual (carpetas)

- `jmeter\README.md`: Guía corta y variables principales.
- `jmeter\plans\*.jmx`: Test Plans (plantillas/flows).
- `jmeter\data\*.csv`: Inputs de simulacion (categorias/SKUs).
- `jmeter.log` (raíz del repo): Log local generado por ejecuciones (si se está usando esa ruta).

## Cómo ejecutar (PowerShell)

Ejemplo base para correr en modo no-GUI:

`& "C:\Users\atcon\Desktop\Jmeter\bin\jmeter.bat" -n -t "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Browse_Search_Cart.jmx" -l "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\reports\jmeter\results.jtl" -JPROTOCOL=https -JHOST=www.chedraui.com.mx`

Generar reporte HTML (opcional, recomendado para compartir resultados):

`& "C:\Users\atcon\Desktop\Jmeter\bin\jmeter.bat" -n -t "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\jmeter\plans\Chedraui_Browse_Search_Cart.jmx" -l "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\reports\jmeter\results.jtl" -e -o "C:\Users\atcon\Desktop\Playwright\playwright-piloto2\reports\jmeter\html" -JPROTOCOL=https -JHOST=www.chedraui.com.mx`

Notas:

- Usar comillas dobles en rutas con espacios.
- Mantener los outputs en una ruta consistente (por ejemplo `reports\jmeter\...`) para no mezclar con los reportes de Playwright.

## Variables/Parámetros (convención)

El plan principal utiliza propiedades `-J...` para permitir variar el ambiente sin editar el `.jmx`.

Variables comunes esperadas (ver `jmeter\README.md` y el `.jmx`):

- `PROTOCOL` (default: `https`)
- `HOST` (default: `www.chedraui.com.mx`)
- `WORKSPACE` (default: `master`)
- `LOCALE` (default: `es-MX`)
- `SC` (default: `1`)
- `SEARCH_TERM` (default: `tomate`)
- `SEARCH_PATH` (default: `${SEARCH_TERM}`)

## Lineamientos para “madurar” los flujos (PDP/PLP/Search)

Para mantener los planes escalables y confiables:

- Parametrizar inputs (término de búsqueda, paths, IDs/SKUs) con `-J...` o `CSV Data Set Config`.
- Mantener una secuencia clara por flujo (por ejemplo: Home -> Search -> PLP -> PDP -> Add-to-cart -> Cart).
- Usar `HTTP Cookie Manager` / `HTTP Cache Manager` según el tipo de simulación deseada.
- Agregar timers (think time) controlables por propiedad para evitar tráfico irreal.
- Revisar correlaciones (tokens, ids dinámicos) antes de escalar concurrencia.
- Evitar incluir PSP/pago en esta plantilla (si se requiere, separar en plan dedicado).

## Próximos módulos (futuro)

La idea es replicar este enfoque/documentación cuando se agreguen suites equivalentes para Android e iOS (por ejemplo: rutas, binarios, convención de ejecución y objetivos).
