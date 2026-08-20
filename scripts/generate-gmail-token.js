const http = require('http');
const { URL } = require('url');
const { getGmailAuthUrl, saveTokenFromCode } = require('../utils/gmail-utils');

const port = Number(process.env.GMAIL_OAUTH_PORT || 42813);
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

const server = http.createServer(async (req, res) => {
  try {
    const currentUrl = new URL(req.url, redirectUri);
    if (currentUrl.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const code = currentUrl.searchParams.get('code');
    if (!code) {
      throw new Error('No se recibio parametro code en callback OAuth.');
    }

    const tokenPath = await saveTokenFromCode({ code, redirectUri });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Token generado correctamente en ${tokenPath}. Ya puedes cerrar esta ventana.`);
    console.log(`[Gmail] Token generado correctamente en ${tokenPath}`);
    server.close();
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.message);
    console.error(error);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(port, '127.0.0.1', () => {
  const authUrl = getGmailAuthUrl({ redirectUri });
  console.log('[Gmail] Abre esta URL en el navegador y autoriza la cuenta qa.automation.uat@gmail.com:');
  console.log(authUrl);
  console.log(`[Gmail] Esperando callback en ${redirectUri}`);
});
