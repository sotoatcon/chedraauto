const { test } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const NavegacionActions = require('../../utils/NavegacionActions');
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const { getExcelData } = require('../../utils/excelReader');
const config = require('../../utils/Environment');
const { loginConCorreo } = require('../../utils/LoginActions');
const DirectionsPage = require('../../pages/DirectionsPage');
const { generarReporteCoincidenciasPDF } = require('../../utils/creadorpdf');

// 📌 Archivos Excel
const excelurl = '.\\data\\ChedrahuiQA_Lexico.xlsx';
const excelerrores = 'Errores Ortográficos';
const excellong = 'Long Tail';
const excelfrecuencia = 'Frecuencia Alta';
const excelsemantico = 'Semánticos';

// =========================================================
// 🔥 Paralelismo por archivo
// =========================================================
test.describe.configure({ mode: 'parallel' });
// =========================================================
// 🔥 BEFORE EACH — Lógica completa para EMP
// =========================================================
// =========================================================
// 🔥 BEFORE EACH — Lógica completa para EMP / QA / PROD
// =========================================================
test.beforeEach(async ({ browser, page }, testInfo) => {

  // ============================
  // 🟣 EMP — LOGIN COMPLETO
  // ============================
  if (config.isEMP) {
    console.log("🔥 EMP MODE — ejecutando login completo...");

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const empPage = await context.newPage();
    testInfo.page = empPage;

    const headerPage = new HeaderPage(empPage);

    console.log("🔐 Ejecutando loginConCorreo...");
    // 👉 Tus 2 params exactamente como en globalSetup original
    await loginConCorreo(empPage, headerPage, headerPage);

    // 👉 Instancias exactamente como tú las tenías
    testInfo.headerPage = headerPage;
    testInfo.productosPage = new ProductosEncontradosPage(empPage);
    testInfo.carritoUtils = new NavegacionActions();
    testInfo.resumencarritos = new ResumenCarritoPage(empPage);
    testInfo.direcciones = new DirectionsPage(empPage);

    return; // ⚠️ NECESARIO
  }

  // ==============================================
  // 🟢 QA/PROD — Reutiliza sesión de storageState
  // ==============================================
  console.log("➡️ QA/PROD → Reutilizando sesión existente…");

  testInfo.page = page;
  testInfo.headerPage = new HeaderPage(page);
  testInfo.resumencarritos = new ResumenCarritoPage(page);
  testInfo.productosPage = new ProductosEncontradosPage(page);
  testInfo.carritoUtils = new NavegacionActions();
  testInfo.direcciones = new DirectionsPage(page);

});

// =========================================================
// 🟦 TEST C1 – ERRORES ORTOGRÁFICOS
// =========================================================
test('C1 - Errores Ortográficos', async ({}, testInfo) => {

  const page = testInfo.page;      // ← USAMOS LA PAGE DE EMP
  const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;

  console.log('Ingresando a C1');

  const data = getExcelData(excelurl, excelerrores);

  const modos = [
    { label: "empathy", url: config.urls.PRODEMPATHY, modo: "empathy" },
    { label: "legacy", url: config.urls.PROD, modo: "legacy" }
  ];

  for (const m of modos) {
    const urlObj = new URL(m.url);
    if (m.modo === "legacy") {
      await page.context().addCookies([{
        name: "VtexWorkspace",
        value: "master%3A87e55a46-08f4-4377-be23-e91e3bbd4612",
        domain: urlObj.hostname,
        path: "/"
      }]);
    }
    if (m.modo === "empathy") {
      await page.context().addCookies([{
        name: "VtexWorkspace",
        value: "wempathyprod",
        domain: urlObj.hostname,
        path: "/"
      }]);
    }
    const resultadosTotales = [];

    await page.goto(m.url);
    await page.waitForTimeout(5000);
    await direcciones.SeleccionarRecogerEspecifico();

    for (const row of data) {
      const Termino = row['Término'];
      const Correccion = row['Correccion']
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
      const equivalencias = row['Equivalencia']
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
      console.log(`\n=== Buscando (${m.label}): ${Termino} ===`);

      const hayResultados = await carritoUtils.buscarProducto(
        page,
        headerPage,
        productosPage,
        Termino,
        null,
        m.modo
      );

      let registroTermino = {
        termino: Termino,
        equivalencias,
        correccion: "",
        correccionEsperada: Correccion,
        corregido: false,
        CC: 0,
        CP: 0,
        SR: false,
        SN: false,
        hayResultados,
        coincidencias: [],
        noCoincidencias: [],
        listaDetallada: []
      };

      const evaluacion = await carritoUtils.evaluarBusquedaErroresOrtograficos(
        page,
        productosPage,
        Correccion,
        equivalencias,
        m.modo
      );

      registroTermino.coincidencias = evaluacion.coincidencias;
      registroTermino.noCoincidencias = evaluacion.noCoincidencias;
      registroTermino.listaDetallada = evaluacion.listaDetallada;
      registroTermino.correccion = evaluacion.correccion;
      registroTermino.corregido = evaluacion.corregido;
      registroTermino.CC = evaluacion.CC;
      registroTermino.CP = evaluacion.CP;
      registroTermino.SR = evaluacion.SR;
      registroTermino.SN = evaluacion.SN;
      registroTermino.calificacion = evaluacion.calificacion;
      registroTermino.totalProductos = evaluacion.totalProductos;
      registroTermino.ccProductos = evaluacion.ccProductos;
      registroTermino.cpProductos = evaluacion.cpProductos;

      resultadosTotales.push(registroTermino);

      await page.goto(m.url);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector("iframe#launcher", { state: "visible" });
    }

    await generarReporteCoincidenciasPDF({
      nombreTestCase: `C1_ErroresOrtograficos_${m.label}`,
      resultados: resultadosTotales,
      modo: m.modo
    });
  }
  
});




