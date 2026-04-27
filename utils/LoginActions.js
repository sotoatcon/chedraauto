const LoginPageVtex = require('../pages/LoginPageVtex');
const config = require('./Environment');
const { getFixedInbox, waitForCode, deleteEmail } = require('./mailslurp-utils');
const { expect } = require('@playwright/test');
const fs = require('fs');

//const { getExcelData } = require('../../utils/excelReader');
async function loginConCorreo(page, headerPage, loginPage) {
  const inbox = await getFixedInbox();
  const emailAddress = inbox.emailAddress;
  const inboxId = inbox.id;
  console.log("🔎 process.env.TEST_ENV =", process.env.TEST_ENV);


  console.log("➡️ Entramos a loginConCorreo()");
  await deleteEmail(inboxId);
  console.log("➡️ inbox obtenido:", inbox);
  console.log("🧩 DEBUG isQA =", config.isQA);
  console.log("🧩 DEBUG isPROD =", config.isPROD);
  console.log("🧩 DEBUG isEMP =", config.isEMP);
  console.log("🧩 DEBUG ambiente =", config.ambiente);
  const loginvtex = new LoginPageVtex(page);


  // Visitar sitio principal

    if (config.isQA) {
      console.log("Estamos en QA");
      await page.goto(config.urls.QA, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
      await loginvtex.humanType(loginvtex.emailInput, config.emails.validUser);
      const otpRequestMs = Date.now();
      await loginvtex.safeClick(loginvtex.nextButton);
      await obtenerCodigoVtexDesdeOutlook(page, config, { notBeforeMs: otpRequestMs });

    }
    else if (config.isEMP) {
      console.log("Estamos en EMP");
      await page.goto(config.urls.EMPATHY, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await loginvtex.humanType(loginvtex.emailInput, config.emails.validUser);
      const otpRequestMs = Date.now();
      await loginvtex.safeClick(loginvtex.nextButton);
      const code = await obtenerCodigoVtexDesdeOutlook(page, config, { notBeforeMs: otpRequestMs });

      if (!/^\d{6}$/.test(code)) {
        throw new Error(`Código OTP inválido recibido: ${code}`);
      } else {
        console.log("El código recibido es: " + code);
      }

      await page.fill('//*[@data-testid="token-input"]//input', code);
      await page.click('//button[@tabindex="0"]');

    }
    else if (config.isPROD) {
      console.log("Estamos en PROD");
      await page.goto(config.urls.PROD, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
      });
    }

  
    await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 40000 });

  if (!(await page.title()).toLowerCase().includes('supermercado')) {
    throw new Error('No se encontró "supermercado" en el título de la página');
  }
  const ipbaneada=false;
  if(!ipbaneada){
          // Ir al login
      await page.click(headerPage.ingresarButton);

      // Llenar email de forma "humana"
      await page.isVisible('#email-d');
      await headerPage.humanType('#email-d', emailAddress);

      // Esperar botón activo y clic
      const nextBtn = page.locator('#btn-continuar-mail-d');
      //await nextBtn.waitFor({ state: 'visible' });
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();

      //modificaciones
      // Seleccionar todos los inputs del OTP (6 dígitos)
    const baseXPath =   "xpath=//*[@class='d-flex justify-content-center gap-3 mb-2']//*[@class='otp-input form-control text-center']";

    // Obtener el código real
    const code = await waitForCode(inboxId, config.timeouts.waitForEmail);

    // Validar formato del código
    if (!/^\d{6}$/.test(code)) {
      throw new Error(`Código OTP inválido recibido: ${code}`);
    }
    else{
            console.log("El codigo recibido es: "+code);
    }

    // 🔥 Llenar cada input usando TU método humanType()
    const selector = `${baseXPath}[1]`;
    const input = page.locator(selector);

    for (let i = 0; i < 6; i++) {
      const digit = code[i];
      await input.type(digit);
    }
    await page.click('#btn-continuar-validate-d');

    //modificaciones
    console.log('Se presionó boton login');
      


      // Esperar redirección al home
    if (config.isPROD) {
        await page.waitForURL(/chedraui.*\.com\.mx/, { timeout: 20000 });
    }else if (config.isEMP){
    await page.waitForURL(/.*chedraui.*/i, { timeout: 20000 });
    }
      // ===== Guardar sesión =====
      console.log(' Login exitoso, guardando sesión...');

      // Guardar cookies
      const cookies = await page.context().cookies();
      fs.writeFileSync('sessionCookies.json', JSON.stringify(cookies, null, 2));

      // Guardar localStorage
      const localStorageData = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        return data;
      });
      fs.writeFileSync('sessionLocalStorage.json', JSON.stringify(localStorageData, null, 2));

      console.log(' Sesión guardada en sessionCookies.json y sessionLocalStorage.json');

  }
}

