// tests/TimeSlotScraper.spec.js
const { test, chromium } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const config = require('../../utils/Environment');
const fs = require('fs');
const path = require('path');
const NavegacionActions = require('../../utils/NavegacionActions');
const PdfPrinter = require('pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
const { sendEmail } = require('../../utils/mailslurp-utils');
const { generarReportePDF } = require('../../utils/creadorpdf');

test('C1 - TimeSlot Scraper', async () => { 
  test.setTimeout(300000);

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--start-maximized']
  });
  const page = await context.newPage();
  const headerPage = new HeaderPage(page);
  const resumencarritos = new ResumenCarritoPage(page);
  const productos = new ProductosEncontradosPage(page);
  const carritoUtils = new NavegacionActions();
/*
  // --- Sesión persistente ---
  if (fs.existsSync('./sessionCookies.json')) { 
    const cookies = JSON.parse(fs.readFileSync('./sessionCookies.json'));
    await context.addCookies(cookies);
  }

  if (fs.existsSync('./sessionLocalStorage.json')) {
    const localStorageData = JSON.parse(fs.readFileSync('./sessionLocalStorage.json'));
    await page.goto(config.urls.PROD);
    await page.evaluate((data) => {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value);
      }
    }, localStorageData);
  }
*/

  // --- Sesión persistente ---
  if (fs.existsSync('./sessionCookies.json')) { 
    const cookies = JSON.parse(fs.readFileSync('./sessionCookies.json'));
    await context.addCookies(cookies);
  }

  if (fs.existsSync('./sessionLocalStorage.json')) {
    const localStorageData = JSON.parse(fs.readFileSync('./sessionLocalStorage.json'));

    // Primero navegar UNA sola vez
    await page.goto(config.urls.PROD, { waitUntil: 'domcontentloaded' });

    // Inyectar localStorage ANTES de cualquier otra navegación
    await page.evaluate((data) => {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value);
      }
    }, localStorageData);

    // Recargar SOLO después de setear localStorage
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  // --- Flujo principal ---
  await page.goto(config.urls.PROD);
  await headerPage.safeClick(headerPage.aceptarCookiesButton);
  await page.goto(config.urls.PROD);
  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });

  await headerPage.safeClick(headerPage.minicartButton);  
  await page.waitForTimeout(2000);

  const vaciarButton = await page.locator(resumencarritos.vaciarcarritoButton);
  if (await vaciarButton.count() > 0) {
    console.log('Vaciando el carrito...');
    await resumencarritos.safeClick(resumencarritos.vaciarcarritoButton);
    await resumencarritos.safeClick(resumencarritos.eliminarItemsCarritoButton);
    await headerPage.safeClick(headerPage.cerrarminicartButton);
  } else {
    await headerPage.safeClick(headerPage.cerrarminicartButton);
    console.log('🛒 El carrito ya está vacío.');
  }

  await page.goto(config.urls.PROD);

    const listaProductos = [
      'Aguacate Hass por Kg',  // 1
      'Plátano Chiapas por Kg', // 2
      'Cebolla Blanca por kg',  // 3
      'Zanahoria por kg',       // 4
      'Ajo por Kg'              // 5
    ];

    let productosAgregados = 0;

    for (const producto of listaProductos) {
    console.warn(`Se ingresó al for, producto actual: `+producto);

    if (productosAgregados >= 4) break;
      console.warn(`Se ingresó al if productosAgregados`);
      
      try {
          console.warn(`Se intenta agregar producto: ${producto}`);
          const exito = await carritoUtils.buscarYAgregarProducto(page, headerPage, productos, producto);
          if (exito) {
            productosAgregados++;
            console.log(`✅ Producto agregado: ${producto} (total agregados: ${productosAgregados})`);
          }
        } catch (err) {
          console.warn(`⚠️ No se pudo agregar producto: ${producto} → ${err.message}`);
        }
  }

  console.log(`🛒 Total de productos agregados al carrito: ${productosAgregados}`);
  await page.goto(config.urls.PROD);

  await headerPage.safeClick(headerPage.minicartButton);
  await page.waitForTimeout(2000);
  await resumencarritos.safeClick(resumencarritos.comprarcarritoButton);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  await carritoUtils.avanzarCarrito(page, resumencarritos);
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForTimeout(10000);
  await resumencarritos.safeClick(resumencarritos.cambiarDireccionLink);
  await page.waitForTimeout(5000);
  const sucursales = await page.locator(resumencarritos.sucursales);
  const total = await sucursales.count();
  console.warn('total sucursales ' + total);
  
  // --- Arreglos de control ---
  const sucursalesEvaluadas = [];
  const sucursalesSinDias = [];

  // --- Recorremos todas las sucursales ---
  for (let i = 0; i < total; i++) {
    const sucursal = sucursales.nth(0); // Siempre la primera
    //const sucursal = sucursales.nth(i); // Siempre la primera
    await sucursal.scrollIntoViewIfNeeded();
    const nombreSucursal = (await sucursal.innerText()).trim();
    console.log(`🏪 Revisando sucursal ${i + 1}: ${nombreSucursal}`);
    await sucursal.click();
    await resumencarritos.safeClick(resumencarritos.confirmarCambiarDireccionButton);
    await page.waitForTimeout(1500);
    let diasConfigurados = [];

    try {
      await page.waitForTimeout(4500);
      const dias = page.locator(resumencarritos.diasentrega);
      const totalDias = await dias.count();
      console.log(`CONSOLE\n🗓️ total dias: ${totalDias}`);

      if (totalDias > 0) {
        for (let j = 0; j < totalDias; j++) {
          const diaTexto = await dias.nth(j).innerText();
          console.log(`\n🗓️ Día ${j + 1}: ${diaTexto.trim()}`);

          // ===> Capturamos TODOS los elementos de horarios en un array real:
          const horariosElementos = await page.$$(resumencarritos.horarioentregaButton);
          console.log(`⏱️ total de horarios encontrados para ${diaTexto.trim()}: ${horariosElementos.length}`);

          let listaHorarios = [];
          for (let k = 0; k < horariosElementos.length; k++) {
            const textoHorario = (await horariosElementos[k].innerText()).trim();

            // Separa el horario del precio si viene junto (por el símbolo $)
            const horarioLimpio = textoHorario.split('$')[0].trim();

            listaHorarios.push(horarioLimpio);
          }

          diasConfigurados.push({
            nombreDia: diaTexto.trim(),
            horarios: listaHorarios.join(', ') + '.'
          });

          console.log(`⏰ Horarios para "${diaTexto.trim()}": ${listaHorarios.join(', ')}.`);
        }
      } else {
        console.warn(`❌ Sucursal sin días configurados: ${nombreSucursal}`);
        sucursalesSinDias.push(nombreSucursal);
      }
    } catch (err) {
      console.warn(`⚠️ Error al obtener los días y horarios para ${nombreSucursal}:`, err);
      sucursalesSinDias.push(nombreSucursal);
    }

    sucursalesEvaluadas.push({
      nombre: nombreSucursal,
      dias: diasConfigurados
    });

    await resumencarritos.safeClick(resumencarritos.cambiarDireccionLink);    
    await page.waitForTimeout(200);
  }

