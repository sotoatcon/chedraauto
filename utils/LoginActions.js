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
    else if (config.isPROD) {
      console.log("Estamos en PROD");
      await page.goto(config.urls.PROD, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
      });
    }

  //TODA ESTA LOGICA ES PARA ISPROD, ya que espera cargue el sitio default y comienza el flujo del login
  //ESTO NO SUCEDE PARA QA, PORQUE NUNCA TE CARGA EL SITIO DE LA URL, DIRECTAMENTE PASA POR EL LOGIN DE VTEX, LISTO PARA PONER EMAIL Y POSTERIORMENTE CODIGO, UNA VEZ HECHO AUTOMATICAMENTE APARECES LOGUEADO EN EL SITIO DE QA
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
await page.pause();
  


  // Esperar redirección al home
await page.waitForURL(/chedraui.*\.com\.mx/, { timeout: 20000 });
  
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
  console.log("➡️ Iniciando navegador STEALTH para Outlook...");

  // IMPORTS LOCALES (evita tocar tus otros archivos)
  const { chromium } = require('playwright-extra');
  const stealth = require('playwright-extra-plugin-stealth')();
  chromium.use(stealth);

  // Lanzar navegador stealth
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const stealthPage = await context.newPage();

  console.log("➡️ Abriendo Outlook Web en modo stealth...");
  await stealthPage.goto(config.urls.outlook, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // 1️⃣ LOGIN - Email
  try {
    await stealthPage.fill('input[type="email"]', config.emails.validUser);
    await stealthPage.click('input[type="submit"]');
  } catch {
    console.log("⚠️ No apareció input de email (posible sesión existente).");
  }

  // 2️⃣ LOGIN - Password
  try {
    await stealthPage.waitForSelector('input[type="password"]', { timeout: 15000 });
    await stealthPage.fill('input[type="password"]', config.password.validPassword);
    await stealthPage.click('input[type="submit"]');
  } catch {
    console.warn("⚠️ No se pidió contraseña directamente.");
  }

  // 3️⃣ Stay Signed In
  try {
    await stealthPage.click('input[id="idBtn_Back"], button:has-text("No")', { timeout: 8000 });
  } catch {}

  // 4️⃣ Ingreso a la bandeja
  console.log("➡️ Esperando bandeja...");
  await stealthPage.waitForSelector('div[role="main"]', { timeout: 30000 });

  // 5️⃣ Buscar correo VTEX
  console.log("➡️ Buscando correo de VTEX...");
  const mailSelector = 'span:has-text("noreply@vtexcommerce.com.br"), span:has-text("Your access code is:")';

  await stealthPage.waitForSelector(mailSelector, { timeout: 120000 });

  // 6️⃣ Abrir correo
  await stealthPage.click(mailSelector);

  // 7️⃣ Extraer código
  await stealthPage.waitForSelector("//*[contains(@style,'font-size:42px')]//strong", {
    timeout: 20000
  });
  const code = await stealthPage.locator("//*[contains(@style,'font-size:42px')]//strong").innerText();

  console.log("📩 Código VTEX obtenido:", code);

  // 🔚 Cerrar navegador stealth
  await browser.close();

  return code;
}




module.exports = { loginConCorreo,obtenerCodigoVtexDesdeOutlook };
