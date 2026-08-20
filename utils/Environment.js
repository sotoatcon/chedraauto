// utils/Environment.js
const ambiente = (process.env.TEST_ENV || 'PROD').trim().replace(/^\uFEFF/, '');
const headless = process.env.HEADLESS !== 'false';
const browserChannel = (process.env.BROWSER_CHANNEL || process.env.PW_CHANNEL || 'msedge').trim();
const otpProvider = (process.env.OTP_PROVIDER || process.env.OPT_PROVIDER || 'gmail').trim().toLowerCase();
// Si es true, los reportes que comparan Empathy vs Legacy solo correran Empathy.
// Default: false (puedes sobreescribir con ONLY_EMPATHY=true).
const OnlyEmpathy = String(process.env.ONLY_EMPATHY || 'false').trim().toLowerCase() === 'true';
// Si es true, no ejecuta navegador/login: regenera PDFs desde el ultimo JSON crudo guardado.
const OnlyReport = ['1', 'true', 'yes'].includes(String(process.env.ONLY_REPORT || process.env.ONLYREPORT || '0').trim().toLowerCase());

const isEMP = ambiente.toUpperCase() === "EMP";
const isQA = ambiente.toUpperCase() === "QA";
const isPROD = ambiente.toUpperCase() === "PROD";


const sucursales = {
  "Sante fe": "Vasco de Quiroga, 3900, 05348, Contadero, ciudad de méxico",
  "Coapa": "Calzada México-Xochimilco, 5149, 14388, Guadalupe, ciudad de méxico",
  "Interlomas": "Parque de Valencia, 17, 52786, Parques de la Herradura, naucalpan de juárez",
  "Mundo E": "Periférico Boulevard Manuel Ávila Camacho, 1007, 54025, Habitacional Jardines de Santa Monica, ciudad de méxico",
  "Angelopolis": "Calle 12, 30, 72190, San José Vista Hermosa, heroica puebla de zaragoza",
  "Pedregal": "Calle Cerrada de San Jerónimo, 117, 10200, San Jerónimo Lídice, ciudad de méxico",
  "Polanco": "Calle Hipólito Taine, 307, 11560, Polanco V Sección, ciudad de méxico",
  "Universidad": "Miguel Laurent, 624, 03104, Colonia del Valle Sur, ciudad de méxico",
};

const RecogerEnDirecciones = {
//  "Texmelucan": "AV. XICOTÉNCATL KM. 1 CARRET. SAN MARTÍN TEXMELUCAN-TLAX. S/N",
//'AV. XICOTÉNCATL KM. 1 CARRET. SAN MARTÍN TEXMELUCAN-TLAX. S/N'
  "Polanco": "calle socrates 112 polanco",

};


//const nombreSucursal = "Polanco";
//const SucursalaSeleccionar = "Av. Horacio 147, Polanco, Polanco I Secc, Miguel Hidalgo, 11510 Ciudad de México, CDMX";
//const nombreSucursal = "Sante fe";
//const SucursalaSeleccionar = "Vasco de Quiroga 3800, Lomas de Santa Fe, Cuajimalpa, Cuajimalpa de Morelos, 05348 Ciudad de México, CDMX";
//const nombreSucursal = "Interlomas";
//const SucursalaSeleccionar = "Parque de Valencia, 17, 52786, Parques de la Herradura, naucalpan de juárez";
const nombreSucursal = "Xalapa Animas";
const SucursalaSeleccionar = "AV. LAZARO CARDENAS ESQ, Federico Menzel S/N, LOMAS DE ANIMAS, 91194 Xalapa-Enríquez, Ver";

const correos = [
  "kmartinez@gdcpc.com",
  "joaquin.soto@atconmx.net"
];


const config = {
  ambiente,
  headless,
  browserChannel,
  otpProvider,
  OnlyEmpathy,
  OnlyReport,
  sucursales,
  correos,
  RecogerEnDirecciones,
  nombreSucursal,
  SucursalaSeleccionar,
  isQA,         
  isPROD,      
  isEMP,  

  urls: {
    PROD: 'https://www.chedraui.com.mx',
    PRODEMPATHY: 'https://www.chedraui.com.mx/?workspace=wempathyprod',
    QA: 'https://chedrauimxqa.myvtex.com',
    EMPATHY: 'https://wempathy--chedrauimx.myvtex.com',
    PRODauth0: 'https://chedraui-prod.us.auth0.com',
    QAauth0: 'https://chedraui-prod-qa.us.auth0.com',
    misdatos: '/account#/mis-datos/',
    outlook: 'https://outlook.office.com/mail/' ,
  },

  getEnviromentURL() {
    return this.urls[this.ambiente] || this.urls.PROD;
  },

  mailslurp: {
    apiKey: "d1840d194ec422cbe0664c8985d1afe8cec89868d0882c9586aa8f146533ce65",
    inboxId: "130525fa-0c6b-48b2-927c-4b7ad017ee84",
    emailAddress: "130525fa-0c6b-48b2-927c-4b7ad017ee84@zazamail.link",
  },
  gmail: {
    emailAddress: process.env.GMAIL_OTP_EMAIL || 'qa.automation.uat@gmail.com',
    credentialsPath: process.env.GMAIL_CREDENTIALS_PATH || './secrets/gmail-credentials.json',
    tokenPath: process.env.GMAIL_TOKEN_PATH || './secrets/gmail-token.json',
  },

  emails: {
    validUser: process.env.EMAIL_VALID_USER || 'chedrauienlinea@chedraui.com.mx',
    invalidUser: process.env.EMAIL_INVALID_USER || 'invalido@abc',
    noRegistrado: process.env.EMAIL_NO_REGISTRADO || 'noexistente@dominio.com',
  },
  password: {
    validPassword: process.env.EMAIL_VALID_PASSWORD || 'SoporteCH.2026',
    invalidPassword: process.env.EMAIL_INVALID_PASSWORD || '4565184',
  },


  timeouts: {
    waitForEmail: 200000,
    redirect: 10000,
    retryClick: 5000,
  },

};

module.exports = config;
