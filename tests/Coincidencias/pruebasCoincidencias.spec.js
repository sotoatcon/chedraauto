const { test } = require('@playwright/test');
const HeaderPage = require('../../pages/HeaderPage');
const ProductosEncontradosPage = require('../../pages/ProductosEncontradosPage'); 
const NavegacionActions = require('../../utils/NavegacionActions');
const ResumenCarritoPage = require('../../pages/ResumenCarritoPage');
const { getExcelData } = require('../../utils/excelReader');
const config = require('../../utils/Environment');
const { loginConCorreo } = require('../../utils/LoginActions');
const DirectionsPage = require('../../pages/DirectionsPage');
const { generarReporteCoincidenciasPDF, generarReporteFrecuenciaAltaPDF, generarReporteLongTailPDF, generarReporteResultadosVaciosPDF, generarReporteBusquedaContextoPDF } = require('../../utils/creadorpdf');

// Archivos Excel
const excelurl = '.\\data\\ChedrahuiQA_Lexico.xlsx';
const excelerrores = 'Errores Ortográficos';
const excellong = 'Long Tail';
const excelfrecuencia = 'Frecuencia Alta';
const excelsemantico = 'Semánticos';
const excelvacios = 'Resultados vacíos';
const excelcontexto = 'Contexto';

// =========================================================
//  Helpers (Excel headers con acentos NFC/NFD)
// =========================================================
// XLSX puede devolver headers como "Término" (NFD: e + acento combinado) en vez de "Término" (NFC).
// Para evitar falsos vacíos, normalizamos llaves quitando diacríticos.
const _normHeader = (s) => String(s || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const getCellNormalized = (row, keys) => {
  // 1) match exacto (rápido)
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] !== null && row[k] !== undefined) {
      const v = String(row[k]).trim();
      if (v.length > 0) return v;
    }
  }

  // 2) fallback: match por header normalizado (NFC/NFD, sin acentos, sin espacios extra)
  const map = new Map();
  for (const rk of Object.keys(row || {})) {
    const nk = _normHeader(rk);
    if (nk && !map.has(nk)) map.set(nk, rk);
  }
  for (const k of keys) {
    const rk = map.get(_normHeader(k));
    if (rk && row && Object.prototype.hasOwnProperty.call(row, rk) && row[rk] !== null && row[rk] !== undefined) {
      const v = String(row[rk]).trim();
      if (v.length > 0) return v;
    }
  }

  return "";
};

// =========================================================
//  Helpers C6 - Contexto (Empathy: alternativas dentro de shadow root)
// =========================================================
const _normText = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const _splitCommaTokens = (s) => String(s || "")
  .split(",")
  .map((x) => _normText(x))
  .filter((x) => x.length > 0);

const evaluarContextoTitulos = (titulos, equivalenciasTokens) => {
  const detalles = [];
  const lista = Array.isArray(titulos) ? titulos : [];
  const toks = Array.isArray(equivalenciasTokens) ? equivalenciasTokens : [];

  for (const titulo of lista) {
    const t = _normText(titulo);
    let correcto = false;
    for (const tok of toks) {
      if (tok && t.includes(tok)) {
        correcto = true;
        break;
      }
    }
    detalles.push({
      titulo: String(titulo || ""),
      correcto,
      resultado: correcto ? "Correcto" : "Incorrecto"
    });
  }

  const resultadosEncontrados = detalles.length;
  const resultadosCorrectos = detalles.reduce((acc, d) => acc + (d.correcto ? 1 : 0), 0);
  const resultadosIncorrectos = resultadosEncontrados - resultadosCorrectos;

  return { detalles, resultadosEncontrados, resultadosCorrectos, resultadosIncorrectos };
};

