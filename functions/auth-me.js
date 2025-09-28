const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server not configured' }) };
    }

    const token = event.headers['x-auth-token'] || (event.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, headers, body: JSON.stringify({ message: 'No token provided' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ message: 'Invalid token' }) };
    }

    // Optionally load profile or history from a table if you have one
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: user.id, email: user.email, troubleshootingHistory: [] })
    };
  } catch (err) {
    console.error('[AUTH_ME_ERROR]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error' }) };
  }
};
