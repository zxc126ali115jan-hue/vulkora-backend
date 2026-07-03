const { json, deleteSession, clearSessionCookie } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  await deleteSession(event);
  return json(200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
};