async function leerAlternativasContextoEmpathy(page, max = 20, waits = {}) {
  const searching = /Buscando alternativas/i;
  const expected = /Encontramos algunas alternativas/i;

  const waitSearchingMs = (waits && typeof waits.waitSearchingMs === 'number') ? waits.waitSearchingMs : 5000;
  const waitAlternativesMs = (waits && typeof waits.waitAlternativesMs === 'number') ? waits.waitAlternativesMs : 5000;
  const pollMs = (waits && typeof waits.pollMs === 'number') ? waits.pollMs : 250;

  const _leerTituloDirecto = async () => {
    const noRes = page.locator('[data-test="no-results-title"]').first();
    const visible = await noRes.isVisible({ timeout: 700 }).catch(() => false);
    if (!visible) return null;
    const titleText = await noRes.innerText().catch(() => "");
    return { titleText: String(titleText || "").trim() };
  };

  const _leerTituloTeleport = async () => {
    const hosts = await page.locator('.x-base-teleport--onlychild').elementHandles().catch(() => []);
    for (const h of hosts) {
      const data = await h.evaluate((el) => {
        const root = el && el.shadowRoot;
        if (!root) return null;
        const titleEl = root.querySelector('[data-test="no-results-title"]');
        if (!titleEl) return null;
        const titleText = (titleEl.textContent || "").trim();
        return { titleText };
      }).catch(() => null);
      if (data && data.titleText) return { titleText: String(data.titleText || "").trim() };
    }
    return null;
  };

  const _leerTituloAny = async () => {
    const d = await _leerTituloDirecto().catch(() => null);
    if (d && d.titleText) return d;
    return await _leerTituloTeleport().catch(() => null);
  };

  const _leerTitulosDirecto = async () => {
    const titlesLoc = page.locator('.x-ai-carousel-suggestion-results [data-test="result-title"]');
    const count = await titlesLoc.count().catch(() => 0);
    const limit = Math.min(count, max);
    const titulos = [];
    for (let i = 0; i < limit; i++) {
      const txt = await titlesLoc.nth(i).innerText().catch(() => "");
      if (txt && txt.trim()) titulos.push(txt.trim());
    }
    return titulos;
  };

  const _leerTitulosTeleport = async () => {
    const hosts = await page.locator('.x-base-teleport--onlychild').elementHandles().catch(() => []);
    for (const h of hosts) {
      const data = await h.evaluate((el, maxLocal) => {
        const root = el && el.shadowRoot;
        if (!root) return null;
        const titles = Array.from(root.querySelectorAll('.x-ai-carousel-suggestion-results [data-test="result-title"]'))
          .map((n) => (n.textContent || "").trim())
          .filter(Boolean)
          .slice(0, maxLocal);
        return { titles };
      }, max).catch(() => null);
      if (data && Array.isArray(data.titles)) return data.titles;
    }
    return [];
  };

  const _leerTitulosAny = async () => {
    // Preferimos directo (Playwright suele atravesar shadow DOM abierto).
    const direct = await _leerTitulosDirecto().catch(() => []);
    if (Array.isArray(direct) && direct.length > 0) return direct;
    return await _leerTitulosTeleport().catch(() => []);
  };

  // Etapa 1: esperar "Buscando alternativas..." (max 5s).
  // Si ya aparece el mensaje final, podemos avanzar directo.
  let vioSearching = false;
  const t0 = Date.now();
  while (Date.now() - t0 < waitSearchingMs) {
    const t = await _leerTituloAny().catch(() => null);
    const titleText = String((t && t.titleText) || "");
    if (expected.test(titleText)) {
      const titulos = await _leerTitulosAny();
      return { tieneAlternativas: true, titleText: titleText.trim(), titulos };
    }
    if (searching.test(titleText)) {
      vioSearching = true;
      break;
    }
    await page.waitForTimeout(pollMs);
  }

  if (!vioSearching) {
    return { tieneAlternativas: false, titleText: "", titulos: [] };
  }

  // Etapa 2: esperar "Encontramos algunas alternativas!" (max 5s).
  const t1 = Date.now();
  while (Date.now() - t1 < waitAlternativesMs) {
    const t = await _leerTituloAny().catch(() => null);
    const titleText = String((t && t.titleText) || "");
    if (expected.test(titleText)) {
      const titulos = await _leerTitulosAny();
      return { tieneAlternativas: true, titleText: titleText.trim(), titulos };
    }
    await page.waitForTimeout(pollMs);
  }

  return { tieneAlternativas: false, titleText: "", titulos: [] };
}

