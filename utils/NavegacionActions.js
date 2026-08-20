const { expect } = require('@playwright/test');

class NavegacionActions {
  _normalizarComparacion(valor) {
    return String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  _legacyProductCards(page) {
    return page.locator('xpath=//*[@id="gallery-layout-container"]/div/section[.//article]');
  }

  _empathyProductCards(page) {
    // Empathy ha alternado entre el buscador viejo (data-wysiwyg/result-title)
    // y el render VTEX nuevo; mantenemos ambos para evitar falsos negativos.
    return page.locator([
      'article[data-wysiwyg="result"]:visible',
      '[data-wysiwyg="result"]:visible',
      'article[class*="vtex-product-summary-2-x-element"]:visible'
    ].join(', '));
  }

  async _hayLegacySinResultados(page, productos) {
    const selectores = [
      productos && productos.sinresultadosLabel,
      '//*[contains(@class,"search-result-not-found")]',
      '//*[contains(normalize-space(.),"Oh, no!") or contains(normalize-space(.),"No encontramos")]'
    ].filter(Boolean);

    for (const selector of selectores) {
      const visible = await page
        .locator(selector)
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (visible) return true;
    }

    return false;
  }

  _extraerTituloLegacyDesdeTexto(textoCard) {
    const lineas = String(textoCard || "")
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0);

    const titulo = [];
    for (const linea of lineas) {
      const normalizada = linea.toLowerCase();
      if (/^\$/.test(linea)) continue;
      if (/^\d+\s*(pz|pieza|piezas|kg|g|gr|ml|l|lt|litro|litros)\b/i.test(linea)) break;
      if (/^(agregar|agotado|venta por pieza|envio gratis|envío gratis)$/i.test(linea)) break;
      if (/^\d+\s*%$/.test(linea) || /^\d+x\$/.test(normalizada)) break;
      titulo.push(linea);
    }

    return titulo.join(" ").trim();
  }

  async _leerTituloLegacyCard(card) {
    const tituloDirecto = await card
      .locator('xpath=.//*[contains(@class,"global__card--name") and contains(@class,"t-small")]')
      .first()
      .innerText()
      .catch(() => "");

    if (tituloDirecto && tituloDirecto.trim()) return tituloDirecto.trim();

    const textoCard = await card.innerText().catch(() => "");
    return this._extraerTituloLegacyDesdeTexto(textoCard);
  }

  async _leerTituloEmpathyCard(card) {
    const tituloWysiwyg = await card.getAttribute("data-wysiwyg-title").catch(() => "");
    if (tituloWysiwyg && tituloWysiwyg.trim()) return tituloWysiwyg.trim();

    const selectoresTitulo = [
      '[data-test="result-title"]',
      'span[class*="vtex-product-summary-2-x-brandName"]',
      'span[class*="vtex-product-summary-2-x-productBrand"]',
      'h3[class*="vtex-product-summary-2-x-productNameContainer"]'
    ];

    for (const selector of selectoresTitulo) {
      const titulo = await card
        .locator(selector)
        .first()
        .innerText()
        .catch(() => "");
      if (titulo && titulo.trim()) return titulo.trim();
    }

    const ariaLabel = await card
      .locator('[aria-label*="Nombre del producto"], [aria-label*="Imagen del producto"], a[aria-label]')
      .first()
      .getAttribute("aria-label")
      .catch(() => "");

    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel
        .replace(/^Nombre del producto/i, "")
        .replace(/^Imagen del producto/i, "")
        .trim();
    }

    const alt = await card
      .locator("img[alt]")
      .first()
      .getAttribute("alt")
      .catch(() => "");

    if (alt && alt.trim()) return alt.trim();

    const textoCard = await card.innerText().catch(() => "");
    return this._extraerTituloLegacyDesdeTexto(textoCard);
  }
    
  async avanzarCarrito(page, resumencarritos) {
    const currentUrl = page.url();

    if (currentUrl.includes(resumencarritos.paso3URL)) {
      console.warn('Ya estamos en paso 3, listo para continuar.');
      await page.waitForTimeout(500);
    }

    if (currentUrl.includes(resumencarritos.paso2URL)) {
      console.warn('Estamos en paso 2, completando datos...');
      await resumencarritos.humanType(resumencarritos.contactonombreInput, 'Joaquin');
      await resumencarritos.humanType(resumencarritos.contactoapellidoInput, 'Soto Castillo');
      await resumencarritos.humanType(resumencarritos.contactotelefonoInput, '5550553518');
      //await page.waitForSelector(resumencarritos.telefonoCapturadoCheck, { state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      await resumencarritos.safeClick(resumencarritos.irenvioButton);
      await page.waitForTimeout(4000);
      return await this.avanzarCarrito(page, resumencarritos);
    }

    if (currentUrl.includes(resumencarritos.paso1URL)) {
      console.warn(`Estamos en paso 1. Intentando avanzar...`);
      await page.waitForTimeout(2000);
      await resumencarritos.safeClick(resumencarritos.continuarconlacompraButton);
      await page.waitForTimeout(3000);
      return await this.avanzarCarrito(page, resumencarritos);
    } 

    console.warn('URL desconocida, esperando a que avance de manera natural...');
    return;
  }

  async buscarYAgregarProducto(page, headerPage, productos, producto) {
    console.warn("Se ingresar a BuscarYAgregarProducto");
    await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
    await page.locator(headerPage.buscandoInput).focus();
    await page.locator(headerPage.buscandoInput).fill("");
    await page.waitForTimeout(500);  
    await headerPage.humanType(headerPage.buscandoInput, producto);
    await page.waitForTimeout(500);  

    // Nuevo flujo: agregar directamente desde el popup de autocompletar (si existe).
    const botonAgregarAutocomplete = page.locator(productos.autocompletarAgregarButton).first();
    const sugerido = page.locator(productos.autocompletarbusqueda).first();

    const visibleAutocompleteAdd = await botonAgregarAutocomplete.isVisible({ timeout: 4000 }).catch(() => false);
    if (visibleAutocompleteAdd) { 

      await botonAgregarAutocomplete.click();
      await page.isVisible(productos.productoagregadoAlert);
      await headerPage.safeClick(headerPage.logoImg);
      await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
      return true;
    }

    // Fallback: flujo anterior (seleccionar sugerido y agregar desde la ficha/listado).
    await sugerido.waitFor({ state: 'visible' });
    await sugerido.click();

    const botonAgregar = page.locator(productos.agregarproductolateralButton);
    const labelAgotado = page.locator(productos.productoAgotadoButton);

    try {
      await Promise.race([
        botonAgregar.waitFor({ state: 'visible', timeout: 5000 }),
        labelAgotado.waitFor({ state: 'visible', timeout: 5000 })
      ]);
    } catch (err) {
      console.warn(` Timeout esperando botn o label para producto: ${producto}`);
      return false;
    }

    if (await botonAgregar.count() > 0 && await botonAgregar.isVisible()) {
      await botonAgregar.click();
      await page.isVisible(productos.productoagregadoAlert);
      await headerPage.safeClick(headerPage.logoImg);
      await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
      return true;
    }

    if (await labelAgotado.count() > 0 && await labelAgotado.isVisible()) {
      console.warn(` Producto agotado: ${producto}`);
      await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
      return false;
    }

    
    await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
    return false;
  }

  /**
   *  Buscar producto con estabilizacin de resultados
   */
