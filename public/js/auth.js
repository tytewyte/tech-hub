import { showNotification } from './modules/ui.js';

// Auth Module for HVAC Troubleshooting App

// Auth State
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));
let userHistoryCache = []; // Cache for full history data

// Check if user is logged in
function checkAuthState() {
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const userProfile = document.getElementById('user-profile');
  const usernameDisplay = document.getElementById('username-display');
  
  if (authToken && currentUser) {
    // User is logged in
    if (loginBtn) loginBtn.classList.add('hidden');
    if (registerBtn) registerBtn.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
    
    // Update history page
    const noHistory = document.querySelector('.no-history');
    if (noHistory) noHistory.classList.add('hidden');
    loadUserHistory();
  } else {
    // User is not logged in
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (registerBtn) registerBtn.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    
    // Update history page
    const noHistory = document.querySelector('.no-history');
    const historyList = document.querySelector('.history-list');
    if (noHistory) noHistory.classList.remove('hidden');
    if (historyList) historyList.innerHTML = '<p class="no-history">Login to view your troubleshooting history.</p>';
  }
}

async function loadUserHistory() {
  if (!authToken) return;
  
  try {
    const response = await fetch('/auth/me', {
      headers: {
        'x-auth-token': authToken
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      
      // Display history if available
      const historyList = document.querySelector('.history-list');
      
      userHistoryCache = userData.troubleshootingHistory || [];
      if (userHistoryCache.length > 0) {
        historyList.innerHTML = userHistoryCache.map((item, index) => `
          <div class="history-item" data-history-index="${index}">
            <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
            <div class="history-system">${item.systemType}</div>
            <div class="history-issue">${item.issue}</div>
            <div class="history-solution">${item.aiResponse.substring(0, 100)}...</div>
          </div>
        `).join('');
      } else {
        historyList.innerHTML = '<p>No troubleshooting history found.</p>';
      }
    }
  } catch (error) {
    console.error('Error loading user history:', error);
  }
}

function showHistoryDetail(data) {
    const modal = document.getElementById('history-detail-modal');
    const content = document.getElementById('history-detail-content');

    if (!modal || !content) return;

    content.innerHTML = `
        <div class="history-detail-grid">
            <div><strong>Date:</strong></div>
            <div>${new Date(data.timestamp).toLocaleString()}</div>
            
            <div><strong>System Type:</strong></div>
            <div>${data.systemType}</div>
            
            <div><strong>Issue Reported:</strong></div>
            <div>${data.issue}</div>
            
            <div><strong>Symptoms:</strong></div>
            <div>${data.symptoms.join(', ') || 'None'}</div>
        </div>
        <hr>
        <h4>AI-Generated Response</h4>
        <div class="ai-response-text">${data.aiResponse}</div>
    `;

    modal.style.display = 'block';
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - moved inside DOMContentLoaded
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userProfile = document.getElementById('user-profile');
  const usernameDisplay = document.getElementById('username-display');
  
  const loginModal = document.getElementById('login-modal');
  const registerModal = document.getElementById('register-modal');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  const closeButtons = document.querySelectorAll('.close');

  // Event Listeners
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (loginModal) loginModal.style.display = 'block';
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      if (registerModal) registerModal.style.display = 'block';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      authToken = null;
      currentUser = null;
      
      // Update UI
      checkAuthState();
    });
  }

  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (loginModal) loginModal.style.display = 'none';
      if (registerModal) registerModal.style.display = 'none';
    });
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      loginModal.style.display = 'none';
    }
    if (e.target === registerModal) {
      registerModal.style.display = 'none';
    }
  });

  // Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Store auth token
          localStorage.setItem('token', data.token);
          authToken = data.token;
          
          // Store user data directly from login response
          localStorage.setItem('user', JSON.stringify(data.user));
          currentUser = data.user;
          
          // Update UI
          checkAuthState();
          if (loginModal) loginModal.style.display = 'none';
          loginForm.reset();
          showNotification('Login successful!');
        } else {
          showNotification(data.message || 'Login failed', 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
      }
    });
  }

  // Register Form Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('register-username').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      
      // Validate passwords match
      if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
      }
      
      try {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Store auth token
          localStorage.setItem('token', data.token);
          authToken = data.token;
          
          // Store user data directly from registration response
          localStorage.setItem('user', JSON.stringify(data.user));
          currentUser = data.user;
          
          // Update UI
          checkAuthState();
          if (registerModal) registerModal.style.display = 'none';
          registerForm.reset();
          showNotification('Registration successful!');
        } else {
          showNotification(data.message || 'Registration failed', 'error');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showNotification('Registration failed. Please try again.', 'error');
      }
    });
  }

  // Event Delegation for History Items
  const historyList = document.querySelector('.history-list');
  if (historyList) {
      historyList.addEventListener('click', (e) => {
          const historyItem = e.target.closest('.history-item');
          if (historyItem) {
              const index = historyItem.getAttribute('data-history-index');
              const historyData = userHistoryCache[index];
              if (historyData) {
                  showHistoryDetail(historyData);
              }
          }
      });
  }

  // Initialize auth state
  checkAuthState();
});