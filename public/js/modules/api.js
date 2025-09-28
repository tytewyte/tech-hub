// API Module for HVAC Troubleshooting App

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['x-auth-token'] = token;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

export const getTroubleshootingFlows = () => fetchWithAuth('/api/troubleshooting-flows');

export const searchKnowledgeBase = (query) => fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`);

export const submitTroubleshooting = (data) => fetchWithAuth('/api/troubleshoot', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const getManuals = (category, search) => fetchWithAuth(`/api/manuals?category=${category}&search=${search}`);

export const uploadManual = (formData) => fetchWithAuth('/api/upload-manual', {
  method: 'POST',
  body: formData,
});

export const deleteManual = (id) => fetchWithAuth(`/api/manuals/${id}`, {
  method: 'DELETE',
});