async buscarProducto(page, headerPage, productos, producto, modo = "empathy") {
  console.warn("Se ingresar a buscarProducto");

  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });

  let busquedaExitosa = false;

  if (modo === "legacy") {
    const input = page.locator(headerPage.buscandoInput);
    await input.waitFor({ state: 'visible' });

    await input.focus();
    await input.fill("");
    await headerPage.humanType(headerPage.buscandoInput, producto);
    await page.keyboard.press('Enter');
    busquedaExitosa = true;
  } else {
    const intentos = [
      {
        nombre: "placeholder",
        locator: page.getByPlaceholder(/que estas buscando|qu\u00e9 est\u00e1s buscando/i).first()
      }
    ];

    for (const intento of intentos) {
      try {
        await intento.locator.waitFor({ state: "visible", timeout: 4000 });
        await intento.locator.focus();
        await intento.locator.fill("");
        for (const char of producto) {
          await intento.locator.type(char, { delay: 15 });
        }
        await page.keyboard.press("Enter");
        console.log(`Busqueda escrita con selector: ${intento.nombre}`);
        busquedaExitosa = true;
        break;
      } catch {
        console.warn(`Fall\u00f3 selector ${intento.nombre}`);
      }
    }
  }

  if (!busquedaExitosa) {
    const host = page.locator('vtex-search-2-x-searchBarContainer, [class*="searchBar"], [data-testid*="search"]').first();
    if (modo === "legacy") {
      console.warn("No fue posible escribir en buscador legacy con locators directos.");
      throw new Error("No se encontro input visible en buscador legacy.");
    }
    console.warn("No fue posible escribir con locators directos, intentando fallback por shadowRoot/evaluate.");
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
  }

  // --- Espera resultados (legacy vs empathy) ---
  const legacyResultadosLocator = this._legacyProductCards(page);
  const empathyResultadosLocator = this._empathyProductCards(page);
  const resultadosLocator = modo === "legacy"
    ? legacyResultadosLocator
    : empathyResultadosLocator;

  if (modo === "legacy") {
    await Promise.race([
      page.locator(productos.sinresultadosLabel).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      resultadosLocator.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    ]);
  } else {
    // Empathy puede tardar en renderizar: hacemos un retry corto para evitar falsos negativos.
    await resultadosLocator.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const visible = await resultadosLocator.first().isVisible().catch(() => false);
    if (!visible) {
      await page.waitForTimeout(500);
      await resultadosLocator.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    }
  }

  // --- Si hay resultados, estabilizar el conteo por visibilidad ---
  if (await resultadosLocator.first().isVisible().catch(() => false)) {
    let visibles = 0;

    if (modo === "legacy") {
      const elementos = resultadosLocator;
      let prevVisibleCount = -1;
      let stableRounds = 0;

      const legacyTargetCount = 20;

      for (let i = 0; i < 20; i++) {
        visibles = await elementos.count().catch(() => 0);
        console.log("Legacy iteracion " + i + " -> visibles: " + visibles + ", prev: " + prevVisibleCount);

        if (visibles === prevVisibleCount) {
          stableRounds++;
          console.log("Legacy visibilidad estable (" + stableRounds + ")");

          if (visibles >= legacyTargetCount && stableRounds >= 1) {
            console.log("Legacy completado: la lista dejo de crecer");
            break;
          }

          if (stableRounds >= 5) {
            console.log("Legacy completado: maximas rondas estables alcanzadas");
            break;
          }
        } else {
          console.log("Legacy cambio detectado (visibles: " + visibles + "), reseteando...");
          stableRounds = 0;
        }

        prevVisibleCount = visibles;
        await page.evaluate((iteracion) => {
          const gallery = document.querySelector("#gallery-layout-container");
          if (gallery) gallery.scrollIntoView({ block: iteracion % 2 === 0 ? "start" : "end" });
          window.scrollBy(0, 900);
        }, i).catch(() => {});
        await page.mouse.wheel(0, 900).catch(() => {});
        await page.waitForTimeout(900);
      }
    } else {
      const elementos = resultadosLocator;
      let prevVisibleCount = -1;
      let stableRounds = 0;

      for (let i = 0; i < 10; i++) {
        const total = await elementos.count();
        visibles = 0;

        for (let j = 0; j < total; j++) {
          if (await elementos.nth(j).isVisible()) visibles++;
        }

        console.log("Iteracion " + i + " -> visibles: " + visibles + ", prev: " + prevVisibleCount);

        if (visibles === prevVisibleCount) {
          stableRounds++;
          console.log("Visibilidad estable (" + stableRounds + ")");

          if (stableRounds >= 2) {
            console.log("Completado: la lista dejo de crecer");
            break;
          }
        } else {
          console.log("Cambio detectado (visibles: " + visibles + "), reseteando...");
          stableRounds = 0;
        }

        prevVisibleCount = visibles;
        await page.waitForTimeout(350);
      }
    }

    const hayMensajeNoResultados = modo === "legacy"
      ? await this._hayLegacySinResultados(page, productos)
      : await page
        .locator(productos.sinresultadosLabel)
        .isVisible()
        .catch(() => false);

    if (hayMensajeNoResultados) {
      console.log("El sistema muestra sin resultados. Los " + visibles + " visibles son sugerencias.");
      return false;
    }

    console.log("Conteo estabilizado: " + visibles + " productos visibles reales.");
    return true;

  }


  if (modo !== "legacy") {
    const cTitle = await page.locator('[data-test="result-title"]').count().catch(() => 0);
    const cVtexCard = await page.locator('article[class*="vtex-product-summary-2-x-element"]').count().catch(() => 0);
    const cGrid = await page.locator('ul[data-test="base-grid"]').count().catch(() => 0);
    const cHost = await page.locator('div.x-base-teleport.x-base-teleport--onlychild').count().catch(() => 0);
    console.log("DEBUG empathy sin resultados -> result-title=" + cTitle + ", vtex-cards=" + cVtexCard + ", base-grid=" + cGrid + ", teleport-hosts=" + cHost);
  }
  console.log(' No se encontraron resultados');
  return false;
}

    async detectarCorreccion(page, correccionEsperada = "") {
    console.log("Se ingresa a detectar correccion");
    let correccion = "";
    let corregido = false;
    let hayCorreccion = false;
    const locatorUsado = '[data-test="spellcheck-message"] button[data-test="set-spellcheck"]';
    const t0 = Date.now();

    try {
      const btn = page.locator(locatorUsado).first();
      // Si no aparece en corto, asumimos que no hubo sugerencia (evita sumar segundos al run).
      await btn.waitFor({ state: "visible", timeout: 800 }).catch(() => {});
      if (await btn.count().catch(() => 0) > 0) {
        correccion = await btn.innerText().catch(() => "");
      }

      correccion = (correccion || "").toString().trim();

      // La correccion puede venir separada por comas: todos sus tokens deben aparecer.
      const esperados = Array.isArray(correccionEsperada)
        ? correccionEsperada.map(x => this._normalizarComparacion(x)).filter(x => x.length > 0)
        : String(correccionEsperada || "")
          .split(",")
          .map(x => this._normalizarComparacion(x))
          .filter(x => x.length > 0);
      const real = this._normalizarComparacion(correccion);
      hayCorreccion = real.length > 0;

      // Si no se pasa esperado, mantenemos compatibilidad: "corregido" = "hay correccion".
      if (esperados.length > 0) {
        corregido = hayCorreccion && esperados.every(esperado => real.includes(esperado));
      } else {
        corregido = hayCorreccion;
      }

      console.log("detectarCorreccion -> locator elegido: A");
      console.log(`detectarCorreccion -> locator usado: ${locatorUsado}`);
      console.log(`detectarCorreccion -> hayCorreccion: ${hayCorreccion}`);
      console.log(`detectarCorreccion -> corregido: ${corregido}`);
      console.log(`detectarCorreccion -> ms: ${Date.now() - t0}`);

    } catch (e) {
      correccion = "";
      corregido = false;
      hayCorreccion = false;
      console.log("detectarCorreccion -> locator elegido: A (error)");
      console.log(`detectarCorreccion -> locator usado: ${locatorUsado}`);
      console.log("detectarCorreccion -> hayCorreccion: false");
      console.log("detectarCorreccion -> corregido: false");
      console.log("detectarCorreccion -> error: " + (e && e.message ? e.message : String(e)));
    }

    return { correccion, corregido, hayCorreccion };
  }
