const { test } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const NavegacionActions = require('../../utils/NavegacionActions');
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const { getExcelData } = require('../../utils/excelReader');
const config = require('../../utils/Environment');
const { loginConCorreo } = require('../../utils/LoginActions');
const DirectionsPage = require('../../pages/DirectionsPage');
const { generarReporteCoincidenciasPDF, generarReporteFrecuenciaAltaPDF, generarReporteLongTailPDF, generarReporteResultadosVaciosPDF } = require('../../utils/creadorpdf');

// Archivos Excel
const excelurl = '.\\data\\ChedrahuiQA_Lexico.xlsx';
const excelerrores = 'Errores Ortogr\u00e1ficos';
const excellong = 'Long Tail';
const excelfrecuencia = 'Frecuencia Alta';
const excelsemantico = 'Sem\u00e1nticos';
const excelvacios = 'Resultados Vac\u00edos';


// =========================================================
//  Paralelismo por archivo
// =========================================================
test.describe.configure({ mode: 'parallel' });
// =========================================================
//  BEFORE EACH -- Lgica completa para EMP
// =========================================================
// =========================================================
//  BEFORE EACH -- Lgica completa para EMP / QA / PROD
// =========================================================
test.beforeEach(async ({ browser, page }, testInfo) => {

  // ============================
  //  EMP -- LOGIN COMPLETO
  // ============================
  if (config.isEMP) {
    console.log(" EMP MODE -- ejecutando login completo...");

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const empPage = await context.newPage();
    testInfo.page = empPage;

    const headerPage = new HeaderPage(empPage);

    console.log(" Ejecutando loginConCorreo...");
    //  Tus 2 params exactamente como en globalSetup original
    await loginConCorreo(empPage, headerPage, headerPage);

    //  Instancias exactamente como t las tenas
    testInfo.headerPage = headerPage;
    testInfo.productosPage = new ProductosEncontradosPage(empPage);
    testInfo.carritoUtils = new NavegacionActions();
    testInfo.resumencarritos = new ResumenCarritoPage(empPage);
    testInfo.direcciones = new DirectionsPage(empPage);

    return; // WARN NECESARIO
  }

  // ==============================================
  //  QA/PROD -- Reutiliza sesin de storageState
  // ==============================================
  console.log("-> QA/PROD -> Reutilizando sesin existente...");

  testInfo.page = page;
  testInfo.headerPage = new HeaderPage(page);
  testInfo.resumencarritos = new ResumenCarritoPage(page);
  testInfo.productosPage = new ProductosEncontradosPage(page);
  testInfo.carritoUtils = new NavegacionActions();
  testInfo.direcciones = new DirectionsPage(page);

});

// =========================================================
//  TEST C1 - ERRORES ORTOGRFICOS
// =========================================================

/*
test('C1 - Errores Ortogr\\u00e1ficos', async ({}, testInfo) => {

  const page = testInfo.page;      // <- USAMOS LA PAGE DE EMP
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
      const Termino = row['T\\u00e9rmino'];
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


*/

