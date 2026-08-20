// pages/ProductosEncontradosPage.js
const BasePage = require('./BasePage');
const { expect } = require('@playwright/test');


class ProductosEncontradosPage extends BasePage {
  constructor(page) {
    super(page);
    this.page = page;

    // 🔹 Locators estáticos
    this.agregarproductodentrobusquedaButton = "//*[contains(@class,'chedrauiPlusButton')]";
    this.productoAgotadoButton = "//*[contains(text(),'Agotado') and contains(@class,'add-to-cart-pdp')]";
    this.borrarCampoBusquedaButton = "//*[@aria-label='Borrar campo de búsqueda']";
    this.orderporSelect = "//*[contains(@class,'orderByText')]";
    this.preciobusquedaLabel = "//*[@id='gallery-layout-container']/div[1]/section/a/article/div[4]/div/div[1]/span[1]";
    this.autocompletarbusqueda = "//*[@data-af-element='search-autocomplete']//span[contains(@class,'global__vitrina__h--name t-small')]";
    this.autocompletarAgregarButton = "//*[@data-af-element='search-autocomplete']//button[contains(@class,'chedrauimx-add-to-cart-button')]";
    this.agregarproductolateralButton = "//*[@class='sellerText']/../../../../../../../../..//*[@type='button' and contains(@class,'chedrauimx-add-to-cart')]";
    this.resultadobusquedaLabel = `//*[@class='vtex-product-summary-2-x-nameContainer vtex-product-summary-2-x-nameContainer--global__card--name flex items-start justify-center pv6']//*[contains(@class,'global__card--name t-small')]`;
    this.sinresultadosLabel = "//*[contains(@class,('search-result-not-found'))]//*[contains(text(),'¡Oh, no!')]";
    this.productoagregadoAlert = "//div[contains(text(),'agregado al carrito')]";
  }

  titulobusquedaLabel(producto){
    return `//*[contains(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${producto.toLowerCase()}') and contains(@class,'chedrauimx-search-result-3-x-galleryTitle--layout')]`;
  }

  // 🔹 Locators dinámicos
  agregarproductoacarritoButton(productname) {
    return `//*[contains(@class,'conditionalContainerTop')]/..//*[contains(@aria-label,'${productname}')]/../../..//*[@type='button' and contains(@class,'add-to-cart')]`;
  }

  agregarproductoafavoritosButton(productname) {
    return `//*[contains(@aria-label,'${productname}')]/..//*[contains(@class,'wishlistIconContainer')]//button`;
  }

  cantidadproductoagregadoButton(productname) {
    return `//*[contains(@aria-label,'${productname}')]//*[@inputmode="numeric"]`;
  }

  incrementarproductoButton(productname) {
    return `//*[contains(@aria-label,'${productname}')]//*[contains(@class,'chedrauiPlusButton')]`;
  }

  disminuirproductoButton(productname) {
    return `//*[contains(@aria-label,'${productname}')]//*[contains(@class,'chedrauiMinusButton')]`;
  }

  orderporOption(optionText) {
    return `//*[contains(@class,'orderBy')]//*[contains(text(),'${optionText}')]`;
  }

  filtrosbusquedaSpan(filtro) {
    return `//*[contains(@class,'filtersWrapper')]//*[contains(text(),'${filtro}')]`;
  }

  filtrobusquedaCheck(name) {
    return `//*[contains(@class,'checkbox__container')]//*[@name='${name}']`;
  }

  resultadobusquedaNameLabel(name){
    return `//*[contains(@class,'global__card--name t-small') and contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${name}')]`;
  }


}

module.exports = ProductosEncontradosPage;
