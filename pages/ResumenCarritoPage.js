// pages/ResumenCarritoPage.js
const BasePage = require('./BasePage');

class ResumenCarritoPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    // 🔹 Locators estáticos
    this.prodcutoscarritos = "//*[contains(@class,'productMinicartContainer')]//*[@class='vtex-flex-layout-0-x-flexColChild pb0']//a[contains(text(),'')]";
    this.diasEntregaLabel = "//*[@class='chedrauimx-checkout-io-1-x-calendar__day-date']";
    this.paso1URL= "/checkout-io/cart";
    this.paso2URL= "/checkout-io/profile";
    this.paso3URL= "/checkout-io/shipping";
    this.paso4URL= "/checkout?checkout=io/#/payment";
    this.logoHref = "//*[@class='chedrauimx-checkout-io-1-x-header-io__containerHeader']//*[@href]";
    this.eliminarItemsCarritoButton = "//button[@class]//*[contains(text(),'Eliminar')]";
    this.verificaPedidoTab = "//*[@class='chedrauimx-checkout-io-1-x-timeline__label' and contains(text(),'Verifica tu pedido')]";
    this.completaTusDatosTab = "//*[@class='chedrauimx-checkout-io-1-x-timeline__step  chedrauimx-checkout-io-1-x-timeline__step ']//*[contains(text(),'Completa tus datos')]";
    this.programaEntregaActivoTab = "//*[contains(@class,'--active')]//*[contains(text(),'Programa tu entrega')]";
    this.vaciarcarritoButton = "//button[@class]//*[contains(text(),'Vaciar carrito')]";
    this.vaciarButton = "//button[@class='chedrauimx-checkout-io-1-x-alert--button-accept' and contains(text(),'Vaciar')]";
    this.comprarcarritoButton = "//*[contains(text(),'Comprar')]";
    // Cerrar minicart (fallback si se usa este POM directamente).
    this.cerrarminicartButton = "//*[contains(@class,'vtex-minicart-2-x-closeIconButton')]";
    this.codigodescuentoInput = "//*[@placeholder='Escribe el código']";
    this.codigodescuentoaplicarButton = "//button//*[contains(text(),'Aplicar')]";
    this.continuarconlacompraButton = "//button//*[contains(text(),'Continuar con la compra')]";
    this.iralpagoButton = "//button[contains(text(),'Ir al pago')]";
    this.vamosacomprarButton = "//*[contains(text(),'Vamos a comprar')]";
    this.diasentrega = "//*[@class='chedrauimx-checkout-io-2-x-calendar__day']";
    this.horarioentregaButton = "//*[@class='chedrauimx-checkout-io-2-x-calendar__day-schedule']";
    this.contactonombreInput = "//*[@id='firstName']";
    this.contactoapellidoInput = "//*[@id='lastName']";
    this.contactotelefonoInput = "//*[@id='phoneNumber']";
    this.editardatoscontactoButton = "//*[@href='/checkout-io/profile' and @title]";
    this.editarentregaButton = "//*[@href='/checkout-io/shipping' and @title]";
    this.pagarButton = "//*[@id='payment-data-submit' and contains(@data-bind,('isPaymentButtonVisible'))]";
    this.irenvioButton = "//*[@type='submit' and contains(text(),'Ir al Envío') and @form='profile-form']";
    this.sucursales = "//*[@class='chedrauimx-checkout-io-2-x-address-list-container__list-button']";
    this.aceptarCambioDireccionButton = "//*[@class='chedrauimx-checkout-io-1-x-alert--button-accept']";
    this.cambiarDireccionLink = "//*[contains(text(),'Selecciona otra dirección')]";
    this.confirmarCambiarDireccionButton = "//*[contains(text(),'Continuar')]";
    this.telefonoCapturadoCheck = "//*[@id='phoneNumber']/..//*[@class='chedrauimx-checkout-io-1-x-user-form__icon']";
    this.logoprincipal = "//*[@class='checkout-header__logo']";
    this.checkoutPaso3CantidadProductos = "//*[@class='chedrauimx-checkout-io-2-x-package__quantity']";
    this.checkoutPaso3Producto = "//*[@class='chedrauimx-checkout-io-2-x-package-product']";
    this.checkoutPaso3PrecioProducto = ".//*[@class='chedrauimx-checkout-io-2-x-price']";
    this.checkoutPaso3CostoEnvio = "//*[@class='chedrauimx-checkout-io-2-x-summary__item chedrauimx-checkout-io-2-x-summary__item--shipping']//*[@class='chedrauimx-checkout-io-2-x-price']";
    this.checkoutPaso3SubtotalProductos = "//*[@class='chedrauimx-checkout-io-2-x-summary__item chedrauimx-checkout-io-2-x-summary__item--items']//*[@class='chedrauimx-checkout-io-2-x-price']";
    this.checkoutPaso3TotalCarrito = "//*[@class='chedrauimx-checkout-io-2-x-summary-totalizers__totals']//*[@class='chedrauimx-checkout-io-2-x-price']";
    this.checkoutPaso4Subtotal = "//*[@class='itemTotalizer subTotalCustom']//*[@class='valueCustom']";
    this.checkoutPaso4Envio = "//*[@class='itemTotalizer shippingCostCustom']//*[@class='valueCustom']";
    this.checkoutPaso4Total = "//*[@class='itemTotalizer totalCustom']//*[@class='valueCustom']";
    this.checkoutPaso4EnvioPaquete = "//*[@class='total-package']//*[@class='shipping-value']";
  }

  // 🔹 Locators dinámicos
  diaenterga(num) {
    return `//*[@class='chedrauimx-checkout-io-1-x-calendar__day'][${num}]`;
  }

  formapagochedrahuiOption(formapago) {
    return `//*[@class='payment-group-item-name' and contains(text(),'${formapago}')]`;
  }

  productoespecificoOption(producto){
    return `//*[contains(@class,'productMinicartContainer')]//*[@class='vtex-flex-layout-0-x-flexColChild pb0']//a[contains(text(),'${producto}')]`;
  }

  checkoutPaso3ProductoPorSku(sku){
    return `//*[@class='chedrauimx-checkout-io-2-x-package-product' and @data-id='${sku}']`;
  }

  checkoutPaso3PrecioProductoPorSku(sku){
    return `${this.checkoutPaso3ProductoPorSku(sku)}//*[@class='chedrauimx-checkout-io-2-x-price']`;
  }


}

module.exports = ResumenCarritoPage;
