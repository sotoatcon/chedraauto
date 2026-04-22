// utils/Environment.js
const ambiente = (process.env.TEST_ENV || 'PROD').trim().replace(/^\uFEFF/, '');
const headless = process.env.HEADLESS !== 'false';

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
  "Polanco": "calle socrates 112 polanco",

};

const correos = [
  "kmartinez@gdcpc.com",
  "joaquin.soto@atconmx.net"
];


const config = {
  ambiente,
  headless,
  sucursales,
  correos,
  RecogerEnDirecciones,
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
    inboxId: "b25c5493-e8eb-4ab0-8983-0dc0de6af890",
    emailAddress: "b25c5493-e8eb-4ab0-8983-0dc0de6af890@mailslurp.biz",
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
