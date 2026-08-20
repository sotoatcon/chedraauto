// pages/DirectionsPage.js
const BasePage = require('./BasePage');
const config = require('../utils/Environment');

class DirectionsPage extends BasePage {
  constructor(page) {
    super(page); // 🔹 Llama al constructor de BasePage

    // 🔹 Elementos del header
    this.editardireccionButton ="//*[@class='chedrauimx-locator-2-x-btnEditAddress']";
    this.seleccionarDireccionButton ="//*[@class='chedrauimx-locator-2-x-selectAddress  chedrauimx-locator-2-x-selectAddress_active']";
    this.direccionpropuestabusquedaOption = "//*[contains(@class,'chedrauimx-locator-2-x-InputSelect__content_select_list_item_store_text')]";
    this.direccionbusquedaInput = "//*[contains(text(),'Encuentra tu dirección')]/../..//input";
    this.direccionsucursalInput = "//input[@placeholder='Ejemplo: Av. Miguel de Cervantes No. 397']"; 
    this.aliasotroButton = "//button//*[contains(text(),'Otro')]";
    this.aliasparejaButton ="//button//*[contains(text(),'Novi@')]";
    this.aliastrabajoButton ="//button//*[contains(text(),'Trabajo')]";
    this.aliascasaButton = "//button//*[contains(text(),'Casa')]";
    this.aliastextInput = "//input[@placeholder='Ingresa un alias para esta dirección']";
    this.guardardireccionButton = "//button//*[contains(text(),'Guardar dirección')]";
    this.enviarestadireccionButton = "//button//*[contains(text(),'Enviar a esta dirección')]";
    this.enviaraDiv = "//*[@class='chedrauimx-locator-2-x-triggerAddress']//p";
    this.seccionDireccionesButtonHeader =
      "//*[@class='ma0 chedrauimx-locator-2-x-locationTitle']" +
      " | //button[.//*[contains(normalize-space(.),'Enviar a:') or contains(normalize-space(.),'Recoger en:')]]" +
      " | //button[contains(normalize-space(.),'Enviar a:') or contains(normalize-space(.),'Recoger en:')]";
    this.recogerEnTab =
      "//button[contains(normalize-space(.),'Recoger en') or contains(normalize-space(.),'Recoger')]" +
      " | //*[@role='tab' and contains(normalize-space(.),'Recoger')]";
    this.recogerEnOpcion = "//*[@name='pickup-point-list']";
    this.recogerEnButton = "//*[contains(text(),'Recoger en esta tienda')]";

    
    }

    xpathDireccionEspecifica(direccion){
        return `//*[@class='flex flex-row items-center chedrauimx-locator-2-x-titleAddress']//*[contains(text(),'${direccion}')]`;
    }

    async modalDireccionAbierto() {
        const drawerVisible = await this.page
            .locator('//*[contains(@class,"modal-delivery") and (contains(@class,"opened") or @aria-hidden="false")]')
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);

        if (drawerVisible) return true;

