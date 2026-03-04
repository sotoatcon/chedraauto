const { test } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const NavegacionActions = require('../../utils/NavegacionActions');
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const { getExcelData } = require('../../utils/excelReader');
const config = require('../../utils/Environment');
// const { generarReporteCoincidenciasPDF } = require('../../utils/creadorpdf');

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
// 🔥 BEFORE EACH — SIN abrir navegador; page ya viene logueada
// =========================================================
// =========================================================
// BEFORE EACH SIN GOTO - Reutiliza el browser del globalSetup
// =========================================================
test.beforeEach(async ({ page }, testInfo) => {

  // Instancias de Pages con la misma page del Global Setup
  testInfo.headerPage = new HeaderPage(page);
  testInfo.resumencarritos = new ResumenCarritoPage(page);
  testInfo.productosPage = new ProductosEncontradosPage(page);
  testInfo.carritoUtils = new NavegacionActions();

  // ❌ NO hacer goto aquí
  // porque el token de sesión de VTEX es temporal y no sobrevive redirecciones nuevas.
  
  console.log("➡️ Continuando desde la sesión existente del Global Setup...");
});


// =========================================================
// ❌ NO usamos afterEach — Playwright cierra solo en parallel
// =========================================================



// =========================================================
// 🟦 TEST C1 – ERRORES ORTOGRÁFICOS
// =========================================================
test('C1 - Errores Ortográficos', async ({ page }, testInfo) => {

  console.log('Ingresando a C1');
  await page.pause();

  const { headerPage, productosPage, carritoUtils } = testInfo;
  const data = getExcelData(excelurl, excelerrores);

  const resultadosTotales = [];

  for (const row of data) {

    const Termino = row['Término'];

    const Correccion = row['Correccion']
      .split(',')
      .map(e => e.trim().toLowerCase());

    const equivalencias = row['Equivalencia']
      .split(',')
      .map(e => e.trim().toLowerCase());

    console.log(`\n=== Buscando: ${Termino} ===`);

    // 1️⃣ Buscar término
    const hayResultados = await carritoUtils.buscarProducto(
      page,
      headerPage,
      productosPage,
      Termino
    );
    await page.pause();

    // 2️⃣ Crear estructura base del resultado por término
    let registroTermino = {
      termino: Termino,
      equivalencias,
      correccion: "",
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

    await page.pause();

    // 3️⃣ Evaluar equivalencias y corrección
    const evaluacion = await carritoUtils.evaluarBusquedaErroresOrtograficos(
      page,
      productosPage,
      Correccion,
      equivalencias
    );

    // Copiar todas las métricas devueltas
    registroTermino.coincidencias = evaluacion.coincidencias;
    registroTermino.noCoincidencias = evaluacion.noCoincidencias;
    registroTermino.listaDetallada = evaluacion.listaDetallada;
    registroTermino.correccion = evaluacion.correccion;
    registroTermino.corregido = evaluacion.corregido;
    registroTermino.CC = evaluacion.CC;
    registroTermino.CP = evaluacion.CP;
    registroTermino.SR = evaluacion.SR;
    registroTermino.SN = evaluacion.SN;

    resultadosTotales.push(registroTermino);

    // 4️⃣ Volver al home para siguiente iteración
    await headerPage.safeClick(headerPage.logoImg);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("iframe#launcher", { state: "visible" });
  }

  /*
  await generarReporteCoincidenciasPDF({
    nombreTestCase: "C1_ErroresOrtograficos",
    resultados: resultadosTotales
  });
  */
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
      .map(e => e.trim().toLowerCase());

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