// =========================================================
//  TEST C2 - LONG TAIL (opcional, corregido tambin)
// =========================================================
/*
 test('C2 - Long Tail', async ({ page }, testInfo) => {
 
   const pageReal = testInfo.page || page;
   const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;
   const data = getExcelData(excelurl, excellong);
 
   const getCell = (row, keys) => {
     for (const k of keys) {
       if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] !== null && row[k] !== undefined) {
         const v = String(row[k]).trim();
         if (v.length > 0) return v;
       }
     }
     return '';
   };
 
   const modos = [
     { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' },
     { label: 'legacy', url: config.urls.PROD, modo: 'legacy' }
   ];
 
   for (const m of modos) {
     const urlObj = new URL(m.url);
     if (m.modo === 'legacy') {
       await pageReal.context().addCookies([{
         name: 'VtexWorkspace',
         value: 'master%3A87e55a46-08f4-4377-be23-e91e3bbd4612',
         domain: urlObj.hostname,
         path: '/'
       }]);
     }
     if (m.modo === 'empathy') {
       await pageReal.context().addCookies([{
         name: 'VtexWorkspace',
         value: 'wempathyprod',
         domain: urlObj.hostname,
         path: '/'
       }]);
     }
 
     const resultadosTotales = [];
 
     await pageReal.goto(m.url);
     await pageReal.waitForTimeout(5000);
     if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
       await direcciones.SeleccionarRecogerEspecifico();
     }
 
     for (const row of data) {
        const Termino = getCell(row, ['T\u00e9rmino', 'Termino']);
        const Categoria = getCell(row, ['Categor\u00eda', 'Categoria']);
        const Marca = getCell(row, ['Marca']);
        const Especificacion = getCell(row, ['Especificaci\u00f3n', 'Especificacion']);
        const Formato = getCell(row, ['Formato']);
        const Intencion = getCell(row, ['Intenci\u00f3n', 'Intencion']);
 
       console.log("\n=== Buscando (" + m.label + "): " + Termino + " ===");
 
       let hayResultados = await carritoUtils.buscarProducto(
         pageReal,
         headerPage,
         productosPage,
         Termino,
         m.modo
       );
 
       // Empathy: a veces renderiza tarde y `buscarProducto` puede devolver falso.
       if (!hayResultados && m.modo === 'empathy') {
         await pageReal.waitForTimeout(750);
         const lateCount = await pageReal.locator('[data-test="result-title"]').count();
         if (lateCount > 0) {
           console.log(`Retry empathy: detectados ${lateCount} resultados tarde.`);
           hayResultados = true;
         } else if (process.env.PAUSE_ON_C2_FAILURE === '1') {
           await pageReal.pause();
         }
       }
 
       const productosEncontrados = hayResultados
         ? await carritoUtils.obtenerProductosEncontrados(pageReal, productosPage, m.modo)
         : [];
 
       const evaluacion = carritoUtils.evaluarLongTail(
         productosEncontrados,
         Categoria,
         Marca,
         Especificacion,
         Formato,
         Intencion
       );
 
       resultadosTotales.push({
         termino: Termino,
         categoria: Categoria,
         marca: Marca,
         especificacion: Especificacion,
         formato: Formato,
         intencion: Intencion,
         hayResultados,
         detalles: evaluacion.detalles,
         calificacionPromedio: evaluacion.calificacionPromedio
       });
 
       await pageReal.goto(m.url);
       await pageReal.waitForLoadState('domcontentloaded');
       await pageReal.waitForSelector('iframe#launcher', { state: 'visible' });
     }
 
     await generarReporteLongTailPDF({
       nombreTestCase: `C2_LongTail_${m.label}`,
       resultados: resultadosTotales,
       modo: m.modo
     });
   }
 });

*/


// =========================================================
//  TEST C3 - FRECUENCIA ALTA (opcional, corregido)
// =========================================================

