const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  globalSetup: require.resolve('./global-setup.js'),

  testDir: './tests',

  // 👉 Desactivamos testMatch global para evitar que Playwright ejecute TODO
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
        testMatch: [
          '**/FlujosTransaccionales/*.spec.js'
        ]
    }
  ],

  use: {
    headless: true,
    storageState: 'storageState.json',
  },

  reporter: [
    ['list'],
    ['junit', { outputFile: path.join(__dirname, 'reports', 'reporteSucursales.xml') }]
  ],

  timeout: 1000000,
  //retries: 0,
});
