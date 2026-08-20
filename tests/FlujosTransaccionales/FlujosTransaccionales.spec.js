// tests/TimeSlotScraper.spec.js
const { test, chromium } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const { getExcelData } = require('../../utils/excelReader');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const config = require('../../utils/Environment');
const { loginConCorreo } = require('../../utils/LoginActions');
const fs = require('fs');
const path = require('path');
const NavegacionActions = require('../../utils/NavegacionActions');
const PdfPrinter = require('pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
const { sendEmail } = require('../../utils/mailslurp-utils');
const { generarReportePDF } = require('../../utils/creadorpdf');
const DirectionsPage = require('../../pages/DirectionsPage');
const excelurl = '.\\data\\FlujosTransaccionales.xlsx';
const exceltab = 'Datos Flujos';
const exceltab2 = 'Validaciones Tarjeta';
const exceltab3 = 'Repetir Compra';

// =========================================================
//  Flags de debug (activar manualmente)
// =========================================================
// Poner en true para ejecutar el caso. Por defecto C1/C2 en true y C3 en false.
const C1 = false;
const C2 = true;
const C3 = false;

const getBaseUrl = () => {
  if (config.isQA) return config.urls.QA;
  if (config.isEMP) return config.urls.EMPATHY;
  return config.urls.PROD;
};

let context;
let page;
let headerPage;
let resumencarritos;
let productos;
let carritoUtils;
let directionsPage;

let empContext;
let empPage;
let empHeaderPage;
let empResumencarritos;
let empProductos;
let empCarritoUtils;
let empDirectionsPage;

// ------------------------
// BEFORE ALL
// ------------------------
test.beforeAll(async ({ browser }) => {
  if (!config.isEMP) return;

  console.log("EMP MODE -- ejecutando login completo (beforeAll)...");

  empContext = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  empPage = await empContext.newPage();
  empHeaderPage = new HeaderPage(empPage);

  console.log("Ejecutando loginConCorreo...");
  await loginConCorreo(empPage, empHeaderPage, empHeaderPage);

  empResumencarritos = new ResumenCarritoPage(empPage);
  empProductos = new ProductosEncontradosPage(empPage);
  empCarritoUtils = new NavegacionActions();
  empDirectionsPage = new DirectionsPage(empPage);

  // --- Sesión persistente ---
  if (fs.existsSync('./sessionLocalStorage.json')) {
    // Primero navegar UNA sola vez
    // Inyectar localStorage ANTES de cualquier otra navegación
    // Recargar SOLO después de setear localStorage
  }

});

test.afterAll(async () => {
  if (empContext) {
    await empContext.close();
    empContext = null;
  }
});

test.beforeEach(async ({ page: playwrightPage }) => {

  // ============================
  //  EMP -- LOGIN COMPLETO
  // ============================
  if (config.isEMP) {
    // En EMP mode reutilizamos empPage, cerramos el page fixture para no abrir ventanas extra.
    try {
      if (playwrightPage && !playwrightPage.isClosed()) {
        await playwrightPage.close();
      }
    } catch {}

    page = empPage;
    headerPage = empHeaderPage;
    resumencarritos = empResumencarritos;
    productos = empProductos;
    carritoUtils = empCarritoUtils;
    directionsPage = empDirectionsPage;

    return;
  }

  // ==============================================
  //  QA/PROD -- Reutiliza sesion de storageState
  // ==============================================
  console.log("-> QA/PROD -> Reutilizando sesion existente...");

  page = playwrightPage;
  headerPage = new HeaderPage(page);
  resumencarritos = new ResumenCarritoPage(page);
  productos = new ProductosEncontradosPage(page);
  carritoUtils = new NavegacionActions();
  directionsPage = new DirectionsPage(page);

});

// ------------------------
// TEST CASE
// ------------------------

(C1 ? test : test.skip)('C1 - Visualizar metodos de pago', async () => { 
  test.setTimeout(300000);

  // --- Flujo principal ---
  const baseUrl = getBaseUrl();
  await page.goto(baseUrl);
  await headerPage.acceptCookiesIfPresent();
  await page.goto(baseUrl);
  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
  await headerPage.safeClick(headerPage.minicartButton);  
  await page.waitForTimeout(2000);
  await carritoUtils.vaciarCarrito(page, resumencarritos, headerPage);

  await carritoUtils.AgregarProductosDefault(page,headerPage,productos,config,1);
  await headerPage.safeClick(headerPage.minicartButton);
  await page.waitForTimeout(2000);
  await resumencarritos.safeClick(resumencarritos.comprarcarritoButton);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  await carritoUtils.avanzarCarrito(page, resumencarritos);
  await page.waitForTimeout(2000);
 
  const botonHorario = page.locator(resumencarritos.horarioentregaButton).first();
  await botonHorario.waitFor({ state: "visible" });
  await botonHorario.click();

  await headerPage.safeClick(resumencarritos.iralpagoButton);

  const data = getExcelData(excelurl, exceltab);
  console.log(data); 

  //recorrer tiposdepago
  for (const row of data) {
    const TipoPagoText = row['Tipos de pago'];
    const FormaPagoText = row['Forma Pago'];

    console.log("➡️ Validando tipo de pago: " + TipoPagoText);
    headerPage.safeClick(headerPage.formapago(TipoPagoText));
    
    if(TipoPagoText == "Pago contraentrega (al recibir tu pedido)"){
      console.log("Por ser pago contra entrega no se ejecuta validación de campos");
    }else{
          await carritoUtils.ValidarFormulario(page, headerPage, TipoPagoText, FormaPagoText);
    }
  }


});
(C2 ? test : test.skip)('C2 - Flujos Transaccionales', async () => { 
  test.setTimeout(300000);

  // --- Flujo principal ---
  const baseUrl = getBaseUrl();
  await page.goto(baseUrl);
  await headerPage.acceptCookiesIfPresent();
  await page.goto(baseUrl);
  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
  await headerPage.safeClick(headerPage.minicartButton);  
  await page.waitForTimeout(2000);
  await carritoUtils.vaciarCarrito(page, resumencarritos, headerPage);

  //Lee la data del tab del excel

  const data = getExcelData(excelurl, exceltab2);
  console.log(data); 

  //Trabaja row por row
  for (const row of data) {


    const TipoPagoText = row['Tipos de pago'];
    const Activosraw = String(row['Activos']);
    const Activos = Activosraw.split(", ").map(t => t.trim());
    const Entregasraw = row['TipoTienda']
    const Entregas = Entregasraw.split(", ").map(t => t.trim());
    const Sucursal = row['Sucursal'];

    console.log("➡️ Validando entregas: " + Entregas + " con activos: "+Activos);

   //Definir direccion especifica
    await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);
    await headerPage.safeClick(headerPage.enviara_button);
    await directionsPage.SeleccionarDireccionEspecifica(Sucursal);    
    //Agrega activo por activo dentro de los n configurados en un solo row (separados)
    for (const activo of Activos){
        console.log("Agregando "+activo+" al carrito");
        await carritoUtils.buscarYAgregarProducto(page,headerPage,productos,activo);
    }
    await page.waitForTimeout(1000);
    await headerPage.safeClick(headerPage.bannerSuperiorHref);
    await page.waitForTimeout(2000);

    //bloque que ingersa al carrito, hasta el paso 3 donde podremos ver los distintos puntos de entrega

    await headerPage.safeClick(headerPage.minicartButton);
    await page.waitForTimeout(2000);
    await resumencarritos.safeClick(resumencarritos.comprarcarritoButton);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await carritoUtils.avanzarCarrito(page, resumencarritos);
    await page.waitForTimeout(2000);  

    if (!Entregas.includes("Super")) {
                console.log("No incluye Super, no se seleccionan horarios");
    }
    else{
    console.log("Incluye Super, se seleccionan horarios");
    const botonHorario = page.locator(resumencarritos.horarioentregaButton).first();
    await botonHorario.waitFor({ state: "visible" });
    await botonHorario.click();

    }

    //Aqui se consumira la evaluacion de las entregas dentro del paso 3
    await carritoUtils.ValidarEntregas(page, headerPage, Entregas, Sucursal); 

    //Bloque que avanza al ultimo punto del checkout, en construccion
    await headerPage.safeClick(resumencarritos.iralpagoButton);

    //Aqui debemos de seleccionar el metodo de pago y "concluirlo"
    await headerPage.safeClick(headerPage.formapago(TipoPagoText));
    
    if(TipoPagoText == "Pago contraentrega (al recibir tu pedido)"){
      console.log("Por ser pago contra entrega no se ejecuta");
    }else{
      let datos = await carritoUtils.crearDatosPago(row);
      await carritoUtils.LlenarFormularioPago(page, headerPage,TipoPagoText, datos); 
    }
    //Regresamos a la pagina normal y vaciamos carrito para reiniciar ciclo|
    await carritoUtils.salircheckout(resumencarritos,page);
    await page.waitForTimeout(1000);
    await headerPage.safeClick(headerPage.minicartButton);  
    await page.waitForTimeout(1000);

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

    await page.waitForTimeout(2000);
  }




});

(C3 ? test : test.skip)('C3 - Repetir Compra', async () => { 
  test.setTimeout(300000);

  // --- Flujo principal ---
  const baseUrl = getBaseUrl();
  await page.goto(baseUrl);
  await headerPage.acceptCookiesIfPresent();
  await page.goto(baseUrl);
  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  
  //Lee la data del tab del excel
  const data = getExcelData(excelurl, exceltab3);
  console.log(data);
  //Trabaja row por row
  for (const row of data) {
  let orden = row['orderid'];
  

  await headerPage.safeClick(headerPage.micuentaButton);
  // DEBUG: pausar antes de esperar el locator de Mis pedidos (revisar por que no aparece)
  await page.pause();
  await headerPage.safeClick(headerPage.mispedidosHref);
  await headerPage.safeClick(headerPage.detalleorden(orden));
  await page.pause();
  await headerPage.safeClick(headerPage.repetircompraButton);  
  await headerPage.safeClick(headerPage.minicartButton);
  await page.pause();
  }

});