/*
test('C3 - Frecuencia Alta', async ({}, testInfo) => {

  const page = testInfo.page;
  const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;
  const data = getExcelData(excelurl, excelfrecuencia);

  const getCell = (row, keys) => {
    for (const k of keys) {
      if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] !== null && row[k] !== undefined) {
        const v = String(row[k]).trim();
        if (v.length > 0) return v;
      }
    }
    return '';
  };

  const modos = [
    { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' },
    { label: 'legacy', url: config.urls.PROD, modo: 'legacy' }
  ];

  for (const m of modos) {
    const urlObj = new URL(m.url);
    if (m.modo === 'legacy') {
      await page.context().addCookies([{
        name: 'VtexWorkspace',
        value: 'master%3A87e55a46-08f4-4377-be23-e91e3bbd4612',
        domain: urlObj.hostname,
        path: '/'
      }]);
    }
    if (m.modo === 'empathy') {
      await page.context().addCookies([{
        name: 'VtexWorkspace',
        value: 'wempathyprod',
        domain: urlObj.hostname,
        path: '/'
      }]);
    }

    const resultadosTotales = [];

    await page.goto(m.url);
    await page.waitForTimeout(5000);
    if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
      await direcciones.SeleccionarRecogerEspecifico();
    }

    for (const row of data) {
      const Termino = getCell(row, ['T\u00e9rmino', 'Termino']);
      const categoriaYAttr = getCell(row, ['Categor\u00eda y atributo clave', 'Categoria y atributo clave']);
      const marca = getCell(row, ['Marca']);
      const attrSecundario = getCell(row, ['Atributo secundario', 'Atributo Secundario']);
      const intencionDiferente = getCell(row, ['Mismo universo diferente intenci\u00f3n', 'Mismo universo diferente intencion']);

      console.log("\n=== Buscando (" + m.label + "): " + Termino + " ===");

      let hayResultados = await carritoUtils.buscarProducto(
        page,
        headerPage,
        productosPage,
        Termino,
        m.modo
      );

      // Empathy a veces renderiza tarde el grid (falso negativo). Damos una oportunidad extra.
      if (!hayResultados && m.modo === 'empathy') {
        await page.waitForTimeout(800);
        const lateCount = await page.locator('[data-test="result-title"]').count().catch(() => 0);
        if (lateCount > 0) {
          console.log('Retry empathy: resultados aparecieron tarde (' + lateCount + ')');
          hayResultados = true;
        }
      }

      // Debug opcional: pausa solo si lo activas con PAUSE_ON_C3_FAILURE=1
      if (!hayResultados && m.modo === 'empathy' && process.env.PAUSE_ON_C3_FAILURE === '1') {
        console.log('PAUSE_ON_C3_FAILURE activo. URL actual: ' + page.url());
        const typed = await page
          .getByPlaceholder(/que estas buscando|qu\u00e9 est\u00e1s buscando/i)
          .first()
          .inputValue()
          .catch(() => '');
        console.log('PAUSE_ON_C3_FAILURE inputValue: ' + typed);
        await page.pause();
      }

      let productosEncontrados = [];
      if (hayResultados) {
        productosEncontrados = await carritoUtils.obtenerProductosEncontrados(
          page,
          productosPage,
          m.modo
        );
      }

      const evaluacion = carritoUtils.evaluarFrecuenciaAlta(
        productosEncontrados,
        categoriaYAttr,
        marca,
        attrSecundario,
        intencionDiferente
      );

      resultadosTotales.push({
        termino: Termino,
        categoriaYAttr,
        marca,
        attrSecundario,
        intencionDiferente,
        hayResultados,
        productosEncontrados,
        detalles: evaluacion.detalles,
        calificacionPromedio: evaluacion.calificacionPromedio
      });

      // Reset como C1: navegar a home limpia estado y reduce flakiness.
      await page.goto(m.url);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('iframe#launcher', { state: 'visible' });
    }

    await generarReporteFrecuenciaAltaPDF({
      nombreTestCase: "C3_FrecuenciaAlta_" + m.label,
      resultados: resultadosTotales,
      modo: m.modo
    });
  }
});

*/


