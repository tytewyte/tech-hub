const { createClient } = require('@supabase/supabase-js');

function getSupabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase not configured');
  return createClient(url, anon);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };

  try {
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) return { statusCode: 400, headers, body: JSON.stringify({ message: 'Missing email or password' }) };

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session || !data?.user) {
      return { statusCode: 401, headers, body: JSON.stringify({ message: 'Invalid credentials' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token: data.session.access_token,
        user: { id: data.user.id, email: data.user.email, username: data.user.user_metadata?.username || '' }
      })
    };
  } catch (err) {
    console.error('[LOGIN_ERROR]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error during login' }) };
  }
};