async evaluarBusquedaErroresOrtograficos(page, productos, Correccion, equivalencias) {

  console.log("=== DEBUG INICIO evaluarBusquedaErroresOrtograficos ===");
  console.log("Correccion recibido:", Correccion, "tipo:", typeof Correccion);
  console.log("Equivalencias recibido:", equivalencias);
  const normalizar = (valor) => this._normalizarComparacion(valor);


  // === 1. DETECTAR CORRECCIN EMPATHY ===
  const { correccion: correccionReal, corregido, hayCorreccion } = await this.detectarCorreccion(page, Correccion);

  console.log("=== DEBUG detectarCorreccion() ===");
  console.log("Correccin real detectada:", correccionReal);
  console.log("Hubo sugerencia?", hayCorreccion);
  console.log("Correccin esperada?", corregido);


  // === Normalizar textos ===
  const correccionEsperada = typeof Correccion === "string"
    ? this._normalizarComparacion(Correccion)
    : this._normalizarComparacion(Correccion);

// === Normalizar equivalencias ===
let equivalenciasArr = [];

if (typeof equivalencias === "string") {
  // caso normal: string separado por comas
  equivalenciasArr = equivalencias
    .split(",")
    .map(e => this._normalizarComparacion(e));
}

else if (Array.isArray(equivalencias)) {
  // ya vena en array
  equivalenciasArr = equivalencias
    .map(e => this._normalizarComparacion(e));
}

else if (equivalencias != null) {
  // vena un objeto, nmero, booleano, lo que sea -> convertir a string
  equivalenciasArr = [this._normalizarComparacion(equivalencias)];
}

console.log("equivalenciasArr normalizado:", equivalenciasArr);

  console.log("=== DEBUG normalizacin ===");
  console.log("correccionEsperada:", correccionEsperada);
  console.log("equivalenciasArr:", equivalenciasArr);


  // === 2. ESPERAR RESULTADOS VISIBLES ===
  const resultadosLocator = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);

  console.log("=== DEBUG esperando resultados ===");
  console.log("Selector utilizado:", `${productos.resultadobusquedaLabel} >> visible=true`);

  await resultadosLocator.first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  const count = await resultadosLocator.count();

  console.log("=== DEBUG resultados encontrados ===");
  console.log("Cantidad de productos:", count);


  // === Variables a retornar ===
  let CC = 0;
  let CP = 0;
  let SR = false;
  let SN = false;

  let coincidencias = [];
  let noCoincidencias = [];
  let listaDetallada = [];


  // === 4. ANALIZAR CADA PRODUCTO ===

  async function obtenerTextoConReintento(locator) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        let txt = await locator.textContent({ timeout: 500 });
        if (txt && txt.trim().length > 0) {
          return normalizar(txt);
        }
      } catch {}

      console.log(`Reintento para leer texto (${intento + 1}/3)...`);
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  for (let i = 0; i < count; i++) {

    console.log(`=== DEBUG leyendo producto #${i} ===`);

    let textoProducto = await obtenerTextoConReintento(resultadosLocator.nth(i));

    console.log("Texto ledo:", textoProducto);

    if (!textoProducto) {
      listaDetallada.push({ texto: "[NO LEDO]", coincide: false });
      noCoincidencias.push("[NO LEDO]");
      continue;
    }

    const tieneCorreccion = correccionEsperada && textoProducto.includes(correccionEsperada);
    const tieneEquivalencia = equivalenciasArr.some(eq => textoProducto.includes(eq));

    console.log("Tiene correccin esperada?", tieneCorreccion);
    console.log("Tiene equivalencia?", tieneEquivalencia);


    if (tieneCorreccion) CC++;
    if (tieneEquivalencia) CP++;

    const coincide = tieneCorreccion || tieneEquivalencia;

    if (coincide) coincidencias.push(textoProducto);
    else noCoincidencias.push(textoProducto);

    listaDetallada.push({ texto: textoProducto, coincide });
  }


  // === 5. CALCULAR SR y SN ===
  console.log("=== DEBUG clculo SR / SN ===");
  console.log("corregido:", corregido);
  console.log("count:", count);

  if (!corregido && count > 0) SR = true;
  if (corregido && count === 0) SN = true;

  console.log("SR:", SR);
  console.log("SN:", SN);


  // === 6. RETORNAR TODO ===

  console.log("=== DEBUG FINAL ===");
  console.log("CC:", CC, "CP:", CP);
  console.log("coincidencias:", coincidencias);
  console.log("noCoincidencias:", noCoincidencias);
  console.log("listaDetallada:", listaDetallada);

  return {
    correccion: correccionReal,
    corregido,
    CC,
    CP,
    SR,
    SN,
    coincidencias,
    noCoincidencias,
    listaDetallada
  };
}
async obtenerProductosEncontrados(page, productosPage, modo = "empathy", maxResultados = 24) {

  const textos = [];
  const locator = modo === "legacy"
    ? this._legacyProductCards(page)
    : this._empathyProductCards(page);

  // Espera corta para no impactar el runtime.
  await locator.first().waitFor({ state: "visible", timeout: modo === "legacy" ? 5000 : 2500 }).catch(() => {});

  let countRaw = 0;
  if (modo === "legacy") {
    let prevCount = -1;
    let stableRounds = 0;
    const legacyTargetCount = Math.min(maxResultados, 20);

    for (let i = 0; i < 18; i++) {
      countRaw = await locator.count().catch(() => 0);
      console.log("Legacy lectura iteracion " + i + " -> productos: " + countRaw + ", prev: " + prevCount);

      if (countRaw === prevCount) {
        stableRounds++;
        if (countRaw >= legacyTargetCount && stableRounds >= 1) break;
        if (stableRounds >= 5) break;
      } else {
        stableRounds = 0;
      }

      prevCount = countRaw;
      await page.evaluate((iteracion) => {
        const gallery = document.querySelector("#gallery-layout-container");
        if (gallery) gallery.scrollIntoView({ block: iteracion % 2 === 0 ? "start" : "end" });
        window.scrollBy(0, 900);
      }, i).catch(() => {});
      await page.mouse.wheel(0, 900).catch(() => {});
      await page.waitForTimeout(800);
    }
  } else {
    countRaw = await locator.count().catch(() => 0);
  }

  const limite = modo === "legacy" ? maxResultados : Math.min(maxResultados, 20);
  const count = Math.min(countRaw, limite);

  for (let i = 0; i < count; i++) {
    try {
      let txt = "";
      if (modo === "legacy") {
        txt = await this._leerTituloLegacyCard(locator.nth(i));
      } else {
        txt = await this._leerTituloEmpathyCard(locator.nth(i));
      }
      if (txt && txt.trim().length > 0) textos.push(txt.trim());
    } catch (e) {
      console.warn("No se pudo leer un producto:", e);
    }
  }
  return textos;
}

  _splitTokens(valor) {
    if (valor === null || valor === undefined) return [];
    const s = String(valor).trim();
    if (!s) return [];
    return s.split(",").map(x => this._normalizarComparacion(x)).filter(x => x.length > 0);
  }

  _contieneAlguno(texto, tokens) {
    if (!texto) return false;
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    const t = this._normalizarComparacion(texto);
    return tokens.some(tok => tok && t.includes(tok));
  }

  _contieneTodos(texto, tokens) {
    if (!texto) return false;
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    const t = this._normalizarComparacion(texto);
    return tokens.every(tok => tok && t.includes(tok));
  }

  _contieneGrupoCategoria(texto, valor) {
    if (!texto || valor === null || valor === undefined) return false;
    const grupos = String(valor)
      .split("|")
      .map(grupo => this._splitTokens(grupo))
      .filter(tokens => tokens.length > 0);

    return grupos.some(tokens => this._contieneTodos(texto, tokens));
  }

  _contieneGrupoAndOr(texto, valor) {
    if (!texto || valor === null || valor === undefined) return false;
    const grupos = String(valor)
      .split("|")
      .map(grupo => this._splitTokens(grupo))
      .filter(tokens => tokens.length > 0);

    return grupos.some(tokens => this._contieneTodos(texto, tokens));
  }

  evaluarFrecuenciaAlta(productosEncontrados, categoriaYAttr, marca, attrSecundario, intencionDiferente) {
    const catTokens = this._splitTokens(categoriaYAttr);
    const marcaTokens = this._splitTokens(marca);
    const secTokens = this._splitTokens(attrSecundario);
    const intTokens = this._splitTokens(intencionDiferente);

    const detalles = [];
    const lista = Array.isArray(productosEncontrados) ? productosEncontrados : [];
    if (lista.length === 0) {
      return {
        detalles,
        calificacionPromedio: 0
      };
    }

    for (const titulo of lista) {
      const t = String(titulo || "");
      // Categoria (#1) debe cumplir TODOS los tokens (e.g. "leche, deslactosada").
      const c1 = this._contieneTodos(t, catTokens);
      const c2 = this._contieneAlguno(t, marcaTokens);
      const c3 = this._contieneAlguno(t, secTokens);
      const c4 = this._contieneAlguno(t, intTokens);

      let cal = 1;
      if (c1 && c2 && c3) {
        cal = 3;
      } else if (c1 && c2 && !c3) {
        cal = 2;
      } else if (!c1 && !c2 && !c3 && !c4) {
        cal = 0;
      }

      detalles.push({
        titulo: t,
        c1,
        c2,
        c3,
        c4,
        calificacion: cal
      });
    }

    const suma = detalles.reduce((acc, d) => acc + (d.calificacion || 0), 0);
    const prom = detalles.length > 0 ? (suma / detalles.length) : 0;
    const calificacionPromedio = Math.round(prom * 100) / 100;

    return {
      detalles,
      calificacionPromedio
    };
  }

  evaluarFrecuenciaAltaEquivalencias(productosEncontrados, termino, equivalencia, relacionados) {
    const terminoLower = this._normalizarComparacion(termino);

    const detalles = [];
    const lista = Array.isArray(productosEncontrados) ? productosEncontrados : [];
    if (lista.length === 0) {
      return {
        detalles,
        calificacionPromedio: 0
      };
    }

    for (const titulo of lista) {
      const t = String(titulo || "");
      // Frecuencia Alta: "|" funciona como OR y "," como AND dentro de cada grupo.
      // Regla: 2 puntos si contiene un grupo de equivalencia, o si coincide con el termino buscado.
      const tLower = this._normalizarComparacion(t);
      const eq = this._contieneGrupoAndOr(tLower, equivalencia) || (terminoLower.length > 0 && tLower.includes(terminoLower));
      // Solo evaluamos relacionados si equivalencia es false.
      const rel = !eq && this._contieneGrupoAndOr(tLower, relacionados);

      const cal = eq ? 2 : (rel ? 1 : 0);

      detalles.push({
        titulo: t,
        equivalencia: eq,
        relacionado: rel,
        calificacion: cal
      });
    }

    const suma = detalles.reduce((acc, d) => acc + (d.calificacion || 0), 0);
    const prom = detalles.length > 0 ? (suma / detalles.length) : 0;
    const calificacionPromedio = Math.round(prom * 100) / 100;

    return {
      detalles,
      calificacionPromedio
    };
  }

  evaluarBusquedaErroresOrtograficosDesdeSnapshot(snapshot = {}, modo = "empathy") {
    const normalizar = (valor) => this._normalizarComparacion(valor);
    const correccionEsperadaArr = Array.isArray(snapshot.correccionEsperada)
      ? snapshot.correccionEsperada.map(x => normalizar(x)).filter(x => x.length > 0)
      : String(snapshot.correccionEsperada || "")
        .split(",")
        .map(x => normalizar(x))
        .filter(x => x.length > 0);

    const equivalenciasArr = Array.isArray(snapshot.equivalencias)
      ? snapshot.equivalencias.map(x => normalizar(x)).filter(x => x.length > 0)
      : String(snapshot.equivalencias || "")
        .split(",")
        .map(x => normalizar(x))
        .filter(x => x.length > 0);

    const productos = Array.isArray(snapshot.productos) ? snapshot.productos.slice(0, 20) : [];
    const correccionReal = String(snapshot.correccionMostrada || snapshot.correccion || "").trim();
    const correccionRealNormalizada = normalizar(correccionReal);
    const corregido = modo !== "legacy" &&
      correccionEsperadaArr.length > 0 &&
      correccionRealNormalizada.length > 0 &&
      correccionEsperadaArr.every(token => correccionRealNormalizada.includes(token));

    let ccProductos = 0;
    let cpProductos = 0;
    const coincidencias = [];
    const noCoincidencias = [];
    const listaDetallada = [];

    for (const producto of productos) {
      const textoProducto = normalizar(producto);
      if (!textoProducto) {
        listaDetallada.push({ texto: "[NO LEIDO]", correccion: false, equivalencia: false, coincide: false });
        noCoincidencias.push("[NO LEIDO]");
        continue;
      }

      const tieneCorreccion = correccionEsperadaArr.length > 0 &&
        correccionEsperadaArr.every(token => textoProducto.includes(token));
      const tieneEquivalencia = equivalenciasArr.length > 0 &&
        equivalenciasArr.some(eq => textoProducto.includes(eq));
      const coincide = tieneCorreccion || tieneEquivalencia;

      if (tieneCorreccion) ccProductos++;
      if (tieneEquivalencia) cpProductos++;
      if (coincide) coincidencias.push(textoProducto);
      else noCoincidencias.push(textoProducto);

      listaDetallada.push({ texto: textoProducto, correccion: tieneCorreccion, equivalencia: tieneEquivalencia, coincide });
    }

    const totalProductos = productos.length;
    const allCorreccion = totalProductos > 0 && ccProductos === totalProductos;
    const anyCorreccion = ccProductos > 0;
    const anyEquivalencia = cpProductos > 0;

    let CC = false;
    let CP = false;
    let SR = false;
    let SN = false;
    let calificacion = "";

    if (totalProductos === 0) {
      SN = true;
      calificacion = "SN";
    } else if (modo === "legacy") {
      if (anyCorreccion) {
        CP = true;
        calificacion = "CP";
      } else if (anyEquivalencia) {
        SR = true;
        calificacion = "SR";
      } else {
        SN = true;
        calificacion = "SN";
      }
    } else if (corregido) {
      if (allCorreccion) {
        CC = true;
        calificacion = "CC";
      } else if (anyCorreccion || anyEquivalencia) {
        CP = true;
        calificacion = "CP";
      } else {
        SN = true;
        calificacion = "SN";
      }
    } else if (anyEquivalencia) {
      SR = true;
      calificacion = "SR";
    } else {
      SN = true;
      calificacion = "SN";
    }

    return {
      correccion: correccionReal,
      corregido,
      CC,
      CP,
      SR,
      SN,
      coincidencias,
      noCoincidencias,
      listaDetallada,
      calificacion,
      totalProductos,
      ccProductos,
      cpProductos
    };
  }

  evaluarLongTail(productosEncontrados, categoria, marca, especificacion, formato, intencion) {
    const marcaTokens = this._splitTokens(marca);
    const espTokens = this._splitTokens(especificacion);
    const formatoTokens = this._splitTokens(formato);
    const intTokens = this._splitTokens(intencion);

    const detalles = [];
    const lista = Array.isArray(productosEncontrados) ? productosEncontrados : [];
    if (lista.length === 0) {
      return {
        detalles,
        calificacionPromedio: 0
      };
    }

    for (const titulo of lista) {
      const t = String(titulo || "");
      const c1 = this._contieneGrupoCategoria(t, categoria); // Categoria: "|" OR, "," AND.
      const c2 = this._contieneAlguno(t, marcaTokens);    // Marca
      const c3 = this._contieneAlguno(t, espTokens);      // Especificacion
      const c4 = this._contieneAlguno(t, formatoTokens);  // Formato
      const c5 = this._contieneAlguno(t, intTokens);      // Intencion

      let cal = 0;
      if (c1 && c2 && c3 && c4) {
        cal = 5;
      } else if (c1 && c2 && c3 && !c4) {
        cal = 4;
      } else if (c1 && c2 && !c3 && !c4) {
        cal = 3;
      } else if (c1 && !c2 && !c3) {
        cal = 2;
      } else if (!c1 && !c2 && !c3 && !c4 && c5) {
        cal = 1;
      } else if (!c1 && !c2 && !c3 && !c4 && !c5) {
        cal = 0;
      } else {
        // Combos no contemplados: asignamos el mejor nivel que aplique por jerarquia.
        if (c1 && c2) cal = 3;
        else if (c1) cal = 2;
        else if (c5) cal = 1;
        else cal = 0;
      }

      detalles.push({
        titulo: t,
        c1,
        c2,
        c3,
        c4,
        c5,
        calificacion: cal
      });
    }

    const suma = detalles.reduce((acc, d) => acc + (d.calificacion || 0), 0);
    const prom = detalles.length > 0 ? (suma / detalles.length) : 0;
    const calificacionPromedio = Math.round(prom * 100) / 100;

    return {
      detalles,
      calificacionPromedio
    };
  }

  /**
   *  Vaciar carrito (reutilizable)
   */
  async vaciarCarrito(page, resumencarritos, headerPage) {
    console.log(" Ejecutando vaciarCarrito() ...");

    const vaciarButton = page.locator(resumencarritos.vaciarcarritoButton);
    const cerrarMiniCart = async () => {
      // When the drawer is closed, the close icon can exist but be off-viewport.
      // Prefer Escape as a universal close, but try the button first.
      try {
        await headerPage.safeClick(headerPage.cerrarminicartButton);
        return;
      } catch (e) {
        try {
          await page.locator(headerPage.cerrarminicartButton).first().click({ timeout: 2000, force: true });
          return;
        } catch {
          // ignore
        }
      }

      // Fallback: selector definido en el POM de ResumenCarritoPage (por si el del Header cambia).
      try {
        await resumencarritos.safeClick(resumencarritos.cerrarminicartButton);
        return;
      } catch (e) {
        try {
          await page.locator(resumencarritos.cerrarminicartButton).first().click({ timeout: 2000, force: true });
          return;
        } catch {
          // ignore
        }
      }

      try {
        await page.keyboard.press("Escape");
      } catch {
        // ignore
      }
    };
 
    if (await vaciarButton.count() > 0) {
      console.log(" Vaciando el carrito...");

      await resumencarritos.safeClick(resumencarritos.vaciarcarritoButton);
      await page.waitForTimeout(2000);
      await resumencarritos.safeClick(resumencarritos.eliminarItemsCarritoButton);
      await page.waitForTimeout(2000);
 
      // Cerrar minicart
      await cerrarMiniCart();
      
    } else {
      console.log(" El carrito ya estaba vacio.");
      await cerrarMiniCart();
      
    }
  }

  async AgregarProductosDefault(page, headerPage, productos, config, cantidadAgregar) {

  await page.goto(config.urls.PROD);

  const listaProductos = [
    'Aguacate Hass por Kg',  // 1
    'Pltano Chiapas por Kg', // 2
    'Cebolla Blanca por kg',  // 3
    'Zanahoria por kg',       // 4
    'Ajo por Kg'              // 5
  ];

  let productosAgregados = 0;

  for (const producto of listaProductos) {
    console.warn(`Se ingres al for, producto actual: ` + producto);

    if (productosAgregados >= cantidadAgregar) break;
    console.warn(`Se ingres al if productosAgregados`);

    try {
      console.warn(`Se intenta agregar producto: ${producto}`);
      const exito = await this.buscarYAgregarProducto(page, headerPage, productos, producto);
      if (exito) {
        productosAgregados++;
        console.log(` Producto agregado: ${producto} (total agregados: ${productosAgregados})`);

      }
    } catch (err) {
      console.warn(` No se pudo agregar producto: ${producto} -> ${err.message}`);
    }

    await page.goto(config.urls.PROD);
    await page.waitForTimeout(500);

  }
}



