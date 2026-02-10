// pages/HeaderPage.js
const BasePage = require('./BasePage');

class HeaderPage extends BasePage {
  constructor(page) {
    super(page); // 🔹 Llama al constructor de BasePage


    //popup
    this.pagonoprocesadoPopUp ="//*[@class='payment-unauthorized-hello']";
    this.cerrarpagonoprocesadoPopIp = "//*[@class='btn btn-large payment-unauthorized-button']";
    //Paypal
    this.paypalIframe ="//iframe[contains(@name,'paypal') and @class='component-frame visible']";
    this.titulopaypalPopup ="//*[@class='paypalstore-payment-auth-app-1-x-logoSection']";
    this.pagarconpaypalButton ="//*[@class='paypal-button-label-container']";
    this.cerrarmodalButton ="//*[@class='paypalstore-payment-auth-app-1-x-closeModal']";
    this.aceptarCookiespaypalButton ="//*[@id='acceptAllButton']";
    this.emailpaypalInput ="//*[@id='email']";
    this.siguienteButton ="//*[@id='btnNext']";
    this.obtenercodigoButton = "//*[@type='submit']";
    this.securitycodeInput = "//*[@id='security_code']";
    this.loginotraviaLink = "//*[@class='tryAnotherWayLink ']//*[@href]";
    this.loginporpasswordLink = "//*[@id='loginWithPassword'";
    this.passwordInput = "//*[@id='password']";
    this.loginpaypalInput = "//*[@id='btnLogin']";
    // 🔹 Elementos del header
    this.repetircompraButton = "";
    this.mispedidosHref = "//*[@href='/account#/orders']";
    this.misdatosHref = "//*[@href='/account#/mis-datos']";
    this.misfavoritosHref = "//*[@href='/account#/favorites']";
    this.mislistasHref = "//*[@href='/account#/wishlist']";
    this.bannerSuperiorHref ="//*[contains(@class,'sliderItem--top-bar-slider')]//a[@title]";
    this.minicartButton = "//*[@href='#icon-minicart']";
    this.agregardireccionButton = "//*[@class='chedrauimx-locator-2-x-triggerAddress']"
    this.direccionButton = "//*[@class='chedrauimx-locator-2-x-triggerAddress']";
    this.ingresarButton = "//*[contains(text(),'Ingresar')]";
    this.principalHeader = "//*[@title='Envío gratis en la compra de productos de supermercado']";
    this.ayudaMessage = "//*[@data-testid='Icon--chat']";
    this.enviaraDiv = "//*[@class='chedrauimx-locator-2-x-triggerAddress']//p";
    this.buscandoInput = "//*[@placeholder='¿Qué estás buscando?']";
    this.micuentaButton = "//*[contains(@class,'header-top__login')]//button";
    this.logoImg = "//*[contains(@class,'header--logo')]//*[@href]";
    this.holaUser = "//*[contains(text(),'Hola,')]";
    this.cerrarminicartButton = "//*[@class=' vtex-minicart-2-x-closeIcon']"; 
    this.tarjeta_numeroInput = "//*[@id='creditCardpayment-card-0Number']";
    this.tarjeta_nombreInput = "//*[@id='creditCardpayment-card-0Name']";
    this.tarjeta_codigoInput = "//*[@id='creditCardpayment-card-0Code']";
    this.tarjeta_mesSelect = "//*[@id='creditCardpayment-card-0Month']";
    this.tarjeta_anoSelect = "//*[@id='creditCardpayment-card-0Year']";
    this.tarjeta_mesesapagarSelect = "//*[@id='creditCardpayment-card-0Brand']";
    this.tarjetachedrahui_codigoInput= "//*[contains(text(),'Código de seguridad')]/..//input";
    this.tarjetachedrahui_numeroInput = "//*[@id='card-number-vale']";
    this.tarjetachedrahui_montoInput = "//*[@id='amount-vale']";
    this.tarjetachedrahui_validarButton = "//*[@id='vales-confirm-button']";
    this.pagar_Button = "//*[@id='payment-data-submit'][2]";
    this.validacioncampoobligatorio_Label = "/..//*[contains(text(),'Este campo es obligatorio')]";
    this.pagorechazado_alert  = "//*[@class='btn btn-large payment-unauthorized-button']";
    this.enviadopor_span = "//*[@class='chedrauimx-checkout-io-1-x-package__delivery']";
    this.enviara_button = "//*[@class='chedrauimx-locator-2-x-labelTextAddress']";
    
  }

    formapago(formapago){
      return `//*[@class='payment-group-item-name' and contains(text(),'${formapago}')]`;
  }

    iframeformapago(formapago){
      return `//*[@class='payment-group-item-name' and contains(text(),'${formapago}')]/../../..//iframe`;
    }

    detalleorden(orden){
      return `//*[@href='#/orders/${orden}']//*[contains(text(),'Ver detalles del pedido')]`;
    }


}

module.exports = HeaderPage;
  