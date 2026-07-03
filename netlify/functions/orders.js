const { supabase, json, getSessionAccount } = require('./_lib');

function genOrderId() {
  return 'VLK-' + Math.floor(100000 + Math.random() * 899999);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'bad_request' });
    }

    const orderId = genOrderId();
    const row = {
      id: orderId,
      total_usd: Number(body.totalUSD) || 0,
      currency: body.currency || 'USD',
      display_total: body.displayTotal || '',
      payment: body.payment || '',
      item_count: Number(body.itemCount) || 0,
    };

    const { error } = await supabase.from('orders').insert(row);
    if (error) return json(500, { error: 'server_error' });
    return json(200, { orderId });
  }

  if (event.httpMethod === 'GET') {
    const account = await getSessionAccount(event);
    if (!account) return json(401, { error: 'not_authenticated' });

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return json(500, { error: 'server_error' });
    return json(200, data);
  }

  return json(405, { error: 'method_not_allowed' });
};
