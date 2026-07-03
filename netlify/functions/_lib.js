const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const COOKIE_NAME = 'vulkora_session';
const SESSION_DAYS = 7;

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(body),
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');
  if (check.length !== original.length) return false;
  return crypto.timingSafeEqual(check, original);
}

function parseCookies(event) {
  const header = event.headers.cookie || event.headers.Cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function setSessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function createSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('sessions').insert({ token, account_id: accountId, expires_at: expiresAt });
  if (error) throw error;
  return token;
}

async function getSessionAccount(event) {
  const cookies = parseCookies(event);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const { data: session } = await supabase
    .from('sessions')
    .select('account_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: account } = await supabase
    .from('admin_accounts')
    .select('id, username, role, name_ar, name_en')
    .eq('id', session.account_id)
    .maybeSingle();

  return account || null;
}

async function deleteSession(event) {
  const cookies = parseCookies(event);
  const token = cookies[COOKIE_NAME];
  if (!token) return;
  await supabase.from('sessions').delete().eq('token', token);
}

module.exports = {
  supabase,
  json,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  createSession,
  getSessionAccount,
  deleteSession,
};