async function obtenerCodigoVtexDesdeOutlook(page, config, opts = {}) {
  console.log("➡️ Iniciando navegador STEALTH real Playwright...");

  const { chromium } = require('playwright');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  });

  const stealthPage = await context.newPage();

  // LOGIN
  await stealthPage.goto(config.urls.outlook, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await stealthPage.fill('input[type="email"]', config.emails.validUser);
    await stealthPage.click('input[type="submit"]');
  } catch {}

  try {
    await stealthPage.waitForSelector('input[type="password"]', { timeout: 15000 });
    await stealthPage.fill('input[type="password"]', config.password.validPassword);
    await stealthPage.click('input[type="submit"]');
  } catch {}

  try { await stealthPage.click('input[id="idBtn_Back"], button:has-text("No")'); } catch {}

  console.log("➡️ Esperando bandeja...");
  await stealthPage.waitForSelector('div[role="main"]', { timeout: 30000 });
  // Evita esperas largas que dan la sensacion de "se quedo".
  try { stealthPage.setDefaultTimeout(5000); } catch {}

  // Outlook (web) puede separar correos en pestanas (p.ej. "Prioritarios" y "Otros").
  // Antes de recargar, intentamos revisar "Otros" por si el correo llego ahi.
  async function _tryClickTab(nameRegex) {
    try {
      const tabByRole = stealthPage.getByRole('tab', { name: nameRegex }).first();
      const visRole = await tabByRole.isVisible({ timeout: 800 }).catch(() => false);
      if (visRole) {
        await tabByRole.click({ timeout: 1500 }).catch(() => {});
        await stealthPage.waitForTimeout(400);
        return true;
      }

      // Fallback acotado: buscar solo dentro del tablist (evita escanear miles de <div>).
      const tabFallback = stealthPage
        .locator('[role="tablist"] [role="tab"], [role="tablist"] button')
        .filter({ hasText: nameRegex })
        .first();
      await tabFallback.click({ timeout: 1500 }).catch(() => {});
      // Si no existia o no fue clickeable, el catch lo absorbe.
      await stealthPage.waitForTimeout(400);
      // Confirmamos si al menos era visible (click pudo fallar por overlay).
      const visFb = await tabFallback.isVisible({ timeout: 800 }).catch(() => false);
      return visFb;
    } catch {}
    return false;
  }

  console.log("➡️ Comenzando monitoreo VTEX...");
  console.log("VTEX: iniciando escaneo (inbox y Otros)...");

  // Función para leer el último correo
  async function leerUltimoCorreo() {
    const correos = stealthPage.locator('div[role="option"]');
    const ultimo = correos.first();

    // Evita quedar colgado si Outlook aun no termina de renderizar la lista.
    const visible = await ultimo.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return { nodo: null, texto: "" };

    const texto = await ultimo.innerText({ timeout: 1500 }).catch(() => "");
    return { nodo: ultimo, texto };
  }

  function extraerCodigo(texto) {
    const match = texto.match(/Your access code is:\s*(\d{6})/);
    return match ? match[1] : null;
  }

  async function revisarOtrosPorCodigo(codigoPrevio) {
    // Ir a "Otros"/"Other" si existe.
    const fueAOtros = await _tryClickTab(/Otros|Other/i);
    if (!fueAOtros) return null;

    const { texto } = await leerUltimoCorreo();
    const codigo = extraerCodigo(texto);
    const esNuevo = codigo && (!codigoPrevio || codigo !== codigoPrevio);

    // Regresar a la pestana normal si existe (Prioritarios/Focused).
    await _tryClickTab(/Prioritarios|Focused/i);

    return esNuevo ? codigo : null;
  }

  // 1️⃣ Esperar a que llegue un correo que empiece con "Your access code is:"
  // Nuevo flujo: evita tomar un codigo viejo que ya estaba en la bandeja.
  // Regla: ignorar codigos "baseline" (los que estaban al iniciar) y, si es posible, validar que el correo sea reciente.
  const startMs = Date.now();
  // Momento a partir del cual aceptamos el OTP (idealmente: cuando se solicito en VTEX).
  // Si no se provee, usamos startMs.
  const notBeforeMs = (opts && typeof opts.notBeforeMs === 'number' && !Number.isNaN(opts.notBeforeMs))
    ? opts.notBeforeMs
    : startMs;
  // Tolerancia por redondeos / render en Outlook (ms).
  const skewMs = (opts && typeof opts.skewMs === 'number' && !Number.isNaN(opts.skewMs))
    ? opts.skewMs
    : 5000;
  const baselineCodes = new Set();

  async function _tryParseTimestampFromItem(item) {
    try {
      const dt = await item.locator('time').first().getAttribute('datetime', { timeout: 1200 }).catch(() => null);
      if (dt) {
        const ms = Date.parse(dt);
        if (!Number.isNaN(ms)) return { ms, precision: 'exact' };
      }
    } catch {}

    const candidates = [];
    try { candidates.push(await item.getAttribute('aria-label', { timeout: 1200 }).catch(() => null)); } catch {}
    try { candidates.push(await item.getAttribute('title', { timeout: 1200 }).catch(() => null)); } catch {}

    for (const s of candidates) {
      if (!s) continue;
      const iso = String(s).match(/\d{4}-\d{2}-\d{2}T[0-9:.+-]+/);
      if (iso) {
        const ms = Date.parse(iso[0]);
        if (!Number.isNaN(ms)) return { ms, precision: 'exact' };
      }

      const mdy = String(s).match(/\d{1,2}\/\d{1,2}\/\d{2,4}[^0-9]*\d{1,2}:\d{2}(\s*(AM|PM))?/i);
      if (mdy) {
        const ms = Date.parse(mdy[0]);
        if (!Number.isNaN(ms)) return { ms, precision: 'exact' };
      }
    }

    // Ultimo intento: en algunos layouts, el item muestra solo la hora (ej. "12:34" o "12:34 PM").
    // Asumimos que es del dia de hoy y lo comparamos vs startMs.
    try {
      const raw = await item.innerText({ timeout: 1200 }).catch(() => null);
      if (raw) {
        const m = String(raw).match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
        if (m) {
          let hh = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10);
          const ampm = (m[3] || "").toUpperCase();
          if (ampm === "PM" && hh < 12) hh += 12;
          if (ampm === "AM" && hh === 12) hh = 0;
          const d = new Date(notBeforeMs);
          d.setHours(hh, mm, 0, 0);
          let ms = d.getTime();
          // Si quedo "en el futuro" por rollover de dia, restamos 24h.
          if (ms > startMs + 60 * 60 * 1000) ms -= 24 * 60 * 60 * 1000;
          // En Outlook a veces solo vemos HH:MM (sin segundos). Tratamos esto como precision por minuto.
          return { ms, precision: 'minute' };
        }
      }
    } catch {}

    return { ms: null, precision: null };
  }

  async function _leerCodigoYMetaEnTabActual() {
    const { nodo, texto } = await leerUltimoCorreo();
    const codigo = extraerCodigo(texto);
    const ts = nodo ? await _tryParseTimestampFromItem(nodo) : { ms: null, precision: null };
    const tsMs = ts ? ts.ms : null;
    const tsPrecision = ts ? ts.precision : null;
    return { codigo, tsMs, tsPrecision };
  }

  async function _leerCodigoYMetaEnOtros() {
    const fueAOtros = await _tryClickTab(/Otros|Other/i);
    if (!fueAOtros) return { codigo: null, tsMs: null, tsPrecision: null };

    const meta = await _leerCodigoYMetaEnTabActual();
    await _tryClickTab(/Prioritarios|Focused/i);
    return meta;
  }

  const _floorToMinuteMs = (ms) => {
    const d = new Date(ms);
    d.setSeconds(0, 0);
    return d.getTime();
  };

  const esReciente = (tsMs, tsPrecision) => {
    if (typeof tsMs !== 'number' || Number.isNaN(tsMs)) return false;
    // Si el timestamp solo tiene HH:MM, comparamos por minuto para evitar falsos "viejo" dentro del mismo minuto.
    if (tsPrecision === 'minute') {
      const threshold = _floorToMinuteMs(notBeforeMs);
      return tsMs >= threshold;
    }
    // Timestamp con mayor precision.
    return tsMs >= (notBeforeMs - skewMs);
  };

  // Capturamos baseline (lo que ya estaba en pantalla) para no tomar codigos antiguos.
  // Solo marcamos como baseline si NO parece reciente. Si el OTP nuevo ya llego, debe poder usarse.
  console.log("VTEX: leyendo baseline...");
  let baseMain = { codigo: null, tsMs: null };
  try { baseMain = await _leerCodigoYMetaEnTabActual(); } catch {}
  if (baseMain.codigo && !esReciente(baseMain.tsMs, baseMain.tsPrecision)) baselineCodes.add(baseMain.codigo);
  let baseOther = { codigo: null, tsMs: null };
  try { baseOther = await _leerCodigoYMetaEnOtros(); } catch {}
  if (baseOther.codigo && !esReciente(baseOther.tsMs, baseOther.tsPrecision)) baselineCodes.add(baseOther.codigo);
  console.log("VTEX: baseline listo. Iniciando espera de OTP...");

  while (true) {
    const main = await _leerCodigoYMetaEnTabActual().catch(() => ({ codigo: null, tsMs: null, tsPrecision: null }));
    if (main && main.codigo) {
      if (esReciente(main.tsMs, main.tsPrecision)) {
        console.log("Codigo VTEX detectado:", main.codigo);
        await browser.close();
        return main.codigo;
      }
      if (typeof main.tsMs === 'number' && !Number.isNaN(main.tsMs)) {
        console.log("VTEX: codigo ignorado por timestamp viejo (main): " + main.codigo);
      }

      // Sin timestamp: primero sembramos baseline, luego solo aceptamos si cambia.
      if (main.tsMs === null || main.tsMs === undefined) {
        if (baselineCodes.size === 0) {
          baselineCodes.add(main.codigo);
          console.log("VTEX: baseline(seed main, no timestamp): " + main.codigo);
        } else if (!baselineCodes.has(main.codigo)) {
          console.log("Codigo VTEX detectado (main, sin timestamp):", main.codigo);
          await browser.close();
          return main.codigo;
        }
      } else {
        // Timestamp viejo: lo marcamos como baseline y esperamos uno nuevo.
        if (!baselineCodes.has(main.codigo)) baselineCodes.add(main.codigo);
      }
    }

    const other = await _leerCodigoYMetaEnOtros().catch(() => ({ codigo: null, tsMs: null, tsPrecision: null }));
    if (other && other.codigo) {
      if (esReciente(other.tsMs, other.tsPrecision)) {
        console.log("Codigo VTEX detectado en pestana Otros:", other.codigo);
        await browser.close();
        return other.codigo;
      }
      if (typeof other.tsMs === 'number' && !Number.isNaN(other.tsMs)) {
        console.log("VTEX: codigo ignorado por timestamp viejo (Otros): " + other.codigo);
      }

      if (other.tsMs === null || other.tsMs === undefined) {
        if (baselineCodes.size === 0) {
          baselineCodes.add(other.codigo);
          console.log("VTEX: baseline(seed other, no timestamp): " + other.codigo);
        } else if (!baselineCodes.has(other.codigo)) {
          console.log("Codigo VTEX detectado (Otros, sin timestamp):", other.codigo);
          await browser.close();
          return other.codigo;
        }
      } else {
        if (!baselineCodes.has(other.codigo)) baselineCodes.add(other.codigo);
      }
    }

    // Debug ligero para confirmar que el loop esta vivo aunque no haya correos aun.
    // (Evita pensar que se "queda esperando" cuando en realidad esta ciclando.)
    try {
      const n = await stealthPage.locator('div[role="option"]').count().catch(() => 0);
      console.log("Esperando nuevo codigo... refrescando... (items=" + n + ")");
    } catch {
      console.log("Esperando nuevo codigo... refrescando...");
    }
    await stealthPage.reload({ waitUntil: "domcontentloaded" });
    await stealthPage.waitForTimeout(2000);
  }

  let codigoActual = null;

  while (true) {
    const { nodo, texto } = await leerUltimoCorreo();

    const codigo = extraerCodigo(texto);

    if (codigo) {
      console.log("➡️ Primer correo VTEX detectado:", codigo);
      codigoActual = codigo;
      break;
    }

    console.log("⏳ No hay correo VTEX aún... refrescando...");
    const codigoEnOtros = await revisarOtrosPorCodigo(codigoActual);
    if (codigoEnOtros) {
      // En el primer ciclo, codigoActual aun es null: tomamos el codigo y seguimos al ciclo 2.
      if (!codigoActual) {
        console.log("Codigo VTEX detectado en pestana Otros:", codigoEnOtros);
        codigoActual = codigoEnOtros;
        break;
      }

      // En el segundo ciclo ya existe codigoActual: este es un codigo nuevo.
      console.log("Nuevo codigo VTEX detectado en pestana Otros:", codigoEnOtros);
      await browser.close();
      return codigoEnOtros;
    }

    await stealthPage.reload({ waitUntil: "domcontentloaded" });
    await stealthPage.waitForTimeout(2000);
  }

  // 2️⃣ Ya tenemos un código inicial, ahora buscar uno diferente
  while (true) {
    const { texto } = await leerUltimoCorreo();
    const nuevoCodigo = extraerCodigo(texto);

    if (nuevoCodigo && nuevoCodigo !== codigoActual) {
      console.log("📩 Nuevo código VTEX detectado:", nuevoCodigo);
      await browser.close();
      return nuevoCodigo;
    }

    console.log("⏳ Aún no llega un nuevo código... refrescando...");
    const codigoEnOtros = await revisarOtrosPorCodigo(codigoActual);
    if (codigoEnOtros) {
      // En el primer ciclo, codigoActual aun es null: tomamos el codigo y seguimos al ciclo 2.
      if (!codigoActual) {
        console.log("Codigo VTEX detectado en pestana Otros:", codigoEnOtros);
        codigoActual = codigoEnOtros;
        break;
      }

      // En el segundo ciclo ya existe codigoActual: este es un codigo nuevo.
      console.log("Nuevo codigo VTEX detectado en pestana Otros:", codigoEnOtros);
      await browser.close();
      return codigoEnOtros;
    }

    await stealthPage.reload({ waitUntil: "domcontentloaded" });
    await stealthPage.waitForTimeout(2000);
  }
}
module.exports = { loginConCorreo,obtenerCodigoVtexDesdeOutlook };
