// Connector to the signing system (Ogen Sign) — read-only queries against its
// Supabase backend via the public PostgREST API. The anon key is the same
// public key the web app ships with; Row Level Security governs access.

const headers = (env) => ({
  apikey: env.SUPABASE_ANON_KEY,
  authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
});

async function rest(env, path, extraHeaders = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...headers(env), ...extraHeaders },
  });
  if (!res.ok) throw new Error(`Supabase query failed (${res.status})`);
  return res;
}

export async function latestSigned(env, n = 5) {
  const res = await rest(
    env,
    `sign_requests?status=eq.signed&order=signed_at.desc&limit=${n}&select=id,title,signed_at`,
  );
  return res.json();
}

async function countByStatus(env, status) {
  const res = await rest(
    env,
    `sign_requests?status=eq.${status}&select=id&limit=1`,
    { prefer: 'count=exact' },
  );
  const range = res.headers.get('content-range') || '/0';
  return parseInt(range.split('/')[1], 10) || 0;
}

export async function stats(env) {
  const [signed, pending] = await Promise.all([
    countByStatus(env, 'signed'),
    countByStatus(env, 'sent'),
  ]);
  return { signed, pending };
}

// Public URL of a signed PDF in the documents bucket.
export function signedPdfUrl(env, id) {
  return `${env.SUPABASE_URL}/storage/v1/object/public/documents/signed/${id}.pdf`;
}
