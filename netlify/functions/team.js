const { supabase, json, hashPassword, getSessionAccount } = require('./_lib');

exports.handler = async (event) => {
  const account = await getSessionAccount(event);
  if (!account) return json(401, { error: 'not_authenticated' });

  if (event.httpMethod === 'GET') {
    if (account.role !== 'owner') return json(403, { error: 'forbidden' });
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username, role, name_ar, name_en, created_at')
      .order('id', { ascending: true });
    if (error) return json(500, { error: 'server_error' });
    return json(200, data);
  }

  if (event.httpMethod === 'POST') {
    if (account.role !== 'owner') return json(403, { error: 'forbidden' });

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'bad_request' });
    }

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const name_ar = String(body.name_ar || '').trim();
    const name_en = String(body.name_en || '').trim();

    if (!username || !password || !name_ar || !name_en) return json(400, { error: 'missing_fields' });
    if (password.length < 8) return json(400, { error: 'password_too_short' });

    const { data: existing } = await supabase
      .from('admin_accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (existing) return json(409, { error: 'username_taken' });

    const { data, error } = await supabase
      .from('admin_accounts')
      .insert({
        username,
        password_hash: hashPassword(password),
        role: 'assistant',
        name_ar,
        name_en,
      })
      .select('id, username, role, name_ar, name_en, created_at')
      .single();

    if (error) return json(500, { error: 'server_error' });
    return json(200, { account: data });
  }

  if (event.httpMethod === 'DELETE') {
    if (account.role !== 'owner') return json(403, { error: 'forbidden' });
    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return json(400, { error: 'missing_id' });

    const { data: target } = await supabase.from('admin_accounts').select('role').eq('id', id).maybeSingle();
    if (target && target.role === 'owner') return json(400, { error: 'cannot_delete_owner' });

    const { error } = await supabase.from('admin_accounts').delete().eq('id', id);
    if (error) return json(500, { error: 'server_error' });
    return json(200, { ok: true });
  }

  return json(405, { error: 'method_not_allowed' });
};
