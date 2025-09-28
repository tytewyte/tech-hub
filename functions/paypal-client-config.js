exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const env = process.env.PAYPAL_ENV || 'sandbox';
  const planId = process.env.PAYPAL_PLAN_ID || '';
  const currency = process.env.PAYPAL_CURRENCY || 'USD';
  const hostedButtonId = process.env.PAYPAL_HOSTED_BUTTON_ID || '';

  if (!clientId) {
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'PayPal not configured' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ clientId, env, planId, currency, hostedButtonId })
  };
};