async function escribirYEnviarBusquedaC6(page, headerPage, termino, modo) {
  const producto = String(termino || "");
  if (!producto) return false;

  if (modo === "legacy") {
    try {
      const input = page.locator(headerPage.buscandoInput);
      await input.waitFor({ state: "visible", timeout: 6000 });
      await input.focus();
      await input.fill("");
      await headerPage.humanType(headerPage.buscandoInput, producto);
      await page.keyboard.press("Enter");
      return true;
    } catch {
      return false;
    }
  }

  // Empathy
  try {
    const input = page.getByPlaceholder(/que estas buscando|qu\u00e9 est\u00e1s buscando/i).first();
    await input.waitFor({ state: "visible", timeout: 6000 });
    await input.focus();
    await input.fill("");
    for (const ch of producto) {
      await input.type(ch, { delay: 15 });
    }
    await page.keyboard.press("Enter");
    return true;
  } catch {}

  // Fallback por shadowRoot/evaluate, acotado al buscador.
  try {
    const host = page
      .locator('vtex-search-2-x-searchBarContainer, [class*="searchBar"], [data-testid*="search"]')
      .first();
    await host.evaluate((el, value) => {
      const root = el.shadowRoot;
      if (!root) throw new Error("No se encontro shadowRoot en buscador.");
      const input = root.querySelector('input[data-test="search-input"], input[type="search"], input');
      if (!input) throw new Error("No se encontro input de busqueda dentro de shadowRoot");
      input.focus();
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }, producto);
    return true;
  } catch {}

  return false;
}

// =========================================================
//  Flags de debug (activar manualmente)
// =========================================================
// Poner en true para ejecutar el caso. Por defecto todos en false para evitar comentar codigo.
const C1 = false;
const C2 = false;
const C3 = false;
const C4 = false;
const C5 = false;
const C6 = true;


// =========================================================
//  Paralelismo por archivo
// =========================================================
// These report tests share session/state (cart, pickup store, workspace cookies).
// Running them in parallel causes cross-test interference and flaky failures.
test.describe.configure({ mode: 'serial' });
// =========================================================
//  BEFORE EACH -- Lgica completa para EMP
// =========================================================
// =========================================================
//  BEFORE EACH -- Lgica completa para EMP / QA / PROD
// =========================================================
let empContext;
let empPage;
let empHeaderPage;
let empProductosPage;
let empCarritoUtils;
let empResumenCarrito;
let empDirecciones;

test.beforeAll(async ({ browser }) => {
  if (!config.isEMP) return;

  console.log(" EMP MODE -- ejecutando login completo (beforeAll)...");

  empContext = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  empPage = await empContext.newPage();
  empHeaderPage = new HeaderPage(empPage);

  console.log(" Ejecutando loginConCorreo...");
  // Tus 2 params exactamente como en globalSetup original
  await loginConCorreo(empPage, empHeaderPage, empHeaderPage);

  // Instancias exactamente como las tenias
  empProductosPage = new ProductosEncontradosPage(empPage);
  empCarritoUtils = new NavegacionActions();
  empResumenCarrito = new ResumenCarritoPage(empPage);
  empDirecciones = new DirectionsPage(empPage);
});

test.afterAll(async () => {
  if (empContext) {
    await empContext.close();
    empContext = null;
  }
});

