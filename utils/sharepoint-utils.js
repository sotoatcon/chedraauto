const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const DELEGATED_SCOPES = 'offline_access Files.Read';
const DEFAULT_TOKEN_PATH = path.resolve(__dirname, '..', 'secrets', 'ms-graph-token.json');

function loadEnvFile(envPath = path.resolve(__dirname, '..', '.env')) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

function required(value, name) {
  if (!value) {
    throw new Error(`Falta parametro requerido: ${name}`);
  }
  return value;
}

function normalizeGraphPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function encodeGraphPath(value) {
  return normalizeGraphPath(value)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function getParam(params, name, envName) {
  return params[name] || process.env[envName || name];
}

async function getMicrosoftGraphToken(params = {}) {
  const tenantId = required(getParam(params, 'tenantId', 'AZURE_TENANT_ID'), 'tenantId/AZURE_TENANT_ID');
  const clientId = required(getParam(params, 'clientId', 'AZURE_CLIENT_ID'), 'clientId/AZURE_CLIENT_ID');
  const clientSecret = required(getParam(params, 'clientSecret', 'AZURE_CLIENT_SECRET'), 'clientSecret/AZURE_CLIENT_SECRET');

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('scope', GRAPH_SCOPE);
  body.set('grant_type', 'client_credentials');

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`No se pudo obtener token Microsoft Graph (${response.status}): ${text}`);
  }

  const payload = JSON.parse(text);
  return payload.access_token;
}

