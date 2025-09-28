// UI Module for HVAC Troubleshooting App

export const showLoader = () => document.getElementById('global-loader').classList.remove('hidden');
export const hideLoader = () => document.getElementById('global-loader').classList.add('hidden');

export const showNotification = (message, type = 'success') => {
  const container = document.getElementById('notification-container');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  container.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.5s forwards';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
};
