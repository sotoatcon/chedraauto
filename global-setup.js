const { chromium } = require('@playwright/test');
const HeaderPage = require('./pages/HeaderPage');
const DirectionsPage = require('./pages/DirectionsPage');
const { loginConCorreo } = require('./utils/LoginActions');
const config = require('./utils/Environment');

module.exports = async function globalSetup() {

  console.log("🔥 GLOBAL SETUP INICIADO 🔥");
  console.log(`🌎 Ambiente detectado: ${config.ambiente}`);
  console.log("🔐 Ejecutando login para generar sesión...");

  // 👉 CONTEXTO PERSISTENTE — siempre
  const context = await chromium.launchPersistentContext('', { headless: false });

  // 👉 Playwright abre una about:blank — elimínala sin crear otra
  let pages = context.pages();
  if (pages.length === 1 && pages[0].url() === 'about:blank') {
    console.log("🗑️ Cerrando about:blank inicial...");
    await pages[0].close();
  }

  // 👉 Usa whatever pestaña exista después (EMP creará la suya con goto)
  let page = context.pages()[0] || await context.newPage();

  console.log(`📝 Página activa: ${page.url()}`);

  try {
    //--------------------------------------------------------
    // 0) GOTO SOLO PARA EMP
    //--------------------------------------------------------
    if (config.isEMP) {
      console.log(`🌐 EMP detectado → navegando a ${config.urls.EMPATHY}`);
      await page.goto(config.urls.EMPATHY, { waitUntil: "domcontentloaded" });
    }

    //--------------------------------------------------------
    // 1) LOGIN
    //--------------------------------------------------------
    const headerPage = new HeaderPage(page);
    console.log("➡️ Iniciando login...");
    await loginConCorreo(page, headerPage, headerPage);
    console.log("✅ Login realizado correctamente.");

    //--------------------------------------------------------
    // 2) Manejo de Dirección
    //--------------------------------------------------------
    const directionsPage = new DirectionsPage(page);

    console.log("➡️ Abriendo menú de direcciones...");

    // Si existe el iframe
    const iframe = page.locator('iframe#launcher');
    if (await iframe.count() > 0) {
      console.log("🟧 iframe#launcher detectado → esperando...");
      await iframe.waitFor({ state: 'visible', timeout: 20000 });
    } else {
      console.log("🟦 No existe iframe → continuar.");
    }

    console.log("🍪 Aceptando cookies…");
    await directionsPage.safeClick(directionsPage.aceptarCookiesButton);
    await page.waitForTimeout(10000);

    await directionsPage.safeClick(directionsPage.seleccionarDireccionButton);

    //--------------------------------------------------------
    // 3) EMP (flujos internos)
    //--------------------------------------------------------
    if (config.isEMP) {
      console.log("🌐 EMP → flujo especial…");
      await page.waitForTimeout(10000);
      console.log("📍 Seleccionando dirección Santa Fe");
      await directionsPage.SeleccionarDireccionEspecifica("Sante Fe");
    }

    //--------------------------------------------------------
    // 4) QA/PROD normales
    //--------------------------------------------------------
    else {
      console.log("🌐 Ambiente QA/PROD");

      await page.waitForTimeout(4000);

      const editarButtons = page.locator(directionsPage.editardireccionButton);
      const count = await editarButtons.count();

      if (count === 0) {
        console.log("⚠️ No hay direcciones → agregando sucursales…");

        for (const [nombre, direccion] of Object.entries(config.sucursales)) {
          console.log(`➕ Agregando: ${nombre} — ${direccion}`);
          await directionsPage.agregarDireccion(nombre, direccion);
          await page.waitForTimeout(300);
        }

      } else {
        console.log(`📦 Ya existen ${count} direcciones.`);
      }
    }

    //--------------------------------------------------------
    // 5) Guardar sesión (solo QA/PROD)
    //--------------------------------------------------------
    if (!config.isEMP) {
      console.log("💾 Guardando storageState.json…");
      await context.storageState({ path: 'storageState.json' });
      console.log("✅ Sesión guardada correctamente.");
    }

  } catch (err) {
    console.error("❌ ERROR DURANTE GLOBAL SETUP");
    console.error(err);
    throw err;

  } finally {
    console.log("🛑 Finalizando Global Setup...");

    if (!config.isEMP) {
      console.log("🟢 QA/PROD → Cerrando navegador.");
      await context.close();
    } else {
      console.log("🟣 EMP → Manteniendo navegador ABIERTO para los tests.");
      // NO se cierra nada en EMP
    }
  }

  console.log("🎉 GLOBAL SETUP COMPLETO");
};