function openUrl(url) {
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(command, error => {
    if (error) {
      console.log(`Abre esta URL en el navegador: ${url}`);
    }
  });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function exchangeMicrosoftGraphCode(params = {}) {
  const tenantId = required(getParam(params, 'tenantId', 'AZURE_TENANT_ID'), 'tenantId/AZURE_TENANT_ID');
  const clientId = required(getParam(params, 'clientId', 'AZURE_CLIENT_ID'), 'clientId/AZURE_CLIENT_ID');
  const code = required(params.code, 'code');
  const redirectUri = required(params.redirectUri, 'redirectUri');

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('scope', params.scope || DELEGATED_SCOPES);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  body.set('grant_type', 'authorization_code');

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`No se pudo intercambiar codigo Microsoft Graph (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function refreshMicrosoftGraphDelegatedToken(params = {}) {
  const tenantId = required(getParam(params, 'tenantId', 'AZURE_TENANT_ID'), 'tenantId/AZURE_TENANT_ID');
  const clientId = required(getParam(params, 'clientId', 'AZURE_CLIENT_ID'), 'clientId/AZURE_CLIENT_ID');
  const refreshToken = required(params.refreshToken, 'refreshToken');

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('scope', params.scope || DELEGATED_SCOPES);
  body.set('refresh_token', refreshToken);
  body.set('grant_type', 'refresh_token');

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`No se pudo refrescar token Microsoft Graph (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function generateMicrosoftGraphDelegatedToken(params = {}) {
  const tenantId = required(getParam(params, 'tenantId', 'AZURE_TENANT_ID'), 'tenantId/AZURE_TENANT_ID');
  const clientId = required(getParam(params, 'clientId', 'AZURE_CLIENT_ID'), 'clientId/AZURE_CLIENT_ID');
  const tokenPath = path.resolve(params.tokenPath || process.env.MS_GRAPH_TOKEN_PATH || DEFAULT_TOKEN_PATH);
  const port = Number(params.port || process.env.MS_GRAPH_AUTH_PORT || 42814);
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const state = Math.random().toString(36).slice(2);

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', params.scope || DELEGATED_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  console.log("Abre esta URL en el navegador y autoriza Microsoft Graph:");
  console.log(authUrl.toString());
  openUrl(authUrl.toString());

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, redirectUri);
      const returnedState = requestUrl.searchParams.get('state');
      const error = requestUrl.searchParams.get('error');
      const authCode = requestUrl.searchParams.get('code');

      if (error) {
        res.end('Error recibido. Puedes cerrar esta ventana.');
        server.close();
        reject(new Error(`${error}: ${requestUrl.searchParams.get('error_description') || ''}`));
        return;
      }

      if (returnedState !== state || !authCode) {
        res.end('Callback invalido. Puedes cerrar esta ventana.');
        server.close();
        reject(new Error('Callback Microsoft Graph invalido.'));
        return;
      }

      res.end('Token generado correctamente. Ya puedes cerrar esta ventana.');
      server.close();
      resolve(authCode);
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Esperando callback en ${redirectUri}`);
    });
  });

  const token = await exchangeMicrosoftGraphCode({ ...params, code, redirectUri });
  token.created_at = Date.now();
  writeJson(tokenPath, token);

  return {
    tokenPath,
    expiresIn: token.expires_in
  };
}

async function getMicrosoftGraphDelegatedToken(params = {}) {
  const tokenPath = path.resolve(params.tokenPath || process.env.MS_GRAPH_TOKEN_PATH || DEFAULT_TOKEN_PATH);
  const token = readJsonIfExists(tokenPath);

  if (!token || !token.refresh_token) {
    throw new Error(`No existe token delegado Microsoft Graph en ${tokenPath}. Ejecuta primero --auth delegated.`);
  }

  const createdAt = Number(token.created_at || 0);
  const expiresInMs = Number(token.expires_in || 0) * 1000;
  const stillValid = token.access_token && createdAt && (Date.now() < createdAt + expiresInMs - 60000);
  if (stillValid) return token.access_token;

  const refreshed = await refreshMicrosoftGraphDelegatedToken({
    ...params,
    refreshToken: token.refresh_token
  });

  const merged = {
    ...token,
    ...refreshed,
    refresh_token: refreshed.refresh_token || token.refresh_token,
    created_at: Date.now()
  };
  writeJson(tokenPath, merged);

  return merged.access_token;
}

async function graphRequest(accessToken, endpoint, options = {}) {
  const url = endpoint.startsWith('https://')
    ? endpoint
    : `${GRAPH_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Microsoft Graph error (${response.status}) en ${url}: ${text}`);
  }

  return response;
}

async function getSiteId(accessToken, params = {}) {
  const siteId = getParam(params, 'siteId', 'MS_GRAPH_SITE_ID');
  if (siteId) return siteId;

  const siteHostname = required(
    getParam(params, 'siteHostname', 'MS_GRAPH_SITE_HOSTNAME'),
    'siteHostname/MS_GRAPH_SITE_HOSTNAME'
  );
  const sitePath = required(
    getParam(params, 'sitePath', 'MS_GRAPH_SITE_PATH'),
    'sitePath/MS_GRAPH_SITE_PATH'
  );

  const endpoint = `/sites/${siteHostname}:/${encodeGraphPath(sitePath)}`;
  const response = await graphRequest(accessToken, endpoint);
  const site = await response.json();
  return site.id;
}

function buildDownloadEndpoint(params = {}) {
  const driveId = getParam(params, 'driveId', 'MS_GRAPH_DRIVE_ID');
  const itemId = getParam(params, 'itemId', 'MS_GRAPH_ITEM_ID');
  const siteId = getParam(params, 'siteId', 'MS_GRAPH_SITE_ID');
  const userId = getParam(params, 'userId', 'MS_GRAPH_USER_ID');
  const filePath = getParam(params, 'filePath', 'MS_GRAPH_FILE_PATH');

  if (driveId && itemId) {
    return `/drives/${driveId}/items/${itemId}/content`;
  }

  if (siteId && filePath) {
    return `/sites/${siteId}/drive/root:/${encodeGraphPath(filePath)}:/content`;
  }

  if (userId && filePath) {
    return `/users/${userId}/drive/root:/${encodeGraphPath(filePath)}:/content`;
  }

  return null;
}

async function downloadMicrosoftGraphFile(params = {}) {
  const outputPath = required(getParam(params, 'outputPath', 'MS_GRAPH_OUTPUT_PATH'), 'outputPath/MS_GRAPH_OUTPUT_PATH');
  const authMode = getParam(params, 'authMode', 'MS_GRAPH_AUTH_MODE') || 'application';
  const accessToken = params.accessToken || (
    authMode === 'delegated'
      ? await getMicrosoftGraphDelegatedToken(params)
      : await getMicrosoftGraphToken(params)
  );

  let endpoint = buildDownloadEndpoint(params);
  if (!endpoint) {
    const siteId = await getSiteId(accessToken, params);
    endpoint = buildDownloadEndpoint({ ...params, siteId });
  }

  const response = await graphRequest(accessToken, endpoint);
  const buffer = Buffer.from(await response.arrayBuffer());
  const resolvedOutput = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, buffer);

  return {
    outputPath: resolvedOutput,
    bytes: buffer.length,
    endpoint
  };
}

function parseCliArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;

    const key = current.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      params[key] = true;
    } else {
      params[key] = next;
      i++;
    }
  }
  return params;
}

if (require.main === module) {
  const params = parseCliArgs(process.argv.slice(2));

  const command = params.auth || params.command;
  const action = command === true ? 'delegated' : command;
  const runner = action === 'delegated'
    ? generateMicrosoftGraphDelegatedToken(params)
    : downloadMicrosoftGraphFile(params);

  runner
    .then(result => {
      if (action === 'delegated') {
        console.log(`Token Microsoft Graph guardado en: ${result.tokenPath}`);
      } else {
        console.log(`Archivo descargado: ${result.outputPath}`);
        console.log(`Bytes: ${result.bytes}`);
      }
    })
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  getMicrosoftGraphToken,
  generateMicrosoftGraphDelegatedToken,
  getMicrosoftGraphDelegatedToken,
  graphRequest,
  getSiteId,
  downloadMicrosoftGraphFile
};
