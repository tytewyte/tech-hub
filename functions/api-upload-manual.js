const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

const BUCKET = process.env.SUPABASE_BUCKET || 'manuals';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase admin not configured');
  return createClient(url, serviceKey);
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
    const supabase = getSupabaseAdmin();

    // Netlify sends body as base64 for multipart
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid content type' }) };
    }

    const bb = Busboy({ headers: { 'content-type': contentType } });
    const chunks = [];
    let filename = null;
    let mimetype = 'application/octet-stream';

    const busboyPromise = new Promise((resolve, reject) => {
      bb.on('file', (name, file, info) => {
        filename = info.filename;
        mimetype = info.mimeType || info.mimetype || mimetype;
        file.on('data', (data) => chunks.push(data));
        file.on('limit', () => reject(new Error('File too large')));
      });
      bb.on('error', reject);
      bb.on('finish', resolve);
    });

    const bodyBuffer = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    bb.end(bodyBuffer);
    await busboyPromise;

    if (!filename || chunks.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'No file uploaded' }) };
    }

    const fileBuffer = Buffer.concat(chunks);
    const objectName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectName, fileBuffer, { contentType: mimetype, upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectName);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Upload successful',
        file: {
          id: objectName,
          fileName: filename,
          fileType: mimetype,
          size: fileBuffer.length,
          url: publicData.publicUrl
        }
      })
    };
  } catch (err) {
    console.error('[API_UPLOAD_MANUAL_ERROR]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error during upload' }) };
  }
};