test.beforeEach(async ({ page }, testInfo) => {

  // ============================
  //  EMP -- LOGIN COMPLETO
  // ============================
  if (config.isEMP) {
    // Playwright creates a fresh `page` fixture per test when `({ page })` is present.
    // In EMP mode we reuse `empPage`, so we close the unused page to avoid opening an extra window.
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch {}

    testInfo.page = empPage;
    testInfo.headerPage = empHeaderPage;
    testInfo.productosPage = empProductosPage;
    testInfo.carritoUtils = empCarritoUtils;
    testInfo.resumencarritos = empResumenCarrito;
    testInfo.direcciones = empDirecciones;

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

(C1 ? test : test.skip)('C1 - Errores Ortográficos', async ({}, testInfo) => {

  const page = testInfo.page;      // <- USAMOS LA PAGE DE EMP
  const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;

  console.log('Ingresando a C1');

  const data = getExcelData(excelurl, excelerrores);

  const modos = [
    { label: "empathy", url: config.urls.PRODEMPATHY, modo: "empathy" },
    { label: "legacy", url: config.urls.PROD, modo: "legacy" }
  ];

  // Guardamos ambos modos y al final generamos 1 solo PDF (Empathy primero, luego Legacy).
  const resultadosCombinados = { empathy: [], legacy: [] };

  for (const m of modos) {
    // La cookie VtexWorkspace ya no se usa. Para Legacy forzamos URL sin workspace.
    const urlModo = m.modo === "legacy" ? "https://www.chedraui.com.mx/" : m.url;
    const resultadosTotales = [];

    await page.goto(urlModo);
    await page.waitForTimeout(5000);
    await direcciones.SeleccionarRecogerEspecifico();


    for (const row of data) {
      // Excel headers may come with/without accents depending on reader/encoding.
      const Termino = getCellNormalized(row, ['Término', 'Termino']);
      if (!Termino) {
        throw new Error(`No se pudo leer la columna "Término" del Excel. Keys disponibles: ${Object.keys(row || {}).join(', ')}`);
      }

      const correccionCell = getCellNormalized(row, ['Correccion', 'Corrección']);
      const Correccion = String(correccionCell)
        .split(",")
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);

      const equivalenciaCell = getCellNormalized(row, ['Equivalencia']);
      const equivalencias = String(equivalenciaCell)
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

      await page.goto(urlModo);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector("iframe#launcher", { state: "visible" });
    }

    resultadosCombinados[m.modo] = resultadosTotales;
  }

  await generarReporteCoincidenciasPDF({
    nombreTestCase: "C1_ErroresOrtograficos",
    resultados: resultadosCombinados
  });
   
});




// =========================================================
//  TEST C2 - LONG TAIL (opcional, corregido tambien)
// =========================================================
 
  (C2 ? test : test.skip)('C2 - Long Tail', async ({ page }, testInfo) => {
  
   const pageReal = testInfo.page || page;
   const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;
   const data = getExcelData(excelurl, excellong);
 
   const getCell = (row, keys) => getCellNormalized(row, keys);
  
     const modos = [
       { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' },
       { label: 'legacy', url: config.urls.PROD, modo: 'legacy' }
     ];

    // Guardamos ambos modos y al final generamos 1 solo PDF (Empathy primero, luego Legacy).
    const resultadosCombinados = { empathy: [], legacy: [] };
  
  for (const m of modos) {
     // La cookie VtexWorkspace ya no se usa. Para Legacy forzamos URL sin workspace.
     const urlModo = m.modo === 'legacy' ? 'https://www.chedraui.com.mx/' : m.url;
 
     const resultadosTotales = [];
 
     await pageReal.goto(urlModo);
     await pageReal.waitForTimeout(5000);
     if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
       await direcciones.SeleccionarRecogerEspecifico();
     }
 
     for (const row of data) {
        const Termino = getCell(row, ['Término', 'Termino']);
        const Categoria = getCell(row, ['Categoría', 'Categoria']);
        const Marca = getCell(row, ['Marca']);
        const Especificacion = getCell(row, ['Especificación', 'Especificacion']);
        const Formato = getCell(row, ['Formato']);
        const Intencion = getCell(row, ['Intención', 'Intencion']);
 
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
 
       await pageReal.goto(urlModo);
       await pageReal.waitForLoadState('domcontentloaded');
       await pageReal.waitForSelector('iframe#launcher', { state: 'visible' });
     }
 
       resultadosCombinados[m.modo] = resultadosTotales;
     }

     await generarReporteLongTailPDF({
       nombreTestCase: "C2_LongTail",
       resultados: resultadosCombinados
     });
   });




// =========================================================
//  TEST C3 - FRECUENCIA ALTA (opcional, corregido)
// =========================================================


(C3 ? test : test.skip)('C3 - Frecuencia Alta', async ({}, testInfo) => {

  const page = testInfo.page;
  const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;
  const data = getExcelData(excelurl, excelfrecuencia);

  const getCell = (row, keys) => {
    return getCellNormalized(row, keys);
  };

  const modos = [
    { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' },
    { label: 'legacy', url: config.urls.PROD, modo: 'legacy' }
  ];

  // Guardamos ambos modos y al final generamos 1 solo PDF (Empathy primero, luego Legacy).
  const resultadosCombinados = { empathy: [], legacy: [] };

  for (const m of modos) {
    // La cookie VtexWorkspace ya no se usa. Para Legacy forzamos URL sin workspace.
    const urlModo = m.modo === 'legacy' ? 'https://www.chedraui.com.mx/' : m.url;

    const resultadosTotales = [];

    await page.goto(urlModo);
    await page.waitForTimeout(5000);
    if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
      await direcciones.SeleccionarRecogerEspecifico();
    }

    for (const row of data) {
      const Termino = getCell(row, ['Término', 'Termino']);
      // Nueva definicion: evaluar Equivalencia y Relacionados.
      const equivalencia = getCell(row, ['Equivalencia']);
      const relacionados = getCell(row, ['Relacionados', 'Relacionado']);

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

       const evaluacion = carritoUtils.evaluarFrecuenciaAltaEquivalencias(
         productosEncontrados,
         Termino,
         equivalencia,
         relacionados
       );

      resultadosTotales.push({
        termino: Termino,
        equivalencia,
        relacionados,
        hayResultados,
        productosEncontrados,
        detalles: evaluacion.detalles,
        calificacionPromedio: evaluacion.calificacionPromedio
      });

      // Reset como C1: navegar a home limpia estado y reduce flakiness.
      await page.goto(urlModo);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('iframe#launcher', { state: 'visible' });
    }

    resultadosCombinados[m.modo] = resultadosTotales;
  }

  await generarReporteFrecuenciaAltaPDF({
    nombreTestCase: "C3_FrecuenciaAlta",
    resultados: resultadosCombinados
  });
});

// =========================================================
//  TEST C4 - SEMANTICO (opcional, corregido)
// =========================================================

(C4 ? test : test.skip)('C4 - Semántico', async ({ page }, testInfo) => {

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

   
 });
 
 
  (C5 ? test : test.skip)('C5 - Resultados Vacios', async ({ page }, testInfo) => {
 
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
     // La cookie VtexWorkspace ya no se usa. Para Legacy forzamos URL sin workspace.
     const urlModo = m.modo === 'legacy' ? 'https://www.chedraui.com.mx/' : m.url;

     const resultadosTotales = [];

     await pageReal.goto(urlModo);
     await pageReal.waitForTimeout(5000);
     if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
       await direcciones.SeleccionarRecogerEspecifico();
     }

     for (const row of data) {
       const Termino = getCellNormalized(row, ['Término', 'Termino']);
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

       await pageReal.goto(urlModo);
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

// Contexto //
// Busquedas soportadas por AI mediante una idea (Empathy muestra alternativas en carrusel).
// Contexto //

(C6 ? test : test.skip)('C6 - Busqueda por Contexto', async ({ page }, testInfo) => {
  const pageReal = testInfo.page || page;
  const { headerPage, productosPage, carritoUtils, direcciones } = testInfo;

  // C6 puede tardar mas por el procesamiento de "alternativas" del buscador.
  // Ajuste local del timeout del test para no afectar otros casos.
  try { testInfo.setTimeout(20 * 60 * 1000); } catch {}

  // Si el nombre de la hoja cambia a version sin acento, intentamos ambos.
  let data = [];
  try {
    data = getExcelData(excelurl, excelcontexto);
  } catch (e) {
    data = getExcelData(excelurl, 'Contexto');
  }

  const modos = [
    { label: 'empathy', url: config.urls.PRODEMPATHY, modo: 'empathy' },
    { label: 'legacy', url: config.urls.PROD, modo: 'legacy' }
  ];

  // Guardamos ambos modos y al final generamos 1 solo PDF (Empathy primero, luego Legacy).
  const resultadosCombinados = { empathy: [], legacy: [] };

  for (const m of modos) {
    // Para Legacy forzamos URL sin workspace.
    const urlModo = m.modo === 'legacy' ? 'https://www.chedraui.com.mx/' : m.url;
    const resultadosTotales = [];

    await pageReal.goto(urlModo);
    await pageReal.waitForTimeout(5000);
    if (direcciones && typeof direcciones.SeleccionarRecogerEspecifico === 'function') {
      await direcciones.SeleccionarRecogerEspecifico();
    }

    for (const row of data) {
      const Termino = getCellNormalized(row, ['Término', 'Termino']);
      const EquivalenciaRaw = getCellNormalized(row, ['Equivalencia']);
      const equivalenciasTokens = _splitCommaTokens(EquivalenciaRaw);

      console.log("\n=== Buscando (" + m.label + "): " + Termino + " ===");

      // Medicion C6: tiempo desde teclear/enter hasta ver el primer articulo.
      // Nota: el conteo total de articulos NO se limita a 20 (solo la evaluacion).
      await pageReal.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 }).catch(() => {});
      const tStart = Date.now();
      const escritoOk = await escribirYEnviarBusquedaC6(pageReal, headerPage, Termino, m.modo);

      let titulos = [];
      let tieneAlternativas = false;
      let noResultsTitle = "";
      let totalArticulos = 0;
      let msHastaPrimerResultado = 0;
      let tiempoBusquedaPorResultadoMs = 0;

      if (m.modo === 'empathy') {
        // Si no pudimos escribir/ejecutar la busqueda, no hay nada que esperar.
        if (!escritoOk) {
          tieneAlternativas = false;
          noResultsTitle = "";
          titulos = [];
        } else {
        // Regla: solo aplica si aparece el mensaje de alternativas.
        // Si NO aparece, consideramos 0 resultados (opcion A).
        const ctx = await leerAlternativasContextoEmpathy(pageReal, 20, {
          waitSearchingMs: 15000,
          waitAlternativesMs: 15000,
          pollMs: 250
        });
        tieneAlternativas = !!ctx.tieneAlternativas;
        noResultsTitle = String(ctx.titleText || "");
        titulos = tieneAlternativas ? (Array.isArray(ctx.titulos) ? ctx.titulos : []) : [];

        if (tieneAlternativas) {
          totalArticulos = await pageReal
            .locator('.x-ai-carousel-suggestion-results [data-test="result-title"]')
            .count()
            .catch(() => 0);
          if (totalArticulos <= 0) totalArticulos = titulos.length;
          if (totalArticulos > 0) msHastaPrimerResultado = Date.now() - tStart;
        }
        }
      } else {
        // Legacy: grid normal.
        const legacyLocator = pageReal.locator('//*[@id="gallery-layout-container"]//*[contains(@class,"global__card--name") and contains(@class,"t-small")] >> visible=true');
        const vioPrimero = escritoOk
          ? await legacyLocator.first().waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)
          : false;
        if (vioPrimero) {
          msHastaPrimerResultado = Date.now() - tStart;
          totalArticulos = await legacyLocator.count().catch(() => 0);
          titulos = await carritoUtils.obtenerProductosEncontrados(pageReal, productosPage, m.modo, 20);
          if (totalArticulos <= 0) totalArticulos = titulos.length;
        } else {
          titulos = [];
          totalArticulos = 0;
          msHastaPrimerResultado = 0;
        }
      }

      const evalTerm = evaluarContextoTitulos(titulos, equivalenciasTokens);
      if (totalArticulos > 0) {
        tiempoBusquedaPorResultadoMs = Math.round((msHastaPrimerResultado / totalArticulos) * 100) / 100;
      }

      resultadosTotales.push({
        termino: Termino,
        equivalencia: EquivalenciaRaw,
        equivalenciasTokens,
        tieneAlternativas,
        noResultsTitle,
        resultadosEncontrados: evalTerm.resultadosEncontrados,
        resultadosCorrectos: evalTerm.resultadosCorrectos,
        resultadosIncorrectos: evalTerm.resultadosIncorrectos,
        totalArticulos,
        msHastaPrimerResultado,
        tiempoBusquedaPorResultadoMs,
        detalles: evalTerm.detalles
      });

      // Reset: volver a home limpia estado y reduce flakiness.
      await pageReal.goto(urlModo);
      await pageReal.waitForLoadState('domcontentloaded');
      await pageReal.waitForSelector('iframe#launcher', { state: 'visible' });
    }

    resultadosCombinados[m.modo] = resultadosTotales;
  }

  await generarReporteBusquedaContextoPDF({
    nombreTestCase: 'C6_BusquedaPorContexto',
    resultados: resultadosCombinados
  });
});
