// tests/TimeSlotScraper.spec.js
const { test, chromium } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const { getExcelData } = require('../../utils/excelReader');
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
const DirectionsPage = require('../../pages/DirectionsPage');
const excelurl = '.\\data\\FlujosTransaccionales.xlsx';
const exceltab = 'Datos Flujos';
const exceltab2 = 'Validaciones Tarjeta';

let context;
let page;
let headerPage;
let resumencarritos;
let productos;
let carritoUtils;
let directionsPage;

// ------------------------
// BEFORE ALL
// ------------------------
test.beforeAll(async () => {

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--start-maximized']
  });

  page = await context.newPage();
  headerPage = new HeaderPage(page);
  resumencarritos = new ResumenCarritoPage(page);
  productos = new ProductosEncontradosPage(page);
  carritoUtils = new NavegacionActions();
  directionsPage = new DirectionsPage(page);

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

});

// ------------------------
// TEST CASE
// ------------------------
/*
test('C1 - Visualizar metodos de pago', async () => { 
  test.setTimeout(300000);

  // --- Flujo principal ---
  await page.goto(config.urls.PROD);
  await headerPage.safeClick(headerPage.aceptarCookiesButton);
  await page.goto(config.urls.PROD);
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
*/
test('C2 - Flujos Transaccionales', async () => { 
  test.setTimeout(300000);

  // --- Flujo principal ---
  await page.goto(config.urls.PROD);
  await headerPage.safeClick(headerPage.aceptarCookiesButton);
  await page.goto(config.urls.PROD);
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
    const Activosraw = row['Activos'];
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
      console.log("Falta Agregar Captura de los campos");
    }

    //Regresamos a la pagina normal y vaciamos carrito para reiniciar ciclo|
    await carritoUtils.salircheckout(resumencarritos,page);
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

  }




});