import { showNotification } from './ui.js';

async function loadPaypalSdk({ clientId, env, components = 'buttons', currency = 'USD', enableFunding = '' }) {
  return new Promise((resolve, reject) => {
    // Avoid double-loading
    if (window.paypal) return resolve(window.paypal);
    const script = document.createElement('script');
    const base = 'https://www.paypal.com/sdk/js';
    const params = new URLSearchParams({
      'client-id': clientId,
      components,
      currency,
      intent: 'subscription',
      vault: 'true',
      'disable-funding': 'paylater,credit,card',
      ...(enableFunding ? { 'enable-funding': enableFunding } : {}),
      'data-sdk-integration-source': 'button-factory'
    });
    script.src = `${base}?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.head.appendChild(script);
  });
}

async function fetchPaypalConfig() {
  const res = await fetch('/api/paypal/config');
  if (!res.ok) throw new Error('Failed to load PayPal config');
  return res.json();
}

function getAuthToken() {
  return localStorage.getItem('token');
}

async function linkSubscription(subscriptionId) {
  const token = getAuthToken();
  const res = await fetch('/api/paypal/link-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-auth-token': token } : {})
    },
    body: JSON.stringify({ subscriptionId })
  });
  if (!res.ok) throw new Error('Failed to link subscription');
  return res.json();
}

async function renderButtons(container) {
  try {
    const { clientId, env, planId, currency, hostedButtonId } = await fetchPaypalConfig();
    if (!clientId) throw new Error('Missing PayPal client ID');
    
    // If hosted button is configured, render hosted buttons instead
    if (hostedButtonId) {
      const paypal = await loadPaypalSdk({ clientId, env, components: 'hosted-buttons', currency, enableFunding: 'venmo' });
      if (!paypal.HostedButtons) {
        showNotification('Hosted buttons not available. Please contact support.', 'error');
        return;
      }
      paypal.HostedButtons({ hostedButtonId }).render(container);
      return;
    }

    // Otherwise, use Subscription Smart Buttons (requires PAYPAL_PLAN_ID)
    if (!planId) {
      console.warn('PAYPAL_PLAN_ID not set and no hostedButtonId provided.');
      showNotification('Subscription configuration missing. Please contact support.', 'error');
      return;
    }

    const paypal = await loadPaypalSdk({ clientId, env, components: 'buttons', currency });
    paypal.Buttons({
      style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
      createSubscription: function (data, actions) {
        return actions.subscription.create({ plan_id: planId });
      },
      onApprove: async function (data, actions) {
        try {
          await linkSubscription(data.subscriptionID);
          showNotification('Subscription activated. Thank you!', 'success');
        } catch (e) {
          console.error(e);
          showNotification('Subscription linking failed. Please contact support.', 'error');
        }
      },
      onError: function (err) {
        console.error('[PayPal onError]', err);
        showNotification('Payment error. Please try again later.', 'error');
      }
    }).render(container);
  } catch (err) {
    console.error('[Payments] renderButtons error', err);
    showNotification(err.message || 'Unable to initialize payments', 'error');
  }
}

function init() {
  const subscribeBtn = document.getElementById('subscribe-btn');
  const buttonsContainer = document.getElementById('paypal-buttons-container');
  if (!subscribeBtn || !buttonsContainer) return;

  subscribeBtn.addEventListener('click', async () => {
    // Require login
    const token = getAuthToken();
    if (!token) {
      showNotification('Please login or register before subscribing.', 'error');
      return;
    }
    subscribeBtn.disabled = true;
    buttonsContainer.classList.remove('hidden');
    await renderButtons('#paypal-buttons-container');
  });
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