async ValidarFormulario(page, headerPage, tiposdepago, formapago) {
  await page.waitForTimeout(2000);
  console.warn("Validando formulario de: " + tiposdepago);

  const esPaypal = formapago.includes("Paypal") || tiposdepago.includes("PayPal") || tiposdepago.includes("Paypal");

  if (esPaypal) {
    const locator = page.locator(headerPage.formapago(tiposdepago));
    await locator.scrollIntoViewIfNeeded();
    await headerPage.safeClick(headerPage.formapago(tiposdepago));

    console.warn("Tipo de formulario detectado:\n" + formapago);
    console.warn("PayPal no muestra formulario; se valida apertura desde boton Pagar");

    const pagarBtn = page.locator(headerPage.pagar_Button).first();
    await pagarBtn.waitFor({ state: "visible", timeout: 5000 });
    await headerPage.safeClick(headerPage.pagar_Button);

    await page.locator(headerPage.paypalModal)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => console.warn(" No se encontro modal de PayPal"));

    await page.locator(headerPage.pagarconpaypalButton)
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => console.warn(" No se encontro boton Pagar con PayPal"));

    const cerrarPaypalModal = page.locator(headerPage.cerrarmodalButton).first();
    if (await cerrarPaypalModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cerrarPaypalModal.click();
    }

    console.log("\n Validacin finalizada para: " + formapago);
    return;
  }

  // 1 Determinar contexto (iframe o page)
  let iframe;
  let ctx; //  contexto unificado

  if (tiposdepago === "Vales de Colaborador Chedraui") {
    const locator = page.locator(headerPage.formapago(tiposdepago));
    await locator.scrollIntoViewIfNeeded();
    await headerPage.safeClick(headerPage.formapago(tiposdepago));
    ctx = page; //  Vales NO usa iframe
    console.warn("Tipo de formulario detectado:\n" + tiposdepago);
  } else {    
    const locator = page.locator(headerPage.iframeformapago(tiposdepago));
    await locator.scrollIntoViewIfNeeded();
    iframe = page.frameLocator(headerPage.iframeformapago(tiposdepago));
    ctx = iframe; //  Tarjetas usan iframe
    console.warn("Tipo de formulario detectado:\n" + formapago);
    console.warn("Iframe localizado:\n" + headerPage.iframeformapago(tiposdepago));
  }

  // 2 Definir campos a validar
  let campos = [];

  if (formapago.includes("Tarjeta")) {
    campos = [
      headerPage.tarjeta_numeroInput,
      headerPage.tarjeta_mesesapagarSelect,
      headerPage.tarjeta_nombreInput,
      headerPage.tarjeta_mesSelect,
      headerPage.tarjeta_anoSelect,
      headerPage.tarjeta_codigoInput
    ];
  } else if (formapago.includes("Vales")) {
    campos = [
      headerPage.tarjetachedrahui_numeroInput,
      headerPage.tarjetachedrahui_montoInput,
      headerPage.tarjetachedrahui_codigoInput
    ];
  }

  // 3 Validar existencia de campos
  for (const campo of campos) {
    console.warn("   Validando existencia del campo: " + campo);

    await ctx.locator(campo)
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => console.warn(" No se encontr"));
  }
  await page.pause();
  // 4 Validar botones segn tipo de pago
  console.warn("\n Validando botn pagar fuera del frame");
  const pagarBtn = page.locator(headerPage.pagar_Button);

  if (formapago.includes("Vales")) {
    const validarValeBtn = page.locator(headerPage.tarjetachedrahui_validarButton);

    await validarValeBtn.waitFor({ state: 'visible', timeout: 5000 });

    const validarHabilitado = await validarValeBtn.isEnabled();
    const pagarHabilitado = await pagarBtn.isEnabled();

    if (!validarHabilitado) {
      console.warn("Validar mi Saldo correctamente inhabilitado");
    } else {
      console.warn(" Validar mi Saldo habilitado con campos vacos");
    }

    if (!pagarHabilitado) {
      console.warn("Pagar correctamente inhabilitado");
    } else {
      console.warn(" Pagar habilitado con vales vacos");
    }

  } else {
    await pagarBtn
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => console.warn(" No se encontr"));

    await headerPage.safeClick(headerPage.pagar_Button);

    // 5 Validar mensajes obligatorios
    console.warn("\n Validando mensajes de campo obligatorio...");

    for (const campo of campos) {
      const validacion = campo + headerPage.validacioncampoobligatorio_Label;

      if (campo !== headerPage.tarjeta_mesesapagarSelect) {
        try {
          await ctx.locator(validacion).waitFor({
            state: "visible",
            timeout: 2000
          });
          console.log("   Mensaje obligatorio OK para: " + campo);
        } catch {
          console.warn("   No apareci mensaje obligatorio para: " + campo);
        }
      } else {
        console.warn("   No es necesario validar campo meses a pagar porque siempre est capturado");
      }
    }
  }

  console.log("\n Validacin finalizada para: " + formapago);
}

  async salircheckout(resumencarritos,page) {
    await resumencarritos.safeClick(resumencarritos.logoprincipal);
    await page.waitForLoadState('domcontentloaded');
  }

  normalizarSku(valorSku) {
    return String(valorSku || "").trim().split("-")[0].trim();
  }

  convertirPrecioANumero(textoPrecio) {
    const valorLimpio = String(textoPrecio || "")
      .replace(/[^0-9.,-]/g, "")
      .replace(/,/g, "");

    const precio = Number(valorLimpio);
    if (!Number.isFinite(precio)) {
      throw new Error("No fue posible convertir precio a numero: " + textoPrecio);
    }

    return precio;
  }

  normalizarPreciosEsperados(preciosEsperadosPorSku) {
    if (Array.isArray(preciosEsperadosPorSku)) {
      return preciosEsperadosPorSku.map(item => ({
        sku: this.normalizarSku(item.sku || item.SKU || item.id || item.ID),
        precioEsperado: this.convertirPrecioANumero(item.precioEsperado || item.precio || item.price || item.expectedPrice)
      }));
    }

    return Object.entries(preciosEsperadosPorSku || {}).map(([sku, precioEsperado]) => ({
      sku: this.normalizarSku(sku),
      precioEsperado: this.convertirPrecioANumero(precioEsperado)
    }));
  }

  async obtenerPreciosPaso3PorSku(page, resumencarritos) {
    const productosPaso3 = page.locator(resumencarritos.checkoutPaso3Producto);
    await productosPaso3.first().waitFor({ state: "visible", timeout: 10000 });

    const totalProductos = await productosPaso3.count();
    const preciosPorSku = [];

    for (let indiceProducto = 0; indiceProducto < totalProductos; indiceProducto++) {
      const producto = productosPaso3.nth(indiceProducto);
      const sku = await producto.getAttribute("data-id");
      const precioTexto = await producto.locator(resumencarritos.checkoutPaso3PrecioProducto).innerText();

      preciosPorSku.push({
        sku: this.normalizarSku(sku),
        precioTexto: precioTexto.trim(),
        precio: this.convertirPrecioANumero(precioTexto)
      });
    }

    return preciosPorSku;
  }

  async validarPreciosPaso3PorSku(page, resumencarritos, preciosEsperadosPorSku, tolerancia = 0.01) {
    const preciosEsperados = this.normalizarPreciosEsperados(preciosEsperadosPorSku);
    const preciosActuales = await this.obtenerPreciosPaso3PorSku(page, resumencarritos);

    if (preciosEsperados.length === 0) {
      throw new Error("No se recibieron precios esperados para validar en paso 3.");
    }

    for (const esperado of preciosEsperados) {
      const actual = preciosActuales.find(item => item.sku === esperado.sku);

      if (!actual) {
        throw new Error("No se encontro SKU en paso 3: " + esperado.sku);
      }

      const diferencia = Math.abs(actual.precio - esperado.precioEsperado);
      if (diferencia > tolerancia) {
        throw new Error(
          "Precio incorrecto para SKU " + esperado.sku +
          ". Esperado: " + esperado.precioEsperado +
          ", actual: " + actual.precio +
          " (" + actual.precioTexto + ")"
        );
      }

      console.log("Precio correcto para SKU " + esperado.sku + ": " + actual.precioTexto);
    }

    return preciosActuales;
  }

  async obtenerResumenPaso3(page, resumencarritos) {
    const leerPrecio = async (selector, etiqueta) => {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 10000 });
      const texto = (await locator.innerText()).trim();

      return {
        texto,
        valor: this.convertirPrecioANumero(texto),
        etiqueta
      };
    };

    const subtotal = await leerPrecio(resumencarritos.checkoutPaso3SubtotalProductos, "subtotal productos");
    const envio = await leerPrecio(resumencarritos.checkoutPaso3CostoEnvio, "costo envio");
    const total = await leerPrecio(resumencarritos.checkoutPaso3TotalCarrito, "total carrito");

    return {
      subtotalProductos: subtotal.valor,
      subtotalProductosTexto: subtotal.texto,
      costoEnvio: envio.valor,
      costoEnvioTexto: envio.texto,
      totalCarrito: total.valor,
      totalCarritoTexto: total.texto
    };
  }

  async validarResumenPaso3(page, resumencarritos, resumenEsperado, tolerancia = 0.01) {
    const resumenActual = await this.obtenerResumenPaso3(page, resumencarritos);
    const campos = [
      { key: "subtotalProductos", aliases: ["subtotalProductos", "subtotal", "Subtotal"] },
      { key: "costoEnvio", aliases: ["costoEnvio", "envio", "Envio"] },
      { key: "totalCarrito", aliases: ["totalCarrito", "total", "Total"] }
    ];

    for (const campo of campos) {
      const alias = campo.aliases.find(nombre => resumenEsperado[nombre] !== undefined && resumenEsperado[nombre] !== "");
      if (!alias) continue;

      const esperado = this.convertirPrecioANumero(resumenEsperado[alias]);
      const actual = resumenActual[campo.key];
      const diferencia = Math.abs(actual - esperado);

      if (diferencia > tolerancia) {
        throw new Error(
          "Monto incorrecto en paso 3 para " + campo.key +
          ". Esperado: " + esperado +
          ", actual: " + actual
        );
      }

      console.log("Monto correcto en paso 3 para " + campo.key + ": " + actual);
    }

    return resumenActual;
  }

  async obtenerResumenPaso4(page, resumencarritos) {
    const leerPrecio = async (selector) => {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 10000 });
      const texto = (await locator.innerText()).trim();

      return {
        texto,
        valor: this.convertirPrecioANumero(texto)
      };
    };

    const subtotal = await leerPrecio(resumencarritos.checkoutPaso4Subtotal);
    const envio = await leerPrecio(resumencarritos.checkoutPaso4Envio);
    const total = await leerPrecio(resumencarritos.checkoutPaso4Total);
    const envioPaqueteVisible = await page
      .locator(resumencarritos.checkoutPaso4EnvioPaquete)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const envioPaquete = envioPaqueteVisible
      ? await leerPrecio(resumencarritos.checkoutPaso4EnvioPaquete)
      : null;

    return {
      subtotal: subtotal.valor,
      subtotalTexto: subtotal.texto,
      envio: envio.valor,
      envioTexto: envio.texto,
      total: total.valor,
      totalTexto: total.texto,
      envioPaquete: envioPaquete ? envioPaquete.valor : null,
      envioPaqueteTexto: envioPaquete ? envioPaquete.texto : ""
    };
  }

  async validarResumenPaso4(page, resumencarritos, resumenEsperado, tolerancia = 0.01) {
    const resumenActual = await this.obtenerResumenPaso4(page, resumencarritos);
    const campos = [
      { key: "subtotal", aliases: ["subtotal", "Subtotal"] },
      { key: "envio", aliases: ["envio", "Envio", "costoEnvio"] },
      { key: "total", aliases: ["total", "Total"] },
      { key: "envioPaquete", aliases: ["envioPaquete", "EnvioPaquete"] }
    ];

    for (const campo of campos) {
      const alias = campo.aliases.find(nombre => resumenEsperado[nombre] !== undefined && resumenEsperado[nombre] !== "");
      if (!alias) continue;

      const esperado = this.convertirPrecioANumero(resumenEsperado[alias]);
      const actual = resumenActual[campo.key];
      if (actual === null || actual === undefined) {
        throw new Error("No se encontro monto en paso 4 para " + campo.key);
      }

      const diferencia = Math.abs(actual - esperado);
      if (diferencia > tolerancia) {
        throw new Error(
          "Monto incorrecto en paso 4 para " + campo.key +
          ". Esperado: " + esperado +
          ", actual: " + actual
        );
      }

      console.log("Monto correcto en paso 4 para " + campo.key + ": " + actual);
    }

    return resumenActual;
  }

