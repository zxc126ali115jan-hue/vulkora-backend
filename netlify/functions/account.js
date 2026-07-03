const { supabase, json, hashPassword, verifyPassword, getSessionAccount } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'PUT') return json(405, { error: 'method_not_allowed' });

  const account = await getSessionAccount(event);
  if (!account) return json(401, { error: 'not_authenticated' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'bad_request' });
  }

  const currentPassword = String(body.currentPassword || '');
  const newUsername = body.newUsername ? String(body.newUsername).trim() : null;
  const newPassword = body.newPassword ? String(body.newPassword) : null;

  if (!currentPassword) return json(400, { error: 'missing_current_password' });
  if (newPassword && newPassword.length < 8) return json(400, { error: 'password_too_short' });
  if (!newUsername && !newPassword) return json(400, { error: 'nothing_to_update' });

  const { data: fullAccount } = await supabase
    .from('admin_accounts')
    .select('*')
    .eq('id', account.id)
    .single();

  if (!verifyPassword(currentPassword, fullAccount.password_hash)) {
    return json(401, { error: 'wrong_password' });
  }

  const updates = {};
  if (newUsername && newUsername !== fullAccount.username) {
    const { data: existing } = await supabase
      .from('admin_accounts')
      .select('id')
      .eq('username', newUsername)
      .maybeSingle();
    if (existing) return json(409, { error: 'username_taken' });
    updates.username = newUsername;
  }
  if (newPassword) {
    updates.password_hash = hashPassword(newPassword);
  }

  const { data, error } = await supabase
    .from('admin_accounts')
    .update(updates)
    .eq('id', account.id)
    .select('id, username, role, name_ar, name_en')
    .single();

  if (error) return json(500, { error: 'server_error' });
  return json(200, { account: data });
};
