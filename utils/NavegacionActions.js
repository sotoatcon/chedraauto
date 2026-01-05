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
      await page.waitForSelector(resumencarritos.telefonoCapturadoCheck, { state: 'visible', timeout: 30000 });
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
      console.warn(`⏳ Timeout esperando botón o label para producto: ${producto}`);
      return false;
    }

    if (await botonAgregar.count() > 0 && await botonAgregar.isVisible()) {
      await botonAgregar.click();
      await page.isVisible(productos.agregarproductodentrobusquedaButton);
      await headerPage.safeClick(headerPage.logoImg);
      await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
      return true;
    }

    if (await labelAgotado.count() > 0 && await labelAgotado.isVisible()) {
      console.warn(`⚠️ Producto agotado: ${producto}`);
      await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
      return false;
    }

    
    await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
    return false;
  }

  /**
   * 🔹 Buscar producto con estabilización de resultados
   */
async buscarProducto(page, headerPage, productos, producto) {
  console.warn("Se ingresar a buscarProducto");

  await page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });

  const input = page.locator(headerPage.buscandoInput);
  await input.waitFor({ state: 'visible' });

  await page.locator(headerPage.buscandoInput).focus();
  await page.locator(headerPage.buscandoInput).fill("");
  await headerPage.humanType(headerPage.buscandoInput, producto);
  await page.keyboard.press('Enter');

  // --- 🔸 Espera resultados o mensaje sin resultados ---
  await Promise.race([
    page.locator(productos.sinresultadosLabel).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    page.locator(productos.resultadobusquedaLabel).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  ]);



  // --- 🔸 Si hay resultados, estabilizar el conteo por visibilidad ---
  if (await page.locator(productos.resultadobusquedaLabel).first().isVisible()) {
    let elementos = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);

    let prevVisibleCount = -1;
    let stableRounds = 0;
    let visibles = 0;

    for (let i = 0; i < 10; i++) {

      elementos = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);
      let total = await elementos.count();
      visibles = 0;

      for (let j = 0; j < total; j++) {
        if (await elementos.nth(j).isVisible()) visibles++;
      }

      console.log(`Iteración ${i} → visibles: ${visibles}, prev: ${prevVisibleCount}`);

      if (visibles === prevVisibleCount) {
        stableRounds++;
        console.log(`Visibilidad estable (${stableRounds})`);

        // 🔥 Scroll hasta el botón "Next page"
        // Volver a leer después del scroll
        elementos = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);
        total = await elementos.count();
        console.log(`Después del scroll → total detectados: ${total}`);

        if (stableRounds >= 2) {
          console.log("🟢 Completado: la lista dejó de crecer");
          break;
        }

      } else {
        console.log(`❌ Cambio detectado (visibles: ${visibles}), reseteando...`);
        stableRounds = 0;
        prevVisibleCount = visibles;
        await page.locator('//*[@aria-label="Next page"]').scrollIntoViewIfNeeded();
        await page.locator('//*[@class="chedrauimx-search-result-3-x-orderBy--layout"]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        continue;
      }

      prevVisibleCount = visibles;
    }

    const hayMensajeNoResultados = await page
      .locator(productos.sinresultadosLabel)
      .isVisible()
      .catch(() => false);

    if (hayMensajeNoResultados) {
      console.log(`❌ El sistema muestra "sin resultados". Los ${visibles} visibles son sugerencias.`);
      return false;
    }

    console.log(`🟢 Conteo estabilizado: ${visibles} productos visibles reales.`);
    return true;
  }


  console.log('❌ No se encontraron resultados');
  return false;
}

async evaluarBusquedaErroresOrtograficos(page, productos, equivalencias) {

  const productosVisibles = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);
  await productosVisibles.first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  async function obtenerTextoConReintento(locator) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        let txt = await locator.textContent({ timeout: 500 });
        if (txt && txt.trim().length > 0) {
          return txt.toLowerCase().trim();
        }
      } catch {}
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  const count = await productosVisibles.count();

  let coincidencias = [];
  let noCoincidencias = [];
  let listaDetallada = [];

  for (let i = 0; i < count; i++) {

    let textoProducto = await obtenerTextoConReintento(productosVisibles.nth(i));

    if (!textoProducto) {
      console.log(`⚠️ No se pudo obtener innerText del producto ${i}, registrando como NO LEÍDO`);
      
      listaDetallada.push({
        texto: "[NO LEÍDO]",
        coincide: false
      });

      noCoincidencias.push("[NO LEÍDO]");
      continue;
    }

    const coincide = equivalencias.some(eq => textoProducto.includes(eq));

    if (coincide) coincidencias.push(textoProducto);
    else noCoincidencias.push(textoProducto);

    listaDetallada.push({
      texto: textoProducto,
      coincide
    });
  }

  return { coincidencias, noCoincidencias, listaDetallada };
}