        return await this.page
            .locator(this.recogerEnTab)
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);
    }

    async abrirModalDireccionSiNecesario() {
        if (await this.modalDireccionAbierto()) return;

        try {
            await this.safeClick(this.seccionDireccionesButtonHeader);
        } catch (error) {
            if (await this.modalDireccionAbierto()) return;

            console.warn("No se pudo abrir modal de direccion con safeClick, intentando click forzado.");
            await this.page
                .locator(this.seccionDireccionesButtonHeader)
                .first()
                .click({ timeout: 5000, force: true });
        }

        await this.page
            .locator(this.recogerEnTab)
            .first()
            .waitFor({ state: 'visible', timeout: 10000 })
            .catch(async () => {
                if (!(await this.modalDireccionAbierto())) {
                    throw new Error("No se abrio el modal de direccion.");
                }
            });
    }

    async SeleccionarDireccionEspecifica(direccion) {
        console.log(`\nSe inicia seleccion de direccion`);    
        const xpathdireccion = this.xpathDireccionEspecifica(direccion);
        console.log(`\nxpath es: `+ xpathdireccion);
        await this.page.locator(xpathdireccion).scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);
        await this.page.locator(xpathdireccion).click();
        console.log(`\nSe da clic en: `+ xpathdireccion);
        await this.page.click(this.enviarestadireccionButton);
        await this.page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
        await this.wait(3000); // breve espera por sugerencias


    }
    //SelecionarRecogerEspecifico
    async SeleccionarRecogerEspecifico() {
        console.log(`\nSe inicia recoger en`);  
        await this.page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 }).catch(() => {});
        await this.acceptCookiesIfPresent(6000);
        await this.page.waitForTimeout(500);
        await this.abrirModalDireccionSiNecesario();
        //await this.safeClick(this.enviaraDiv);
        await this.safeClick(this.recogerEnTab);
        await this.escribirSucursalYSeleccionarPrimeraOpcion();
        await this.page.waitForTimeout(500);
        await this.page.locator(this.recogerEnOpcion).first().click();
        await this.safeClick(this.recogerEnButton);
        await this.page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
        await this.wait(3000); // breve espera por sugerencias

    }

    async escribirSucursalYSeleccionarPrimeraOpcion() {
        const input = this.page.locator(this.direccionsucursalInput).first();
        const opcion = this.page.locator(this.direccionpropuestabusquedaOption).first();
        const direccion = config.SucursalaSeleccionar;

        for (let intento = 1; intento <= 2; intento++) {
            await input.waitFor({ state: 'visible', timeout: 15000 });
            await input.click({ timeout: 5000 }).catch(() => {});
            await input.fill('');
            await input.type(direccion, { delay: 15 });

            const visible = await opcion
                .waitFor({ state: 'visible', timeout: 15000 })
                .then(() => true)
                .catch(() => false);

            if (visible) {
                await opcion.click();
                return;
            }

            console.warn(`No aparecio sugerencia de sucursal en intento ${intento}. Reintentando...`);
            await this.safeClick(this.recogerEnTab);
            await this.page.waitForTimeout(750);
        }

        throw new Error(`No se encontro sugerencia para la sucursal configurada: ${direccion}`);
    }

    async agregarDireccion(nombre, direccion) {
    console.log(`📝 Iniciando registro de dirección: ${nombre} (${direccion})`);

    try {
        // 1️⃣ Escribir dirección en el campo de búsqueda
        await this.humanType(this.direccionbusquedaInput, direccion);
        await this.wait(2000); // breve espera por sugerencias

        // 2️⃣ Esperar a que aparezca la sugerencia y hacer clic
         // 2️⃣ Esperar a que aparezca la sugerencia y hacer clic en la primera
        await this.page.locator(this.direccionpropuestabusquedaOption).first().waitFor({ state: 'visible', timeout: 11000 });
        await this.page.locator(this.direccionpropuestabusquedaOption).first().click();
        await this.wait(2000);
        // 3️⃣ Seleccionar “Otro” como alias
        await this.safeClick(this.aliasotroButton);
        // 4️⃣ Llenar campo de alias con el nombre de la sucursal
        await this.humanType(this.aliastextInput, nombre);
        // 5️⃣ Guardar dirección
        await this.safeClick(this.guardardireccionButton);
        console.log(`✅ Dirección "${nombre}" guardada correctamente.`);
        // 6️⃣ Esperar a que vuelva a cargar la lista y reactivar botón principal
        await this.page.waitForSelector('iframe#launcher', { state: 'visible', timeout: 30000 });
        await this.safeClick(this.seleccionarDireccionButton);
        await this.page.waitForTimeout(2000);

    } catch (error) {
        console.error(`❌ Error al agregar dirección "${nombre}": ${error.message}`);
        throw error;
    }
}


    
}

module.exports = DirectionsPage;
  
