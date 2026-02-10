// pages/LoginPageVtex.js
const BasePage = require('./BasePage');

class LoginPageVtex extends BasePage {
  constructor(page) {
    super(page);
    
    //confirmado
    this.emailInput = "//*[@id='email']";
    this.nextButton = "//*[@data-testid='request-email']//button";
    this.codigoInput = "//*[@data-testid='token-input']//input";
    this.loginButton = "//*[@data-testid='token-input']//..//button";
    this.codeVtex = "//*[contains(@style,'font-size:42px')]//strong";

    //godaddy

    this.password = "//*[@autocomplete='current-password']";
    }
  
  

  }

module.exports = LoginPageVtex;
