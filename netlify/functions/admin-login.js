const { supabase, json, verifyPassword, setSessionCookie, createSession } = require('./_lib');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'bad_request' });
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json(400, { error: 'missing_fields' });

  const { data: attempt } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (attempt && attempt.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
    return json(429, { error: 'locked', lockedUntil: attempt.locked_until });
  }

  const { data: account } = await supabase
    .from('admin_accounts')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  const ok = account && verifyPassword(password, account.password_hash);

  if (!ok) {
    const attempts = (attempt ? attempt.attempts : 0) + 1;
    const lockedUntil =
      attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;
    await supabase
      .from('login_attempts')
      .upsert({ username, attempts, locked_until: lockedUntil }, { onConflict: 'username' });

    if (lockedUntil) return json(429, { error: 'locked', lockedUntil });
    return json(401, { error: 'invalid_credentials' });
  }

  await supabase
    .from('login_attempts')
    .upsert({ username, attempts: 0, locked_until: null }, { onConflict: 'username' });

  const token = await createSession(account.id);

  return json(
    200,
    {
      ok: true,
      account: {
        username: account.username,
        role: account.role,
        name_ar: account.name_ar,
        name_en: account.name_en,
      },
    },
    { 'Set-Cookie': setSessionCookie(token) }
  );
};
