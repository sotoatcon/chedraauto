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
      console.warn(`⏳ Timeout esperando botón o label para producto: ${producto}`);
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

async detectarCorreccion(page) {
  let correccion = "";
  let corregido = false;

  try {
    const locator = page.locator(
      'div.x-base-teleport.x-base-teleport--onlychild >> shadow=button[data-test="set-spellcheck"]'
    );

    // Esperar máximo 1.5s por si NO aparece corrección
    await locator.first().waitFor({ timeout: 1500 });

    correccion = await locator.first().innerText();
    correccion = correccion?.trim() ?? "";

    if (correccion.length > 0) corregido = true;

  } catch {
    correccion = "";
    corregido = false;
  }

  return { correccion, corregido };
}
async evaluarBusquedaErroresOrtograficos(page, productos, Correccion, equivalencias) {

  // === 1. DETECTAR CORRECCIÓN EMPATHY ===
  const { correccion: correccionReal, corregido } = await detectarCorreccion(page);

  // Normalizar textos
  const correccionEsperada = Correccion?.toLowerCase().trim() || "";
  const equivalenciasArr = equivalencias
    ? equivalencias.split(",").map(e => e.trim().toLowerCase())
    : [];

  // === 2. ESPERAR RESULTADOS VISIBLES ===
  const resultadosLocator = page.locator(`${productos.resultadobusquedaLabel} >> visible=true`);
  await resultadosLocator.first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  const count = await resultadosLocator.count();

  // === 3. VARIABLES A RETORNAR ===
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
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  for (let i = 0; i < count; i++) {
    let textoProducto = await obtenerTextoConReintento(resultadosLocator.nth(i));

    if (!textoProducto) {
      listaDetallada.push({ texto: "[NO LEÍDO]", coincide: false });
      noCoincidencias.push("[NO LEÍDO]");
      continue;
    }

    const tieneCorreccion = correccionEsperada && textoProducto.includes(correccionEsperada);
    const tieneEquivalencia = equivalenciasArr.some(eq => textoProducto.includes(eq));

    if (tieneCorreccion) CC++;
    if (tieneEquivalencia) CP++;

    const coincide = tieneCorreccion || tieneEquivalencia;

    if (coincide) coincidencias.push(textoProducto);
    else noCoincidencias.push(textoProducto);

    listaDetallada.push({ texto: textoProducto, coincide });
  }

  // === 5. CALCULAR SR y SN ===
  if (!corregido && count > 0) SR = true;
  if (corregido && count === 0) SN = true;

  // === 6. RETORNAR TODO — 🔥 NOMBRES ARREGLADOS ===

  return {
    correccion: correccionReal, // ← NOMBRE CORREGIDO
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
      await page.waitForTimeout(2000);
      await resumencarritos.safeClick(resumencarritos.eliminarItemsCarritoButton);
      await page.waitForTimeout(2000);
 
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

    // Normalizar tipos esperados
    const tiposEsperados = Array.isArray(TipoTienda) 
        ? TipoTienda.map(t => t.trim().toLowerCase())
        : TipoTienda.split(",").map(t => t.trim().toLowerCase());

    console.warn("Tipos esperados:", tiposEsperados);

    // Obtener bloques del DOM
    const entregas = page.locator("//*[@class='chedrauimx-checkout-io-2-x-package__delivery']");
    const count = await entregas.count();
    console.warn(`Bloques encontrados en pantalla: ${count}`);
    // 1️⃣ Validar número de bloques – REGLA CRÍTICA
    if (count !== tiposEsperados.length) {
        throw new Error(`❌ Se esperaban ${tiposEsperados.length} bloques pero solo hay ${count}`);
    }

    // 2️⃣ Guardar textos
    const textosLower = [];
    for (let i = 0; i < count; i++) {
        const raw = (await entregas.nth(i).innerText()).trim();
        textosLower.push(raw.toLowerCase());
        console.warn(`\n📦 Bloque ${i+1}:\n${raw}`);
    }

    const sucursalLower = Sucursal.toLowerCase().trim();

    // 3️⃣ Validación por cada tipo, sin importar orden
    for (const tipo of tiposEsperados) {

        if (tipo === "super") {
            const match = textosLower.some(b =>
                b.includes("entregado por entrega domicilio") &&
                b.includes(sucursalLower)
            );
            if (!match) throw new Error(`❌ Falta bloque SUPER para sucursal ${Sucursal}`);
            console.warn("✔ SUPER encontrado correctamente.");
        }

        else if (tipo === "flete") {
            const match = textosLower.some(b => b.includes("flete"));
            if (!match) throw new Error(`❌ Falta bloque FLETE`);
            console.warn("✔ FLETE encontrado correctamente.");
        }

        else if (tipo === "dhl") {
            const match = textosLower.some(b => b.includes("dhl"));
            if (!match) throw new Error(`❌ Falta bloque DHL`);
            console.warn("✔ DHL encontrado correctamente.");
        }

        else {
            console.warn(`⚠ Tipo desconocido: ${tipo}`);
        }
    }

    console.warn("\n🟢 Validación COMPLETADA con éxito.");
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



async LlenarFormularioPago(page, headerPage, tipoPago, datos) { 
  console.warn("📝 Llenando formulario de pago para: " + tipoPago);
  console.warn("Datos recibidos:", datos);

  let ctx;
  // 1️⃣ Determinar contexto (iframe o no)
  if (datos.formapago.includes("Vales")) {
    // 🔹 Vales NO usan iframe
    ctx = page;
    console.warn("📌 Tipo de pago detectado: VALES");
    // Scroll al formulario
    await page.locator(headerPage.formapago(tipoPago)).scrollIntoViewIfNeeded();
    await headerPage.safeClick(headerPage.formapago(tipoPago));
    // 2️⃣ Llenado de campos Vales
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
      // 🔹 Tarjetas, Puntos BBVA, Vales de Despensa → usan iframe
      console.warn("📌 Tipo de pago detectado: TARJETA");
      await page.locator(headerPage.iframeformapago(tipoPago)).scrollIntoViewIfNeeded();
      const iframe = page.frameLocator(headerPage.iframeformapago(tipoPago));
      ctx = iframe;
      // 2️⃣ Llenado de campos dentro del iframe
      console.warn("Llenando campos");
      // Número tarjeta
      await ctx.locator(headerPage.tarjeta_numeroInput).fill(String(datos.numero));
      // Nombre
      await ctx.locator(headerPage.tarjeta_nombreInput).fill(String(datos.nombre));
      // Mes vencimiento
      await ctx.locator(headerPage.tarjeta_mesSelect).selectOption(String(datos.mes));
      // Año vencimiento
      await ctx.locator(headerPage.tarjeta_anoSelect).selectOption(String(datos.ano));
      // CVV
      await ctx.locator(headerPage.tarjeta_codigoInput).fill(String(datos.cvv));
      // Pagar
      await headerPage.safeClick(headerPage.pagar_Button);
      await headerPage.safeClick(headerPage.cerrarpagonoprocesadoPopIp);
      
  }
  if(datos.formapago.includes("Paypal")){
      console.warn("📌 Tipo de pago detectado: PAYPAL");
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

      // Buscar el botón dentro o fuera de iframes
      let unauthorizedButton = await findInFrames(page, unauthorizedButtonXPath);

      if (unauthorizedButton) {
          console.log("✔️ Botón encontrado, intentando cerrarlo...");
          await unauthorizedButton.click();
          console.log("✔️ Popup de compra fallida cerrado.");
      } else {
          console.warn("⚠️ No se encontró el popup de compra fallida en ningún iframe.");
      }


      
  }
  console.warn("Llenado de formulario COMPLETADO");

}



}

module.exports = NavegacionActions;
