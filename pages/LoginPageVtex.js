// pages/LoginPageVtex.js
const BasePage = require('./BasePage');

class LoginPageVtex extends BasePage {
  constructor(page) {
    super(page);
    
    //confirmado
    this.emailInput = "//*[@id='email']";
    this.nextButton = "//*[@data-testid='request-email']//button";
    this.codigoInput =
      "//*[@data-testid='token-input']//input" +
      " | //label[contains(normalize-space(.),'Code')]/following::input[1]" +
      " | //input[contains(@name,'code') or contains(@id,'code') or contains(@autocomplete,'one-time-code')]" +
      " | //input[@type='text' and not(@id='email')]";
    this.loginButton =
      "//*[@data-testid='token-input']//ancestor::form//button" +
      " | //button[contains(normalize-space(.),'CONTINUE')]" +
      " | //button[contains(normalize-space(.),'Continue')]";
    this.invalidCodeLabel = "//*[contains(normalize-space(.),'Invalid code')]";
    this.resendCodeButton = "//*[self::button or self::a][contains(normalize-space(.),'Resend Code')]";
    this.codeVtex = "//*[contains(@style,'font-size:42px')]//strong";

    //godaddy

    this.password = "//*[@autocomplete='current-password']";
    }
  
  

  }

module.exports = LoginPageVtex;
