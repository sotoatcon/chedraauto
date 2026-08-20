const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('./Environment');

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function resolveFromCwd(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function readJsonSecret({ jsonEnv, b64Env, filePath, label }) {
  const inlineJson = process.env[jsonEnv];
  if (inlineJson) return JSON.parse(inlineJson);

  const base64Json = process.env[b64Env];
  if (base64Json) return JSON.parse(Buffer.from(base64Json, 'base64').toString('utf8'));

  const absolutePath = resolveFromCwd(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`[Gmail] No se encontro ${label}: ${absolutePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function getOAuthClientConfig(credentials) {
  const client = credentials.installed || credentials.web;
  if (!client) {
    throw new Error('[Gmail] credentials.json no tiene seccion installed/web valida.');
  }
  return client;
}

function createOAuthClient(redirectUri = null) {
  const credentials = readJsonSecret({
    jsonEnv: 'GMAIL_CREDENTIALS_JSON',
    b64Env: 'GMAIL_CREDENTIALS_JSON_B64',
    filePath: config.gmail.credentialsPath,
    label: 'gmail-credentials.json'
  });

  const client = getOAuthClientConfig(credentials);
  return new google.auth.OAuth2(
    client.client_id,
    client.client_secret,
    redirectUri || (client.redirect_uris && client.redirect_uris[0]) || 'http://localhost'
  );
}

function getGmailAuthUrl({ redirectUri } = {}) {
  const auth = createOAuthClient(redirectUri);
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES
  });
}

async function saveTokenFromCode({ code, redirectUri } = {}) {
  if (!code) throw new Error('[Gmail] No se recibio codigo OAuth.');

  const auth = createOAuthClient(redirectUri);
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  const tokenPath = resolveFromCwd(config.gmail.tokenPath);
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  return tokenPath;
}

function getAuthorizedClient() {
  const auth = createOAuthClient();
  const token = readJsonSecret({
    jsonEnv: 'GMAIL_TOKEN_JSON',
    b64Env: 'GMAIL_TOKEN_JSON_B64',
    filePath: config.gmail.tokenPath,
    label: 'gmail-token.json'
  });

  auth.setCredentials(token);
  return auth;
}

function decodeBase64Url(value = '') {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function collectPayloadText(payload, chunks = []) {
  if (!payload) return chunks;

  if (payload.body && payload.body.data) {
    chunks.push(decodeBase64Url(payload.body.data));
  }

  for (const part of payload.parts || []) {
    collectPayloadText(part, chunks);
  }

  return chunks;
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorStatus(error) {
  return error.code || error.status || error.response?.status || 'sin status';
}

function isInvalidGrant(error) {
  const message = String(error && error.message ? error.message : '').toLowerCase();
  const responseError = String(error && error.response && error.response.data && error.response.data.error ? error.response.data.error : '').toLowerCase();
  return message.includes('invalid_grant') || responseError === 'invalid_grant';
}

function extractOtpCode(text) {
  const normalized = stripHtml(text);
  const preferred = normalized.match(/(?:codigo|código|code|access code)[^\d]{0,80}(\d{6})/i);
  if (preferred) return preferred[1];

  const generic = normalized.match(/\b\d{6}\b/);
  return generic ? generic[0] : null;
}

async function getMessageText(gmail, messageId) {
  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });

  const payloadText = collectPayloadText(data.payload).join(' ');
  return {
    id: data.id,
    internalDate: Number(data.internalDate || 0),
    text: `${data.snippet || ''} ${payloadText}`
  };
}

async function getGmailInbox() {
  return {
    id: 'gmail',
    emailAddress: config.gmail.emailAddress
  };
}

async function clearGmailOtpInbox() {
  console.log('[Gmail] Limpieza omitida: Gmail se usa en modo readonly.');
}

async function waitForGmailCode({ timeoutMs = config.timeouts.waitForEmail, notBeforeMs = Date.now(), pollMs = 8000 } = {}) {
  const auth = getAuthorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const startMs = Date.now();
  const minInternalDate = notBeforeMs - 5000;
  const query = process.env.GMAIL_OTP_QUERY || 'newer_than:1d';
  const ignoredMessageIds = new Set();
  const readRetryByMessageId = new Map();

  while (Date.now() - startMs < timeoutMs) {
    let data;
    try {
      ({ data } = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10
      }));
    } catch (error) {
      const status = getErrorStatus(error);
      console.warn(`[Gmail] No se pudo listar correos: ${status} - ${error.message}`);
      if (isInvalidGrant(error)) {
        throw new Error('[Gmail] Token OAuth invalido o revocado. Regenera secrets/gmail-token.json con la cuenta configurada.');
      }
      await sleep(pollMs);
      continue;
    }

    const messages = data.messages || [];
    for (const message of messages) {
      if (ignoredMessageIds.has(message.id)) continue;

      let detail;
      try {
        detail = await getMessageText(gmail, message.id);
      } catch (error) {
        const status = getErrorStatus(error);
        const retries = (readRetryByMessageId.get(message.id) || 0) + 1;
        readRetryByMessageId.set(message.id, retries);
        console.warn(`[Gmail] No se pudo leer mensaje ${message.id}: ${status} - ${error.message}`);
        if (isInvalidGrant(error)) {
          throw new Error('[Gmail] Token OAuth invalido o revocado. Regenera secrets/gmail-token.json con la cuenta configurada.');
        }
        if (retries >= 2) ignoredMessageIds.add(message.id);
        continue;
      }

      if (detail.internalDate && detail.internalDate < minInternalDate) {
        ignoredMessageIds.add(message.id);
        continue;
      }

      const code = extractOtpCode(detail.text);
      if (code) {
        console.log('[Gmail] Codigo OTP detectado.');
        return code;
      }

      ignoredMessageIds.add(message.id);
    }

    console.log('[Gmail] Esperando codigo OTP...');
    await sleep(pollMs);
  }

  throw new Error(`[Gmail] No llego codigo OTP en ${timeoutMs}ms.`);
}

module.exports = {
  GMAIL_SCOPES,
  getGmailAuthUrl,
  saveTokenFromCode,
  getGmailInbox,
  clearGmailOtpInbox,
  waitForGmailCode,
  extractOtpCode
};
