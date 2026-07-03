const { supabase, json, getSessionAccount } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });
    if (error) return json(500, { error: 'server_error' });
    return json(200, data);
  }

  if (event.httpMethod === 'POST') {
    const account = await getSessionAccount(event);
    if (!account) return json(401, { error: 'not_authenticated' });

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'bad_request' });
    }

    const required = ['cat', 'price', 'icon', 'name_ar', 'name_en'];
    for (const f of required) {
      if (!body[f] && body[f] !== 0) return json(400, { error: 'missing_field', field: f });
    }

    const row = {
      cat: body.cat,
      price: Number(body.price),
      icon: body.icon,
      rating: body.rating != null ? Number(body.rating) : 4.5,
      sku: body.sku || null,
      is_admin_added: true,
      added_by: account.username,
      name_ar: body.name_ar, name_en: body.name_en,
      desc_ar: body.desc_ar || '', desc_en: body.desc_en || '',
      material_ar: body.material_ar || '', material_en: body.material_en || '',
      origin_ar: body.origin_ar || '', origin_en: body.origin_en || '',
      shipping_ar: body.shipping_ar || '', shipping_en: body.shipping_en || '',
    };

    const { data, error } = await supabase.from('products').insert(row).select().single();
    if (error) return json(500, { error: 'server_error' });
    return json(200, { product: data });
  }

  if (event.httpMethod === 'DELETE') {
    const account = await getSessionAccount(event);
    if (!account) return json(401, { error: 'not_authenticated' });

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return json(400, { error: 'missing_id' });

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return json(500, { error: 'server_error' });
    return json(200, { ok: true });
  }

  return json(405, { error: 'method_not_allowed' });
};
