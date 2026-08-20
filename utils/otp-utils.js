const config = require('./Environment');
const mailslurpUtils = require('./mailslurp-utils');
const gmailUtils = require('./gmail-utils');

function isGmailProvider() {
  return String(config.otpProvider || '').toLowerCase() === 'gmail';
}

async function getOtpInbox() {
  if (isGmailProvider()) {
    return gmailUtils.getGmailInbox();
  }

  return mailslurpUtils.getFixedInbox();
}

async function clearOtpInbox(inboxId) {
  if (isGmailProvider()) {
    return gmailUtils.clearGmailOtpInbox();
  }

  // Flujo MailSlurp anterior: se conserva para usarlo con OTP_PROVIDER=mailslurp.
  return mailslurpUtils.deleteEmail(inboxId);
}

async function waitForOtpCode({ inboxId, timeoutMs, notBeforeMs } = {}) {
  if (isGmailProvider()) {
    return gmailUtils.waitForGmailCode({ timeoutMs, notBeforeMs });
  }

  // Flujo MailSlurp anterior: se conserva para usarlo con OTP_PROVIDER=mailslurp.
  return mailslurpUtils.waitForCode(inboxId, timeoutMs);
}

module.exports = {
  getOtpInbox,
  clearOtpInbox,
  waitForOtpCode
};