async ValidarEntregas(page, headerPage, TipoTienda, Sucursal) { 
    console.warn(" Iniciando validacin de bloques de entrega...");

    // Normalizar tipos esperados
    const tiposEsperados = Array.isArray(TipoTienda) 
        ? TipoTienda.map(t => t.trim().toLowerCase())
        : TipoTienda.split(",").map(t => t.trim().toLowerCase());

    console.warn("Tipos esperados:", tiposEsperados);

    // Obtener bloques del DOM
    const entregas = page.locator("//*[@class='chedrauimx-checkout-io-2-x-package__delivery']");
    const count = await entregas.count();
    console.warn(`Bloques encontrados en pantalla: ${count}`);
    // 1 Validar nmero de bloques - REGLA CRTICA
    if (count !== tiposEsperados.length) {
        throw new Error(` Se esperaban ${tiposEsperados.length} bloques pero solo hay ${count}`);
    }

    // 2 Guardar textos
    const textosLower = [];
    for (let i = 0; i < count; i++) {
        const raw = (await entregas.nth(i).innerText()).trim();
        textosLower.push(raw.toLowerCase());
        console.warn(`\n Bloque ${i+1}:\n${raw}`);
    }

    const sucursalLower = Sucursal.toLowerCase().trim();

    // 3 Validacin por cada tipo, sin importar orden
    for (const tipo of tiposEsperados) {

        if (tipo === "super") {
            const match = textosLower.some(b =>
                b.includes("entregado por entrega domicilio") &&
                b.includes(sucursalLower)
            );
            if (!match) throw new Error(` Falta bloque SUPER para sucursal ${Sucursal}`);
            console.warn(" SUPER encontrado correctamente.");
        }

        else if (tipo === "flete") {
            const match = textosLower.some(b => b.includes("flete"));
            if (!match) throw new Error(` Falta bloque FLETE`);
            console.warn(" FLETE encontrado correctamente.");
        }

        else if (tipo === "dhl") {
            const match = textosLower.some(b => b.includes("dhl"));
            if (!match) throw new Error(` Falta bloque DHL`);
            console.warn(" DHL encontrado correctamente.");
        }

        else {
            console.warn(` Tipo desconocido: ${tipo}`);
        }
    }

    console.warn("\n Validacin COMPLETADA con xito.");
}

