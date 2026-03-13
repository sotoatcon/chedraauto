// global-setup.js
const { chromium } = require('@playwright/test');
const HeaderPage = require('./pages/HeaderPage');
const DirectionsPage = require('./pages/DirectionsPage');
const { loginConCorreo } = require('./utils/LoginActions');
const config = require('./utils/Environment');

module.exports = async function globalSetup() {

  console.log("🔥 GLOBAL SETUP INICIADO 🔥");
  console.log(`🌎 Ambiente detectado: ${config.ambiente}`);

  // ============================================================
  // 🟣 1) EMP — NO ejecutar globalSetup
  // ============================================================
  /*
  if (config.isEMP) {
    console.log("🟪 EMP detectado → Saltando globalSetup COMPLETO.");
    console.log("    ❌ No login");
    console.log("    ❌ No navegador");
    console.log("    ❌ No storageState");
    return;
  }
  */
  // ============================================================
  // 🟢 2) QA / PROD — Ejecutar como antes
  // ============================================================
  console.log("🟢 QA/PROD → Ejecutando login para generar sesión…");

  const context = await chromium.launchPersistentContext('', { headless: false });

  // Playwright abre una about:blank
  let pages = context.pages();
  if (pages.length === 1 && pages[0].url() === 'about:blank') {
    console.log("🗑️ Cerrando about:blank inicial...");
    await pages[0].close();
  }

  let page = context.pages()[0] || await context.newPage();

  console.log(`📄 Página activa tras limpieza: ${page.url()}`);

  try {
    // -----------------------------------------------------------
    // 1) LOGIN
    // -----------------------------------------------------------
    console.log("🔐 Ejecutando loginConCorreo…");

    const headerPage = new HeaderPage(page);
    await loginConCorreo(page, headerPage, headerPage);

    console.log("✅ Login realizado correctamente.");

    // -----------------------------------------------------------
    // 2) CONFIGURAR DIRECCIÓN
    // -----------------------------------------------------------
    const directionsPage = new DirectionsPage(page);

    console.log("📍 Configurando dirección…");

    // iframe opcional
    const iframe = page.locator('iframe#launcher');
    if (await iframe.count() > 0) {
      console.log("🟧 iframe detectado → esperando visible…");
      await iframe.waitFor({ state: 'visible', timeout: 20000 });
    }

    console.log("🍪 Aceptando cookies…");
    await directionsPage.safeClick(directionsPage.aceptarCookiesButton);
    await page.waitForTimeout(8000);

    console.log("➡️ Seleccionar dirección…");
    await directionsPage.safeClick(directionsPage.seleccionarDireccionButton);

    // QA/PROD
    console.log("🌐 QA/PROD → Normalizando direcciones…");

    await page.waitForTimeout(4000);

    const editarButtons = page.locator(directionsPage.editardireccionButton);
    const count = await editarButtons.count();

    if (count === 0) {
      console.log("No existen direcciones, agregando...");
      await page.waitForTimeout(10000);
      const sucursalesEntries = Object.entries(config.sucursales);
      const entradasAAgregar = config.isEMP ? sucursalesEntries.slice(0, 1) : sucursalesEntries;

      if (config.isEMP) {
        console.log("EMP detectado, agregando solo la primera sucursal");
      }

      for (const [nombre, direccion] of entradasAAgregar) {
        console.log(`Agregando sucursal: ${nombre} - ${direccion}`);
        await directionsPage.agregarDireccion(nombre, direccion);
        await page.waitForTimeout(300);
      }
    } else {
      console.log(`Ya existen ${count} direcciones, OK`);
    }

    // -----------------------------------------------------------
    // 3) GUARDAR SESIÓN
    // -----------------------------------------------------------
    console.log("💾 Guardando storageState.json…");
    await context.storageState({ path: './storageState.json' });
    console.log("✅ storageState.json guardado");

  } catch (err) {
    console.error("❌ ERROR EN GLOBAL SETUP");
    console.error(err);
    throw err;

  } finally {
    console.log("🛑 Finalizando Global Setup…");

    // EMP ya habría hecho skip arriba
    console.log("🟢 QA/PROD → Cerrando navegador");
    await context.close();
  }

  console.log("🎉 GLOBAL SETUP COMPLETO");
};