// =========================================================
// 🟨 TEST C2 – LONG TAIL (opcional, corregido también)
// =========================================================
/*
test('C2 - Long Tail', async ({ page }, testInfo) => {

  const { headerPage, productosPage, carritoUtils } = testInfo;
  const data = getExcelData(excelurl, excellong);

  const resultadosTotales = [];

  for (const row of data) {

    const Termino = row['Término'];
    console.log(`\n=== Buscando: ${Termino} ===`);

    const hayResultados = await carritoUtils.buscarProducto(
      page,
      headerPage,
      productosPage,
      Termino
    );

    let productosEncontrados = [];

    if (hayResultados) {
      productosEncontrados = await carritoUtils.obtenerProductosEncontrados(
        page,
        productosPage
      );
    }

    resultadosTotales.push({
      termino: Termino,
      hayResultados,
      productosEncontrados
    });

    await headerPage.safeClick(headerPage.logoImg);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("iframe#launcher", { state: "visible" });
  }

  await generarReporteCoincidenciasPDF({
    nombreTestCase: "C2_LongTail",
    resultados: resultadosTotales
  });
});
*/



// =========================================================
// 🟥 TEST C3 – FRECUENCIA ALTA (opcional, corregido)
// =========================================================
/*
test('C3 - Frecuencia Alta', async ({ page }, testInfo) => {

  const { headerPage, productosPage, carritoUtils } = testInfo;
  const data = getExcelData(excelurl, excelfrecuencia);

  const resultadosTotales = [];

  for (const row of data) {

    const Termino = row['Término'];
    console.log(`\n=== Buscando: ${Termino} ===`);

    const hayResultados = await carritoUtils.buscarProducto(
      page,
      headerPage,
      productosPage,
      Termino
    );

    let productosEncontrados = [];

    if (hayResultados) {
      productosEncontrados = await carritoUtils.obtenerProductosEncontrados(
        page,
        productosPage
      );
    }

    resultadosTotales.push({
      termino: Termino,
      hayResultados,
      productosEncontrados
    });

    await headerPage.safeClick(headerPage.logoImg);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("iframe#launcher", { state: "visible" });
  }

  await generarReporteCoincidenciasPDF({
    nombreTestCase: "C3_FrecuenciaAlta",
    resultados: resultadosTotales
  });
});
*/



// =========================================================
// 🟪 TEST C4 – SEMÁNTICO (opcional, corregido)
// =========================================================
/*
test('C4 - Semántico', async ({ page }, testInfo) => {

  const { headerPage, productosPage, carritoUtils } = testInfo;
  const data = getExcelData(excelurl, excelsemantico);

  const resultadosTotales = [];

  for (const row of data) {

    const Termino = row['Término'];
    const equivalencias = row['Equivalencia']
      .split(',')
      .map(e => e.trim().toLowerCase()).filter(e => e.length > 0);

    console.log(`\n=== Buscando: ${Termino} ===`);

    const hayResultados = await carritoUtils.buscarProducto(
      page,
      headerPage,
      productosPage,
      Termino
    );

    let registroTermino = {
      termino: Termino,
      equivalencias,
      hayResultados,
      coincidencias: [],
      noCoincidencias: [],
      listaDetallada: []
    };

    if (hayResultados) {
      const evaluacion = await carritoUtils.evaluarBusquedaErroresOrtograficos(
        page,
        productosPage,
        equivalencias
      );

      registroTermino.coincidencias = evaluacion.coincidencias;
      registroTermino.noCoincidencias = evaluacion.noCoincidencias;
      registroTermino.listaDetallada = evaluacion.listaDetallada;

    } else {
      console.log(`❌ No hubo productos reales para evaluar equivalencias`);
    }

    resultadosTotales.push(registroTermino);

    await headerPage.safeClick(headerPage.logoImg);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("iframe#launcher", { state: "visible" });
  }

  await generarReporteCoincidenciasPDF({
    nombreTestCase: "C4_Semantico",
    resultados: resultadosTotales
  });
});
*/
