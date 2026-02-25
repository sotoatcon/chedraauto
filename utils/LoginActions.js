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
      await loginvtex.safeClick(loginvtex.nextButton);
      await obtenerCodigoVtexDesdeOutlook(page,config);

    }
    else if (config.isEMP) {
      console.log("Estamos en EMP");
      await page.goto(config.urls.EMPATHY, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await loginvtex.humanType(loginvtex.emailInput, config.emails.validUser);
      await loginvtex.safeClick(loginvtex.nextButton);
      const code = await obtenerCodigoVtexDesdeOutlook(page, config);

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

async function obtenerCodigoVtexDesdeOutlook(page, config) {
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

  console.log("➡️ Comenzando monitoreo VTEX...");

  // Función para leer el último correo
  async function leerUltimoCorreo() {
    const correos = stealthPage.locator('div[role="option"]');
    const ultimo = correos.first();
    const texto = await ultimo.innerText().catch(() => "");
    return { nodo: ultimo, texto };
  }

  function extraerCodigo(texto) {
    const match = texto.match(/Your access code is:\s*(\d{6})/);
    return match ? match[1] : null;
  }

  // 1️⃣ Esperar a que llegue un correo que empiece con "Your access code is:"
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
    await stealthPage.reload({ waitUntil: "domcontentloaded" });
    await stealthPage.waitForTimeout(2000);
  }
}
module.exports = { loginConCorreo,obtenerCodigoVtexDesdeOutlook };