async crearDatosPago(row) {
    const tipo = row["Forma Pago"]; 

    if (tipo.includes("Tarjeta")) {
    return {
      numero: row["NumeroTarjeta"],
      nombre: row["Nombre"],
      mes: row["Mes"],
      ano: row["Ano"],
      cvv: row["Codigo"],
      formapago: row['Forma Pago']
    };
  }

  if (tipo.includes("Vales")) {
    return {
      monto: row["Monto"],
      numero: row["NumeroTarjeta"],
      cvv: row["Codigo"],
      formapago: row['Forma Pago']

    };
  }

   if (tipo.includes("Paypal")) {
    return {
      correo: row["Nombre"],
      password: row["Codigo"],
      formapago: row['Forma Pago']
    };
  }

  throw new Error("Tipo de pago no soportado: " + tipo);

}

  // Sobrescribe la version anterior para manejar empathy/legacy
  async evaluarBusquedaErroresOrtograficos(page, productos, Correccion, equivalencias, modo = "empathy") {

    console.log("=== DEBUG INICIO evaluarBusquedaErroresOrtograficos ===");
    console.log("Correccion recibido:", Correccion, "tipo:", typeof Correccion);
    console.log("Equivalencias recibido:", equivalencias);

    let correccionReal = "";
    let corregido = false;
    let correccionEsperadaArr = [];
    if (Array.isArray(Correccion)) {
      correccionEsperadaArr = Correccion
        .map(x => this._normalizarComparacion(x))
        .filter(x => x.length > 0);
    } else if (typeof Correccion === "string") {
      correccionEsperadaArr = Correccion
        .split(",")
        .map(x => this._normalizarComparacion(x))
        .filter(x => x.length > 0);
    } else if (Correccion != null) {
      const val = this._normalizarComparacion(Correccion);
      if (val.length > 0) correccionEsperadaArr = [val];
    }
    const correccionEsperada = correccionEsperadaArr.join(", ");

    if (modo !== "legacy") {
      const det = await this.detectarCorreccion(page, correccionEsperadaArr);
      correccionReal = det.correccion;
      corregido = det.corregido;
    }

    console.log("=== DEBUG detectarCorreccion() ===");
    console.log("Correccion real detectada:", correccionReal);
    console.log("Hubo correccion?", corregido);

    let equivalenciasArr = [];
    if (typeof equivalencias === "string") {
      equivalenciasArr = equivalencias
        .split(",")
        .map(e => this._normalizarComparacion(e))
        .filter(e => e.length > 0);
    } else if (Array.isArray(equivalencias)) {
      equivalenciasArr = equivalencias
        .map(e => this._normalizarComparacion(e))
        .filter(e => e.length > 0);
    } else if (equivalencias != null) {
      const val = this._normalizarComparacion(equivalencias);
      if (val.length > 0) equivalenciasArr = [val];
    }

    console.log("equivalenciasArr normalizado:", equivalenciasArr);

    console.log("=== DEBUG normalizacion ===");
    console.log("correccionEsperada:", correccionEsperada);
    console.log("equivalenciasArr:", equivalenciasArr);

    let resultadosLocator;
    if (modo === "legacy") {
      resultadosLocator = this._legacyProductCards(page);
    } else {
      resultadosLocator = this._empathyProductCards(page);
    }

    console.log("=== DEBUG esperando resultados ===");
    console.log("Selector utilizado:", modo === "legacy" ? `legacy product cards` : `empathy product cards`);

    if (modo === "legacy" && await this._hayLegacySinResultados(page, productos)) {
      console.log("Legacy muestra sin resultados; se ignoran productos sugeridos/fallback.");
      return {
        correccion: correccionReal,
        corregido,
        CC: false,
        CP: false,
        SR: false,
        SN: true,
        coincidencias: [],
        noCoincidencias: [],
        listaDetallada: [],
        totalProductos: 0,
        calificacion: "SN"
      };
    }

    await resultadosLocator.first().waitFor({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    if (modo === "legacy" && await this._hayLegacySinResultados(page, productos)) {
      console.log("Legacy muestra sin resultados despues de esperar; se ignoran productos sugeridos/fallback.");
      return {
        correccion: correccionReal,
        corregido,
        CC: false,
        CP: false,
        SR: false,
        SN: true,
        coincidencias: [],
        noCoincidencias: [],
        listaDetallada: [],
        totalProductos: 0,
        calificacion: "SN"
      };
    }

    let count = await resultadosLocator.count();
    const sinResultadosIcon = await page
      .locator('//*[contains(@id,"Trazado")]')
      .first()
      .isVisible()
      .catch(() => false);

    if (sinResultadosIcon) {
      console.log("Sin resultados detectado por icono, forzando count = 0");
      count = 0;
    }

    const countDetectado = count;
    const limiteEvaluacion = Math.min(count, 20);

    // Para Empathy solo evaluamos hasta 20 items (aunque existan mas en pantalla).
    if (limiteEvaluacion !== countDetectado) {
      console.log("=== DEBUG resultados encontrados ===");
      console.log("Cantidad de productos detectados:", countDetectado);
      console.log("Cantidad de productos a evaluar:", limiteEvaluacion);
    } else {
      console.log("=== DEBUG resultados encontrados ===");
      console.log("Cantidad de productos:", limiteEvaluacion);
    }

    // Usamos el count ya limitado para el resto del flujo (loop / totalProductos / etc).
    count = limiteEvaluacion;

    let CC = false;
    let CP = false;
    let SR = false;
    let SN = false;
    let coincidencias = [];
    let noCoincidencias = [];
    let listaDetallada = [];
    let ccProductos = 0;
    let cpProductos = 0;
    const normalizar = (valor) => this._normalizarComparacion(valor);

    async function obtenerTextoConReintento(locator) {
      for (let intento = 0; intento < 3; intento++) {
        try {
          let txt = await locator.textContent({ timeout: 500 });
          if (txt && txt.trim().length > 0) {
            return normalizar(txt);
          }
        } catch {}

        console.log("Reintento para leer texto (" + (intento + 1) + "/3)...");
        await new Promise(r => setTimeout(r, 250));
      }
      return null;
    }

    for (let i = 0; i < count; i++) {
      console.log("=== DEBUG leyendo producto #" + i + " ===");
      let textoProducto = null;
      if (modo === "legacy") {
        const tituloLegacy = await this._leerTituloLegacyCard(resultadosLocator.nth(i));
        textoProducto = tituloLegacy ? normalizar(tituloLegacy) : null;
      } else {
        const tituloEmpathy = await this._leerTituloEmpathyCard(resultadosLocator.nth(i));
        textoProducto = tituloEmpathy ? normalizar(tituloEmpathy) : await obtenerTextoConReintento(resultadosLocator.nth(i));
      }

      console.log("Texto leido:", textoProducto);

      if (!textoProducto) {
        listaDetallada.push({ texto: "[NO LEIDO]", correccion: false, equivalencia: false, coincide: false });
        noCoincidencias.push("[NO LEIDO]");
        continue;
      }

      const tieneCorreccion = correccionEsperadaArr.length > 0 &&
        correccionEsperadaArr.every(token => textoProducto.includes(token));
      const tieneEquivalencia = equivalenciasArr.length > 0 && equivalenciasArr.some(eq => textoProducto.includes(eq));

      console.log("Tiene correccion esperada?", tieneCorreccion);
      console.log("Tiene equivalencia?", tieneEquivalencia);

      if (tieneCorreccion) ccProductos++;
      if (tieneEquivalencia) cpProductos++;

      const coincide = tieneCorreccion || tieneEquivalencia;

      if (coincide) coincidencias.push(textoProducto);
      else noCoincidencias.push(textoProducto);

      listaDetallada.push({ texto: textoProducto, correccion: tieneCorreccion, equivalencia: tieneEquivalencia, coincide });
    }

    const totalProductos = count;
    const allCorreccion = totalProductos > 0 && ccProductos === totalProductos;
    const anyCorreccion = ccProductos > 0;
    const anyEquivalencia = cpProductos > 0;
    let calificacion = "";

    if (totalProductos === 0) {
      SN = true;
      calificacion = "SN";
    } else if (modo === "legacy") {
      if (anyCorreccion) {
        CP = true;
        calificacion = "CP";
      } else if (anyEquivalencia) {
        SR = true;
        calificacion = "SR";
      } else {
        SN = true;
        calificacion = "SN";
      }
    } else {
      if (corregido) {
        if (allCorreccion) {
          CC = true;
          calificacion = "CC";
        } else if (!allCorreccion && anyCorreccion) {
          CP = true;
          calificacion = "CP";
        } else if (!allCorreccion && anyEquivalencia) {
          CP = true;
          calificacion = "CP";
        } else {
          SN = true;
          calificacion = "SN";
        }
      } else {
        if (anyEquivalencia) {
          SR = true;
          calificacion = "SR";
        } else {
          SN = true;
          calificacion = "SN";
        }
      }
    }

    console.log("=== DEBUG FINAL ===");
    console.log("CC:", CC, "CP:", CP, "SR:", SR, "SN:", SN);
    console.log("coincidencias:", coincidencias);
    console.log("noCoincidencias:", noCoincidencias);
    console.log("listaDetallada:", listaDetallada);

    return {
      correccion: correccionReal,
      corregido,
      CC,
      CP,
      SR,
      SN,
      coincidencias,
      noCoincidencias,
      listaDetallada,
      calificacion,
      totalProductos,
      ccProductos,
      cpProductos
    };
  }



async LlenarFormularioPago(page, headerPage, tipoPago, datos) { 
  console.warn(" Llenando formulario de pago para: " + tipoPago);
  console.warn("Datos recibidos:", datos);

  let ctx;
  // 1 Determinar contexto (iframe o no)
  if (datos.formapago.includes("Vales")) {
    //  Vales NO usan iframe
    ctx = page;
    console.warn(" Tipo de pago detectado: VALES");
    // Scroll al formulario
    await page.locator(headerPage.formapago(tipoPago)).scrollIntoViewIfNeeded();
    await headerPage.safeClick(headerPage.formapago(tipoPago));
    // 2 Llenado de campos Vales
    console.warn("Llenando campos");
    await headerPage.humanType(headerPage.tarjetachedrahui_montoInput,String(datos.monto));
    await headerPage.humanType(headerPage.tarjetachedrahui_codigoInput,String(datos.cvv));
    //let locator = page.locator(headerPage.tarjetachedrahui_numeroInput);
    //await locator.click({ force: true });
    //await locator.fill(datos.numero);
    await headerPage.humanType(headerPage.tarjetachedrahui_numeroInput,String(datos.numero));
    /*
    await locator.click();
    await locator.pressSequentially(String(datos.numero));
    */    
    await page.waitForTimeout(1000);
    await headerPage.safeClick(headerPage.tarjetachedrahui_validarButton);
    //Pagar
    await headerPage.safeClick(headerPage.pagar_Button);

    
  }
  if(datos.formapago.includes("Tarjeta")){
      //  Tarjetas, Puntos BBVA, Vales de Despensa -> usan iframe
      console.warn(" Tipo de pago detectado: TARJETA");
      await page.locator(headerPage.iframeformapago(tipoPago)).scrollIntoViewIfNeeded();
      const iframe = page.frameLocator(headerPage.iframeformapago(tipoPago));
      ctx = iframe;
      // 2 Llenado de campos dentro del iframe
      console.warn("Llenando campos");
      // Nmero tarjeta
      await ctx.locator(headerPage.tarjeta_numeroInput).fill(String(datos.numero));
      // Nombre
      await ctx.locator(headerPage.tarjeta_nombreInput).fill(String(datos.nombre));
      // Mes vencimiento
      await ctx.locator(headerPage.tarjeta_mesSelect).selectOption(String(datos.mes));
      // Ao vencimiento
      await ctx.locator(headerPage.tarjeta_anoSelect).selectOption(String(datos.ano));
      // CVV
      await ctx.locator(headerPage.tarjeta_codigoInput).fill(String(datos.cvv));
      // Pagar
      await headerPage.safeClick(headerPage.pagar_Button);
      await headerPage.safeClick(headerPage.cerrarpagonoprocesadoPopIp);
      
  }
  if(datos.formapago.includes("Paypal")){
      console.warn(" Tipo de pago detectado: PAYPAL");
      await page.waitForTimeout(2000);
      // Pagar
      await headerPage.safeClick(headerPage.pagar_Button);
      await page.waitForTimeout(2000);
      // Presionar pagarconpaypal popup
      await page.waitForSelector(headerPage.paypalIframe, { timeout: 15000 });
      const paypalframe = page.frameLocator(headerPage.paypalIframe);
      const [paypalPopup] = await Promise.all([
        page.waitForEvent('popup'),
        paypalframe.locator(headerPage.pagarconpaypalButton).click()
      ]);
      // Capturar correo
      await paypalPopup.locator(headerPage.emailpaypalInput).fill(String(datos.correo));
      // Presionar Sigueinte
      await paypalPopup.locator(headerPage.siguienteButton).click();
      /*
      // Seleccionar login por otra via
      await paypalPopup.locator(headerPage.loginotraviaLink).click();
      // Seleccionar login por password
      await paypalPopup.locator(headerPage.loginporpasswordLink).click();
      // Capturar password
      await paypalPopup.locator(headerPage.passwordInput).fill(String(datos.password));
      // Finalizar login paypal
      await paypalPopup.locator(headerPage.loginpaypalInput).click();
      */
      // Cerrar POP UP para detener flujo airframe
      await paypalPopup.close();

      // Busca un locator en todos los frames, recursivamente
      async function findInFrames(page, selector) {
          // Buscar en el frame principal
          if (await page.locator(selector).count() > 0) return page.locator(selector);

          // Buscar en iframes recursivamente
          for (const frame of page.frames()) {
              if (await frame.locator(selector).count() > 0) {
                  return frame.locator(selector);
              }
          }

          return null;
      }

      // USO:
      const unauthorizedButtonXPath = "//*[@class='btn btn-large payment-unauthorized-button']";

      // Buscar el botn dentro o fuera de iframes
      let unauthorizedButton = await findInFrames(page, unauthorizedButtonXPath);

      if (unauthorizedButton) {
          console.log(" Botn encontrado, intentando cerrarlo...");
          await unauthorizedButton.click();
          console.log(" Popup de compra fallida cerrado.");
      } else {
          console.warn(" No se encontr el popup de compra fallida en ningn iframe.");
      }


      
  }
  console.warn("Llenado de formulario COMPLETADO");

}



}

module.exports = NavegacionActions;
/*
 (await page.locator(selector).count() > 0) return page.locator(selector);

          // Buscar en iframes recursivamente
          for (const frame of page.frames()) {
              if (await frame.locator(selector).count() > 0) {
                  return frame.locator(selector);
              }
          }

          return null;
      }

      // USO:
      const unauthorizedButtonXPath = "//*[@class='btn btn-large payment-unauthorized-button']";

      // Buscar el botn dentro o fuera de iframes
      let unauthorizedButton = await findInFrames(page, unauthorizedButtonXPath);

      if (unauthorizedButton) {
          console.log(" Botn encontrado, intentando cerrarlo...");
          await unauthorizedButton.click();
          console.log(" Popup de compra fallida cerrado.");
      } else {
          console.warn(" No se encontr el popup de compra fallida en ningn iframe.");
      }


      
  }
  console.warn("Llenado de formulario COMPLETADO");

}



}

module.exports = NavegacionActions;
*/





