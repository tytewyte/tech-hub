const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient(token) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase not configured');
  return createClient(url, anon, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});
}

const BUCKET = process.env.SUPABASE_BUCKET || 'manuals';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token, Authorization',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const token = event.headers['x-auth-token'] || (event.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    const supabase = getSupabaseClient(token);

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'updated_at', order: 'desc' } });
      if (error) throw error;
      const mapped = (data || []).map((f) => ({
        id: f.name,
        title: f.name,
        description: '',
        fileName: f.name,
        filePath: `${BUCKET}/${f.name}`,
        fileType: f.metadata?.mimetype || '',
        fileSize: f.metadata?.size || f.size || 0,
        updatedAt: f.updated_at || null,
        url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl
      }));
      return { statusCode: 200, headers, body: JSON.stringify(mapped) };
    }

    if (event.httpMethod === 'DELETE') {
      // Expect path like /.netlify/functions/api-manuals/<filename>
      const parts = (event.path || '').split('/');
      const filename = decodeURIComponent(parts[parts.length - 1]);
      if (!filename) return { statusCode: 400, headers, body: JSON.stringify({ message: 'Missing filename' }) };
      const { error } = await supabase.storage.from(BUCKET).remove([filename]);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Manual deleted successfully' }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  } catch (err) {
    console.error('[API_MANUALS_ERROR]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error' }) };
  }
};