// --- Reporte Final ---
const fechaHora = new Date().toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City',
  hour12: false
});

// Cálculos de totales
const totalSucursales = sucursalesEvaluadas.length;
const totalConfiguradas = sucursalesEvaluadas.filter(s => s.dias.length > 0).length;
const totalNoConfiguradas = totalSucursales - totalConfiguradas;

// Impresión general en consola
console.log('\n📌 Resumen final:');
console.log(`🕒 Fecha de ejecución: ${fechaHora}`);
console.log(`🏬 Total de sucursales evaluadas: ${totalSucursales}`);
console.log(`✅ Total configuradas con días: ${totalConfiguradas}`);
console.log(`🚫 Total sin días configurados: ${totalNoConfiguradas}\n`);

// --- Construcción base del reporte (texto y XML) ---
let reporteTexto = `📌 Resumen final\nFecha ejecución: ${fechaHora}\n`;
reporteTexto += `🏬 Total de sucursales evaluadas: ${totalSucursales}\n`;
reporteTexto += `✅ Total configuradas con días: ${totalConfiguradas}\n`;
reporteTexto += `🚫 Total sin días configurados: ${totalNoConfiguradas}\n\n`;

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
xml += `<testsuite name="Evaluación de Sucursales" tests="${totalSucursales}">\n`;

