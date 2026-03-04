const { defineConfig } = require('@playwright/test');
const path = require('path');

// 👉 Importamos config para leer isEMP
const env = require('./utils/Environment');

module.exports = defineConfig({

  globalSetup: require.resolve('./global-setup.js'),
  testDir: './tests',

  // 👉 Evita ejecutar TODO el directorio de tests
  testMatch: [],

  projects: [
    {
      name: 'Coincidencias',
      testMatch: '**/Coincidencias/*.spec.js'
    },
    {
      name: 'TimeSlotScraper',
      testMatch: '**/TimeSlotScraper/*.spec.js'
    },
    {
      name: 'FlujosTransaccionales',
      testMatch: '**/FlujosTransaccionales/*.spec.js'
    }
  ],

  use: {

    headless: false,

    // 🔥 FIX 1: storageState solo en QA/PROD
    storageState: env.isEMP
      ? undefined
      : 'storageState.json',

    // 🔥 FIX 2 (IMPORTANTÍSIMO):
    // EMP → NO iniciar un browser nuevo
    // Se conecta al navegador persistente ya abierto en global-setup
    launchOptions: env.isEMP
      ? { args: ['--remote-debugging-port=9222'] }
      : {}
  },

  reporter: [
    ['list'],
    [
      'junit',
      {
        outputFile: path.join(__dirname, 'reports', 'reporteSucursales.xml')
      }
    ]
  ],

  timeout: 1000000
});