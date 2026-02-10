const BasePage = require('./BasePage');

class HeaderPage extends BasePage {
  constructor(page) {
    super(page);

    this.orderidLabel = "//*[contains(@class,'orderId')]";
    this.detallepedidoButton = "//*[contains(@class,'detailsBtn')]";
    this.fechapedidoLabel = "//*[contains(@class,'orderHeaderLabel') and contains(text(),'Fecha del pedido')]/..//*[contains(@class,'orderHeaderValue ')]";
    this.totalpagadoLabel = "//*[contains(@class,'orderHeaderLabel') and contains(text(),'Total')]/..//*[contains(@class,'orderHeaderValue ')]";
    this.articulospedidosHref = "//*[contains(@class,'orderProduct ')]";     
    this.vertodosarticulosHref = "//*[contains(text(),'Ver todos los artículos')]";
}


  /*
  formapago(formapago){
      return `//*[@class='payment-group-item-name' and contains(text(),'${formapago}')]`;
  }
*/

}

module.exports = HeaderPage;
  