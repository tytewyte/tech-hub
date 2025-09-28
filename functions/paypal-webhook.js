const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

function getPaypalApiBase() {
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPaypalAccessToken() {
  const base = getPaypalApiBase();
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const tokenResp = await axios.post(
    `${base}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: id, password: secret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return tokenResp.data.access_token;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase admin not configured');
  return createClient(url, serviceKey);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };

  try {
    const payload = JSON.parse(event.body || '{}');
    const transmissionId = event.headers['paypal-transmission-id'];
    const transmissionTime = event.headers['paypal-transmission-time'];
    const certUrl = event.headers['paypal-cert-url'];
    const authAlgo = event.headers['paypal-auth-algo'];
    const transmissionSig = event.headers['paypal-transmission-sig'];
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig || !webhookId) {
      console.error('Missing webhook headers or webhook ID');
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Bad webhook request' }) };
    }

    const accessToken = await getPaypalAccessToken();
    const base = getPaypalApiBase();

    const verifyResp = await axios.post(
      `${base}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: payload
      },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    if (verifyResp.data.verification_status !== 'SUCCESS') {
      console.error('Webhook verification failed');
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid webhook' }) };
    }

    // Persist subscription status
    const supabase = getSupabaseAdmin();
    const eventType = payload.event_type;
    const resource = payload.resource || {};
    const subscriptionId = resource.id || resource.resource?.id;
    const status = resource.status || resource.state || 'unknown';
    const planId = resource.plan_id || resource.plan_id || null;

    if (subscriptionId) {
      // Upsert into subscriptions table if it exists
      try {
        await supabase.from('subscriptions').upsert({
          subscription_id: subscriptionId,
          status,
          plan_id: planId,
          last_event: eventType,
          updated_at: new Date().toISOString()
        }, { onConflict: 'subscription_id' });
      } catch (e) {
        console.warn('Subscriptions table upsert failed (may not exist):', e.message);
      }
    }

    console.log('[PAYPAL_WEBHOOK_OK]', eventType, subscriptionId, status);
    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('[PAYPAL_WEBHOOK_ERROR]', err?.response?.data || err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error' }) };
  }
};