// --- Desglose de sucursales sin días configurados ---
reporteTexto += `📅 Sucursales con días configurados:\n`;
console.log(`📅 Sucursales con días configurados:\n`);
for (const s of sucursalesEvaluadas.filter(s => s.dias.length > 0)) {
  console.log(`🏪 ${s.nombre}`);
  reporteTexto += `🏪 ${s.nombre}\n`;

  if (s.dias.length > 0) {
    for (const d of s.dias) {
      // d es ahora { nombreDia, horarios }
      const nombreDia = d.nombreDia || String(d);
      const horarios = d.horarios || '';

      console.log(`   - Día: ${nombreDia}`);
      console.log(`     Horarios: ${horarios}`);
      reporteTexto += ` - Día: ${nombreDia}\n`;
      reporteTexto += `   Horarios: ${horarios}\n`;
    }
  } else {
    console.log(`   🚫 Sin días configurados`);
    reporteTexto += `   🚫 Sin días configurados\n`;
  }

  reporteTexto += `\n`;
  console.log('');
}


// --- XML para cada sucursal ---
for (const s of sucursalesEvaluadas) {
    xml += `  <testcase classname="Sucursales" name="${s.nombre}"/>\n`;
  
  /*if (s.dias.length > 0) {
    xml += `  <testcase classname="Sucursales" name="${s.nombre}"/>\n`;
  } else {
    xml += `  <testcase classname="Sucursales" name="${s.nombre}">\n`;
    xml += `    <failure message="Sucursal sin días configurados">No se encontraron días configurados</failure>\n`;
    xml += `  </testcase>\n`;
  }*/
}
xml += `</testsuite>\n`;

// --- Guardado de reportes ---
const reportDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

const reportPathTxt = path.join(reportDir, 'reporteSucursales.txt');
fs.writeFileSync(reportPathTxt, reporteTexto, 'utf8');
console.log(`\n📄 Reporte TXT generado en: ${reportPathTxt}`);

const reportPathXml = path.join(reportDir, 'reporteSucursales.xml');
fs.writeFileSync(reportPathXml, xml, 'utf8');
console.log(`📊 Reporte XML JUnit generado en: ${reportPathXml}`);

// --- Funciones auxiliares ---
function normalizarTexto(texto) {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la sucursal (clave/nombre canónico) a partir de un texto de dirección.
 * Compara contra las direcciones definidas en config.sucursales (objeto clave:direccion).
 * Devuelve la clave encontrada o "Desconocida".
 */
function obtenerSucursalPorDireccion(texto) {

  const textoNormalizado = normalizarTexto(texto);
  const sucursalesConfig = config.sucursales || {};

  // Verifica si hay sucursales cargadas
  const entries = Object.entries(sucursalesConfig);

  // Si no hay sucursales, termina temprano
  if (entries.length === 0) {
    console.warn("⚠️ No hay sucursales configuradas en config.");
    return "Desconocida";
  }

  // Recorre todas las sucursales del config
  for (const [nombreSucursal, direccionConfigurada] of entries) {
    const dirConfigNorm = normalizarTexto(direccionConfigurada);
    const partes = dirConfigNorm.split(",");
    const aliasCorto =
      partes.length >= 2 ? `${partes[0]}, ${partes[1].trim()}` : dirConfigNorm;
    const primerFragmento = partes[0].trim();

    // Comparación de texto normalizado
    if (
      textoNormalizado.includes(primerFragmento) ||
      textoNormalizado.includes(aliasCorto)
    ) {
      console.warn("✅ Match encontrado →", nombreSucursal);
      return nombreSucursal;
    }
  }

  console.warn("❌ No hubo coincidencias. Se devolverá 'Desconocida'");
  return "Desconocida";
}

await generarReportePDF({
  sucursalesEvaluadas,
  sucursalesSinDias,
  fechaHora,
  totalSucursales,
  totalConfiguradas,
  totalNoConfiguradas
});

/*
await sendEmail(
  config.correos,
  '📄 Reporte PDF',
  'Adjunto el reporte más reciente.',
  '../reports/reporteSucursales.pdf'
);
*/

});