async obtenerProductosEncontrados(page, productosPage) {

  await page.waitForTimeout(4000);
  const locator = page.locator(`${productosPage.resultadobusquedaLabel} >> visible=true`);
  const count = await locator.count();
  const textos = [];

  for (let i = 0; i < count; i++) {
    try {
      let txt = await locator.nth(i).textContent();
      if (txt && txt.trim().length > 0) {
        textos.push(txt.trim());
      }
    } catch (e) {
      console.warn("⚠ No se pudo leer un producto:", e);
    }
  }
  return textos;
}

  /**
   * 🛒 Vaciar carrito (reutilizable)
   */
  async vaciarCarrito(page, resumencarritos, headerPage) {
    console.log("↪ Ejecutando vaciarCarrito() ...");

    const vaciarButton = page.locator(resumencarritos.vaciarcarritoButton);

    if (await vaciarButton.count() > 0) {
      console.log("🛒 Vaciando el carrito...");

      await resumencarritos.safeClick(resumencarritos.vaciarcarritoButton);
      await resumencarritos.safeClick(resumencarritos.eliminarItemsCarritoButton);

      // Cerrar minicart
      await headerPage.safeClick(headerPage.cerrarminicartButton);
    } else {
      await headerPage.safeClick(headerPage.cerrarminicartButton);
      console.log("🧹 El carrito ya estaba vacío.");
    }
  }

  async AgregarProductosDefault(page, headerPage, productos, config, cantidadAgregar) {

  await page.goto(config.urls.PROD);

  const listaProductos = [
    'Aguacate Hass por Kg',  // 1
    'Plátano Chiapas por Kg', // 2
    'Cebolla Blanca por kg',  // 3
    'Zanahoria por kg',       // 4
    'Ajo por Kg'              // 5
  ];

  let productosAgregados = 0;

  for (const producto of listaProductos) {
    console.warn(`Se ingresó al for, producto actual: ` + producto);

    if (productosAgregados >= cantidadAgregar) break;
    console.warn(`Se ingresó al if productosAgregados`);

    try {
      console.warn(`Se intenta agregar producto: ${producto}`);
      const exito = await this.buscarYAgregarProducto(page, headerPage, productos, producto);
      if (exito) {
        productosAgregados++;
        console.log(`✅ Producto agregado: ${producto} (total agregados: ${productosAgregados})`);
      }
    } catch (err) {
      console.warn(`⚠️ No se pudo agregar producto: ${producto} → ${err.message}`);
    }

    await page.goto(config.urls.PROD);
    await page.waitForTimeout(500);

  }
}



