const { expect } = require('@playwright/test');

class NavegacionActions {
    
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

    const sugerido = await page.locator(productos.autocompletarbusqueda).first();
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
  const legacyResultadosLocator = page.locator('//*[@id="gallery-layout-container"]//*[contains(@class,"global__card--name") and contains(@class,"t-small")] >> visible=true');
  const resultadosLocator = modo === "legacy"
    ? legacyResultadosLocator
    : page.locator('[data-test="result-title"]');

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
      visibles = await elementos.count();
      console.log("Legacy: visibles directos = " + visibles);
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

    const hayMensajeNoResultados = await page
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
    const cGrid = await page.locator('ul[data-test="base-grid"]').count().catch(() => 0);
    const cHost = await page.locator('div.x-base-teleport.x-base-teleport--onlychild').count().catch(() => 0);
    console.log("DEBUG empathy sin resultados -> result-title=" + cTitle + ", base-grid=" + cGrid + ", teleport-hosts=" + cHost);
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

      // A veces llega como array: ["shampoo"].
      const esperadoBase = Array.isArray(correccionEsperada)
        ? (correccionEsperada[0] ?? "")
        : (correccionEsperada ?? "");

      const esperado = esperadoBase.toString().trim().toLowerCase();
      const real = correccion.toLowerCase();
      hayCorreccion = real.length > 0;

      // Si no se pasa esperado, mantenemos compatibilidad: "corregido" = "hay correccion".
      if (esperado.length > 0) {
        corregido = hayCorreccion && real === esperado;
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


  // === 1. DETECTAR CORRECCIN EMPATHY ===
  const { correccion: correccionReal, corregido, hayCorreccion } = await this.detectarCorreccion(page, Correccion);

  console.log("=== DEBUG detectarCorreccion() ===");
  console.log("Correccin real detectada:", correccionReal);
  console.log("Hubo sugerencia?", hayCorreccion);
  console.log("Correccin esperada?", corregido);


  // === Normalizar textos ===
  const correccionEsperada = typeof Correccion === "string"
    ? Correccion.toLowerCase().trim()
    : String(Correccion || "").toLowerCase().trim();

// === Normalizar equivalencias ===
let equivalenciasArr = [];

if (typeof equivalencias === "string") {
  // caso normal: string separado por comas
  equivalenciasArr = equivalencias
    .split(",")
    .map(e => e.trim().toLowerCase());
}

else if (Array.isArray(equivalencias)) {
  // ya vena en array
  equivalenciasArr = equivalencias
    .map(e => String(e).trim().toLowerCase());
}

else if (equivalencias != null) {
  // vena un objeto, nmero, booleano, lo que sea -> convertir a string
  equivalenciasArr = [String(equivalencias).trim().toLowerCase()];
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
          return txt.toLowerCase().trim();
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
    ? page.locator('//*[@id="gallery-layout-container"]//*[contains(@class,"global__card--name") and contains(@class,"t-small")] >> visible=true')
    : page.locator('[data-test="result-title"]');

  // Espera corta para no impactar el runtime.
  await locator.first().waitFor({ state: "visible", timeout: 2500 }).catch(() => {});

  const countRaw = await locator.count().catch(() => 0);
  const count = Math.min(countRaw, maxResultados);

  for (let i = 0; i < count; i++) {
    try {
      const txt = await locator.nth(i).innerText().catch(() => "");
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
    return s.split(",").map(x => x.trim().toLowerCase()).filter(x => x.length > 0);
  }

  _contieneAlguno(texto, tokens) {
    if (!texto) return false;
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    const t = String(texto).toLowerCase();
    return tokens.some(tok => tok && t.includes(tok));
  }

  _contieneTodos(texto, tokens) {
    if (!texto) return false;
    if (!Array.isArray(tokens) || tokens.length === 0) return false;
    const t = String(texto).toLowerCase();
    return tokens.every(tok => tok && t.includes(tok));
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

  evaluarLongTail(productosEncontrados, categoria, marca, especificacion, formato, intencion) {
    const catTokens = this._splitTokens(categoria);
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
      const c1 = this._contieneAlguno(t, catTokens);      // Categoria
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

    await headerPage.safeClick(pagarBtn);

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
    let correccionEsperada = "";
    if (Array.isArray(Correccion)) {
      correccionEsperada = Correccion.map(x => String(x).trim()).find(x => x.length > 0) || "";
    } else if (typeof Correccion === "string") {
      correccionEsperada = Correccion.trim();
    } else if (Correccion != null) {
      correccionEsperada = String(Correccion).trim();
    }
    correccionEsperada = correccionEsperada.toLowerCase();

    if (modo !== "legacy") {
      const det = await this.detectarCorreccion(page, correccionEsperada);
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
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
    } else if (Array.isArray(equivalencias)) {
      equivalenciasArr = equivalencias
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e.length > 0);
    } else if (equivalencias != null) {
      const val = String(equivalencias).trim().toLowerCase();
      if (val.length > 0) equivalenciasArr = [val];
    }

    console.log("equivalenciasArr normalizado:", equivalenciasArr);

    console.log("=== DEBUG normalizacion ===");
    console.log("correccionEsperada:", correccionEsperada);
    console.log("equivalenciasArr:", equivalenciasArr);

    let resultadosLocator;
    if (modo === "legacy") {
      resultadosLocator = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);
    } else {
      resultadosLocator = page.locator('[data-test="result-title"] >> visible=true');
    }

    console.log("=== DEBUG esperando resultados ===");
    console.log("Selector utilizado:", modo === "legacy" ? `${productos.resultadobusquedaLabel} >> visible=true` : `[data-test="result-title"]`);

    await resultadosLocator.first().waitFor({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

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

    console.log("=== DEBUG resultados encontrados ===");
    console.log("Cantidad de productos:", count);

    let CC = false;
    let CP = false;
    let SR = false;
    let SN = false;
    let coincidencias = [];
    let noCoincidencias = [];
    let listaDetallada = [];
    let ccProductos = 0;
    let cpProductos = 0;

    async function obtenerTextoConReintento(locator) {
      for (let intento = 0; intento < 3; intento++) {
        try {
          let txt = await locator.textContent({ timeout: 500 });
          if (txt && txt.trim().length > 0) {
            return txt.toLowerCase().trim();
          }
        } catch {}

        console.log("Reintento para leer texto (" + (intento + 1) + "/3)...");
        await new Promise(r => setTimeout(r, 250));
      }
      return null;
    }

    for (let i = 0; i < count; i++) {
      console.log("=== DEBUG leyendo producto #" + i + " ===");
      let textoProducto = await obtenerTextoConReintento(resultadosLocator.nth(i));

      console.log("Texto leido:", textoProducto);

      if (!textoProducto) {
        listaDetallada.push({ texto: "[NO LEIDO]", correccion: false, equivalencia: false, coincide: false });
        noCoincidencias.push("[NO LEIDO]");
        continue;
      }

      const tieneCorreccion = !!correccionEsperada && textoProducto.includes(correccionEsperada);
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
    const anyEquivalencia = cpProductos > 0;
    let calificacion = "";

    if (totalProductos === 0) {
      SN = true;
      calificacion = "SN";
    } else if (modo === "legacy") {
      calificacion = "";
    } else {
      if (corregido) {
        if (allCorreccion) {
          CC = true;
          calificacion = "CC";
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