// =========================================================
//  TEST C4 - SEMNTICO (opcional, corregido)
// =========================================================
/*
test('C4 - Sem\\u00e1ntico', async ({ page }, testInfo) => {

  const { headerPage, productosPage, carritoUtils } = testInfo;
  const data = getExcelData(excelurl, excelsemantico);

  const resultadosTotales = [];

  for (const row of data) {

    const Termino = row['T\\u00e9rmino'];
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
      console.log('No hubo productos reales para evaluar equivalencias');
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
*/

 test('C5 - Resultados Vacios', async ({ page }, testInfo) => {

   const pageReal = testInfo.page || page;
   const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;

   // Si el nombre de la hoja cambia a version sin acento, intentamos ambos.
   let data = [];
   try {
     data = getExcelData(excelurl, excelvacios);
   } catch (e) {
     data = getExcelData(excelurl, 'Resultados Vacios');
   }

   const getCell = (row, keys) => {
     for (const k of keys) {
       if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] !== null && row[k] !== undefined) {
         const v = String(row[k]).trim();
         if (v.length > 0) return v;
       }
     }
     return '';
   };

   const normalizeKey = (k) => String(k || '').trim().toLowerCase();

   // Override getCell for C5 only: tolera headers con espacios al final o variaciones de mayusculas.
   const getCellNormalized = (row, keys) => {
     if (!row) return '';
     for (const k of keys) {
       if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== null && row[k] !== undefined) {
         const v = String(row[k]).trim();
         if (v.length > 0) return v;
       }
       const target = normalizeKey(k);
       for (const realKey of Object.keys(row)) {
         if (normalizeKey(realKey) === target) {
           const v = String(row[realKey] || '').trim();
           if (v.length > 0) return v;
         }
       }
     }
     return '';
   };

   const splitTokens = (value) => {
     return String(value || '')
       .split(',')
       .map((t) => t.trim().toLowerCase())
       .filter((t) => t.length > 0);
   };

   const contieneAlguno = (texto, tokens) => {
     const t = String(texto || '').toLowerCase();
     for (const tok of tokens) {
       if (tok && t.includes(tok)) return true;
     }
     return false;
   };

   const clasificarResultado = (titulo, relevTokens, parcialTokens) => {
     if (contieneAlguno(titulo, relevTokens)) return 'Relevante';
     if (contieneAlguno(titulo, parcialTokens)) return 'Parcialmente';
     return 'Irrelevante';
   };

   const evaluarTermino = (titulos, relevTokens, parcialTokens) => {
     const lista = Array.isArray(titulos) ? titulos : [];
     if (lista.length === 0) {
       return {
         calificacion: 'V',
         detalles: []
       };
     }

     const detalles = lista.map((t) => ({
       titulo: String(t || ''),
       calificacion: clasificarResultado(t, relevTokens, parcialTokens)
     }));

     const tieneR = detalles.some((d) => d.calificacion === 'Relevante');
     const tieneP = detalles.some((d) => d.calificacion === 'Parcialmente');
     const cal = tieneR ? 'R' : (tieneP ? 'P' : 'I');

     return {
       calificacion: cal,
       detalles
     };
   };

   const modos = [
     { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' }
   ];

   for (const m of modos) {
     const urlObj = new URL(m.url);
     if (m.modo === 'legacy') {
       await pageReal.context().addCookies([{
         name: 'VtexWorkspace',
         value: 'master%3A87e55a46-08f4-4377-be23-e91e3bbd4612',
         domain: urlObj.hostname,
         path: '/'
       }]);
     }
     if (m.modo === 'empathy') {
       await pageReal.context().addCookies([{
         name: 'VtexWorkspace',
         value: 'wempathyprod',
         domain: urlObj.hostname,
         path: '/'
       }]);
     }

     const resultadosTotales = [];

     await pageReal.goto(m.url);
     await pageReal.waitForTimeout(5000);
     if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
       await direcciones.SeleccionarRecogerEspecifico();
     }

     for (const row of data) {
       const Termino = getCellNormalized(row, ['T\u00e9rmino', 'Termino']);
       const Relevancia = getCellNormalized(row, ['Relevancia']);
       const Parcial = getCellNormalized(row, ['Parcialmente Relevantes', 'Parcialmente Relevante']);

       const relevTokens = splitTokens(Relevancia);
       const parcialTokens = splitTokens(Parcial);

       console.log("\n=== Buscando (" + m.label + "): " + Termino + " ===");

       let hayResultados = await carritoUtils.buscarProducto(
         pageReal,
         headerPage,
         productosPage,
         Termino,
         m.modo
       );

       // Empathy: a veces renderiza tarde el grid (falso negativo). Damos una oportunidad extra.
       if (!hayResultados && m.modo === 'empathy') {
         await pageReal.waitForTimeout(800);
         const lateCount = await pageReal.locator('[data-test="result-title"]').count().catch(() => 0);
         if (lateCount > 0) hayResultados = true;
       }

       const titulos = hayResultados
         ? await carritoUtils.obtenerProductosEncontrados(pageReal, productosPage, m.modo)
         : [];

       const evalTerm = evaluarTermino(titulos, relevTokens, parcialTokens);
       const totalResultados = Array.isArray(titulos) ? titulos.length : 0;

       resultadosTotales.push({
         termino: Termino,
         relevancia: Relevancia,
         parcialmenteRelevantes: Parcial,
         hayResultados: Array.isArray(titulos) && titulos.length > 0,
         productosEncontrados: titulos,
         detalles: evalTerm.detalles,
         totalResultados,
         calificacion: evalTerm.calificacion
       });

       await pageReal.goto(m.url);
       await pageReal.waitForLoadState('domcontentloaded');
       await pageReal.waitForSelector('iframe#launcher', { state: 'visible' });
     }

     await generarReporteResultadosVaciosPDF({
       nombreTestCase: 'C5_ResultadosVacios_' + m.label,
       resultados: resultadosTotales,
       modo: m.modo
     });
   }
 });