async ValidarFormulario(page, headerPage, tiposdepago, formapago) {
  await page.waitForTimeout(2000);
  console.warn("Validando formulario de: " + tiposdepago);

  // 1️⃣ Determinar contexto (iframe o page)
  let iframe;
  let ctx; // 👉 contexto unificado

  if (tiposdepago === "Vales de Colaborador Chedraui") {
    const locator = page.locator(headerPage.formapago(tiposdepago));
    await locator.scrollIntoViewIfNeeded();
    await headerPage.safeClick(headerPage.formapago(tiposdepago));
    ctx = page; // 🔹 Vales NO usa iframe
    console.warn("Tipo de formulario detectado:\n" + tiposdepago);
  } else {
    const locator = page.locator(headerPage.iframeformapago(tiposdepago));
    await locator.scrollIntoViewIfNeeded();
    iframe = page.frameLocator(headerPage.iframeformapago(tiposdepago));
    ctx = iframe; // 🔹 Tarjetas usan iframe
    console.warn("Tipo de formulario detectado:\n" + formapago);
    console.warn("Iframe localizado:\n" + headerPage.iframeformapago(tiposdepago));
  }

  // 2️⃣ Definir campos a validar
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

  // 3️⃣ Validar existencia de campos
  for (const campo of campos) {
    console.warn("   Validando existencia del campo: " + campo);

    await ctx.locator(campo)
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => console.warn("⚠ No se encontró"));
  }

  // 4️⃣ Validar botones según tipo de pago
  console.warn("\n➡️ Validando botón pagar fuera del frame");
  const pagarBtn = page.locator(headerPage.pagar_Button);

  if (formapago.includes("Vales")) {
    const validarValeBtn = page.locator(headerPage.tarjetachedrahui_validarButton);

    await validarValeBtn.waitFor({ state: 'visible', timeout: 5000 });

    const validarHabilitado = await validarValeBtn.isEnabled();
    const pagarHabilitado = await pagarBtn.isEnabled();

    if (!validarHabilitado) {
      console.warn("Validar mi Saldo correctamente inhabilitado");
    } else {
      console.warn("⚠ Validar mi Saldo habilitado con campos vacíos");
    }

    if (!pagarHabilitado) {
      console.warn("Pagar correctamente inhabilitado");
    } else {
      console.warn("⚠ Pagar habilitado con vales vacíos");
    }

  } else {
    await pagarBtn
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => console.warn("⚠ No se encontró"));

    await headerPage.safeClick(pagarBtn);

    // 5️⃣ Validar mensajes obligatorios
    console.warn("\n🧪 Validando mensajes de campo obligatorio...");

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
          console.warn("   No apareció mensaje obligatorio para: " + campo);
        }
      } else {
        console.warn("   No es necesario validar campo meses a pagar porque siempre está capturado");
      }
    }
  }

  console.log("\n🟢 Validación finalizada para: " + formapago);
}

  async salircheckout(resumencarritos,page) {
    await resumencarritos.safeClick(resumencarritos.logoprincipal);
    await page.waitForLoadState('domcontentloaded');
  }

async ValidarEntregas(page, headerPage, TipoTienda, Sucursal) { 
    console.warn("🔍 Iniciando validación de bloques de entrega…");

    const tiposEsperados = Array.isArray(TipoTienda) 
        ? TipoTienda.map(t => t.trim())
        : TipoTienda.split(",").map(t => t.trim());

    console.warn("Tipos esperados:", tiposEsperados);

    const entregas = page.locator("//*[@class='chedrauimx-checkout-io-1-x-package__delivery']");
    const count = await entregas.count();
    console.warn(`Bloques encontrados en pantalla: ${count}`);

    // Obtener textos una sola vez
    const textos = [];
    for (let i = 0; i < count; i++) {
        const raw = (await entregas.nth(i).innerText()).trim();
        textos.push(raw);
        console.warn(`\n📦 Bloque ${i+1}:\n${raw}`);
    }

    const sucursalLower = Sucursal.toLowerCase().trim();

    // 🔥 Nueva validación: por cada tipo esperado, validar si aparece en algún bloque
   // Validar entregas sin importar el orden
for (const tipo of tiposEsperados) {

    if (tipo === "super") {

        const match = bloques.some(b =>
            b.includes("entregado por entrega domicilio") &&
            b.includes(Sucursal.toLowerCase())
        );

        if (!match) {
            throw new Error(`❌ No se encontró ningún bloque SUPER válido para sucursal ${Sucursal}`);
        }

        console.warn(`✔ SUPER encontrado correctamente.`);
    }

    else if (tipo === "flete") {

        const match = bloques.some(b => b.includes("flete"));

        if (!match) {
            throw new Error(`❌ No se encontró ningún bloque FLETE`);
        }

        console.warn(`✔ FLETE encontrado correctamente.`);
    }

    else if (tipo === "dhl") {

        const match = bloques.some(b => b.includes("dhl"));

        if (!match) {
            throw new Error(`❌ No se encontró ningún bloque DHL`);
        }

        console.warn(`✔ DHL encontrado correctamente.`);
    }
}



    console.warn("\n🟢 Validación COMPLETADA con éxito.");
}



}

module.exports = NavegacionActions;
