const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient(token) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase not configured');
  return createClient(url, anon, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };

  try {
    const token = event.headers['x-auth-token'] || (event.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ message: 'Unauthorized' }) };
    const supabase = getSupabaseClient(token);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return { statusCode: 401, headers, body: JSON.stringify({ message: 'Invalid user token' }) };

    const { subscriptionId } = JSON.parse(event.body || '{}');
    if (!subscriptionId) return { statusCode: 400, headers, body: JSON.stringify({ message: 'Missing subscriptionId' }) };

    // TODO: Persist subscription to Supabase (table `subscriptions`) or user metadata.
    console.log('[PAYPAL_LINK_SUBSCRIPTION] user:', userData.user.id, 'subscriptionId:', subscriptionId);

    return { statusCode: 200, headers, body: JSON.stringify({ linked: true }) };
  } catch (err) {
    console.error('[PAYPAL_LINK_SUBSCRIPTION_ERROR]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error linking subscription' }) };
  }
};
