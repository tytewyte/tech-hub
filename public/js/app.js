import { showNotification, showLoader, hideLoader } from './modules/ui.js';
import * as api from './modules/api.js';
import { loader } from './utils/lazy-loader.js';

// Make functions globally available for inline event handlers in HTML
window.viewManual = async (filePath) => {
  try {
    const ManualViewer = await loader.load('ManualViewer');
    ManualViewer.view(filePath);
  } catch (error) {
    console.error('Error loading ManualViewer:', error);
    showNotification('Error loading viewer', 'error');
  }
};

window.downloadManual = async (id) => {
  try {
    const manuals = getManualsCache();
    if (!manuals || !Array.isArray(manuals)) {
      console.error('Manuals cache is not available or not an array');
      showNotification('No manuals available', 'error');
      return;
    }
    const manual = manuals.find(m => m && m.id === id);
    if (manual && manual.filePath) {
      const link = document.createElement('a');
      link.href = `/${manual.filePath}`;
      link.download = manual.title || 'manual';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error('Manual not found for id:', id);
      showNotification('Manual not found', 'error');
    }
  } catch (error) {
    console.error('Error downloading manual:', error);
    showNotification('Error downloading manual', 'error');
  }
};
window.deleteManual = async (id) => {
  if (confirm('Are you sure you want to delete this manual?')) {
    showLoader();
    try {
      await api.deleteManual(id);
      displayManuals();
      showNotification('Manual deleted successfully!');
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      hideLoader();
    }
  }
};

// Import Redux store and Provider
import store from './store/store.js';

document.addEventListener('DOMContentLoaded', () => {
  console.time('DOMContentLoaded handler');

  // DOM Elements selection with null checks
  const navLinks = document.querySelectorAll('nav a');
  const pages = document.querySelectorAll('.page');
  const startTroubleshootingBtn = document.getElementById('start-troubleshooting');
  const submitIssueBtn = document.getElementById('submit-issue');
  const aiResponseSection = document.getElementById('ai-response');
  const responseContent = document.querySelector('.response-content');
  const feedbackBtn = document.getElementById('feedback-btn');
  const feedbackModal = document.getElementById('feedback-modal');
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackSuccess = document.getElementById('feedback-success');
  const modalCloseButtons = document.querySelectorAll('.modal .close');
  const manualsContainer = document.getElementById('manage-manuals-container') || document.getElementById('manuals-container');
  const noManualsDiv = document.getElementById('no-manuals');
  const desktopSearch = document.getElementById('manual-search-desktop');
  const mobileSearch = document.getElementById('manual-search-mobile');
  const categoryFilter = document.getElementById('category-filter');
  const uploadReferenceBtn = document.getElementById('upload-reference');
  const downloadAllBtn = document.getElementById('download-all');
  const printLibraryBtn = document.getElementById('print-library');
  const uploadModal = document.getElementById('upload-modal');
  const referenceModal = document.getElementById('reference-modal');
  const referenceTitle = document.getElementById('reference-title');
  const referenceContent = document.getElementById('reference-content');
  const closeReferenceBtn = document.getElementById('close-reference');
  const printReferenceBtn = document.getElementById('print-reference');
  const closeManualsBtn = document.getElementById('close-manuals-btn');
  const manualFileInput = document.getElementById('manual-file');
  const uploadSubmitBtn = document.getElementById('upload-submit');
  const uploadCancelBtn = document.getElementById('upload-cancel');
  const gridViewBtn = document.getElementById('grid-view');
  const listViewBtn = document.getElementById('list-view');
  const manageManualsModal = document.getElementById('manage-manuals-modal');
  const manageManualSearch = document.getElementById('manage-manual-search');
  const manageCategoryFilter = document.getElementById('manage-category-filter');
  const manageGridViewBtn = document.getElementById('manage-grid-view');
  const manageListViewBtn = document.getElementById('manage-list-view');
  const kbSearchInput = document.getElementById('kb-search');

  console.timeEnd('DOMContentLoaded handler');

  // Navigation functionality
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const pageId = link.getAttribute('data-page');
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        link.classList.add('active');
        pages.forEach(page => {
          if (page.id === `${pageId}-page`) {
            page.classList.add('active');
          } else {
            page.classList.remove('active');
          }
        });
      } catch (error) {
        console.error('Navigation error:', error);
      }
    });
  });

  // Start Troubleshooting Button
  if (startTroubleshootingBtn) {
    startTroubleshootingBtn.addEventListener('click', () => {
      try {
        navLinks.forEach(navLink => navLink.classList.remove('active'));
        const troubleshootLink = document.querySelector('nav a[data-page="troubleshoot"]');
        if (troubleshootLink) troubleshootLink.classList.add('active');
        pages.forEach(page => {
          if (page.id === 'troubleshoot-page') {
            page.classList.add('active');
          } else {
            page.classList.remove('active');
          }
        });
      } catch (error) {
        console.error('Start troubleshooting error:', error);
      }
    });
  }

  // Submit Issue Button
  if (submitIssueBtn) {
    submitIssueBtn.addEventListener('click', async () => {
      try {
        const issueDescription = document.getElementById('issue-description')?.value || '';
        const systemType = document.getElementById('system-type')?.value || '';
        const symptoms = Array.from(document.querySelectorAll('input[name="symptom"]:checked')).map(cb => cb.value);
        
        const response = await fetch('/.netlify/functions/troubleshoot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue: issueDescription, systemType, symptoms })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (aiResponseSection) aiResponseSection.classList.remove('hidden');
          if (responseContent) responseContent.innerHTML = `<p>${data.response}</p><p><strong>Safety:</strong> ${data.safetyWarning}</p>`;
        } else {
          throw new Error('API error');
        }
      } catch (error) {
        console.error('Submit issue error:', error);
        if (responseContent) responseContent.innerHTML = '<p>Failed to get response. Please try again.</p>';
      }
    });
  }

  // Feedback Button
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', () => {
      try {
        if (feedbackModal) feedbackModal.classList.remove('hidden');
      } catch (error) {
        console.error('Feedback modal error:', error);
      }
    });
  }

  // Modal Close Buttons
  modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        btn.closest('.modal').classList.add('hidden');
      } catch (error) {
        console.error('Modal close error:', error);
      }
    });
  });

  // Upload Modal Buttons
  if (uploadReferenceBtn) {
    uploadReferenceBtn.addEventListener('click', () => {
      try {
        if (uploadModal) uploadModal.style.display = 'block';
      } catch (error) {
        console.error('Upload modal open error:', error);
      }
    });
  }

  if (uploadSubmitBtn) {
    uploadSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleManualUpload();
    });
  }

  if (uploadCancelBtn) {
    uploadCancelBtn.addEventListener('click', () => {
      try {
        if (uploadModal) uploadModal.style.display = 'none';
        resetUploadForm();
      } catch (error) {
        console.error('Upload cancel error:', error);
      }
    });
  }

  // Download and Print Buttons
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', () => {
      try {
        if (manageManualsModal) manageManualsModal.style.display = 'block';
        displayManuals();
      } catch (error) {
        console.error('Download all error:', error);
      }
    });
  }

  if (printLibraryBtn) {
    printLibraryBtn.addEventListener('click', () => {
      try {
        window.print();
      } catch (error) {
        console.error('Print library error:', error);
      }
    });
  }

  // Reference Modal Buttons
  if (closeReferenceBtn) {
    closeReferenceBtn.addEventListener('click', closeReferenceModal);
  }

  if (printReferenceBtn) {
    printReferenceBtn.addEventListener('click', () => {
      try {
        const printWindow = window.open('', '_blank');
        const content = referenceContent?.innerHTML || '';
        const title = referenceTitle?.textContent || 'Reference';
        printWindow.document.write(`
          <html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:20px;}h3{color:#0077cc;}ul{margin-left:20px;}</style></head>
          <body><h1>${title}</h1>${content}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
      } catch (error) {
        console.error('Print reference error:', error);
      }
    });
  }

  // View Toggle Buttons
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      try {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        if (manualsContainer) manualsContainer.className = 'manuals-grid';
        displayManuals();
      } catch (error) {
        console.error('Grid view error:', error);
      }
    });
    listViewBtn.addEventListener('click', () => {
      try {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        if (manualsContainer) manualsContainer.className = 'manuals-list';
        displayManuals();
      } catch (error) {
        console.error('List view error:', error);
      }
    });
  }

  // Search and Filter Inputs
  if (desktopSearch) {
    desktopSearch.addEventListener('input', () => displayManuals());
  }
  if (mobileSearch) {
    mobileSearch.addEventListener('input', () => displayManuals());
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', displayManuals);
  }
  if (kbSearchInput) {
    kbSearchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length > 1) searchKnowledgeBase(val);
      else displaySearchResults([]);
    });
  }

  // Manage Manuals Modal Controls
  if (closeManualsBtn) {
    closeManualsBtn.addEventListener('click', () => {
      try {
        if (manageManualsModal) manageManualsModal.style.display = 'none';
      } catch (error) {
        console.error('Close manuals error:', error);
      }
    });
  }

  if (manageManualSearch) {
    manageManualSearch.addEventListener('input', displayManuals);
  }
  if (manageCategoryFilter) {
    manageCategoryFilter.addEventListener('change', displayManuals);
  }
  if (manageGridViewBtn && manageListViewBtn) {
    manageGridViewBtn.addEventListener('click', () => {
      try {
        manageGridViewBtn.classList.add('active');
        manageListViewBtn.classList.remove('active');
        if (manualsContainer) manualsContainer.className = 'manuals-grid';
        displayManuals();
      } catch (error) {
        console.error('Manage grid view error:', error);
      }
    });
    manageListViewBtn.addEventListener('click', () => {
      try {
        manageListViewBtn.classList.add('active');
        manageGridViewBtn.classList.remove('active');
        if (manualsContainer) manualsContainer.className = 'manuals-list';
        displayManuals();
      } catch (error) {
        console.error('Manage list view error:', error);
      }
    });
  }

  // Load initial data
  loadTroubleshootingFlows();
  displayManuals();

  // Function Definitions
  async function loadTroubleshootingFlows() {
    try {
      const response = await fetch('/api/troubleshooting-flows');
      const data = await response.json();
      console.log('Loaded flows:', data.flows);
    } catch (error) {
      console.error('Failed to load flows:', error);
    }
  }

  async function searchKnowledgeBase(query) {
    try {
      const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      displaySearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      displaySearchResults([]);
    }
  }

  function displaySearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;
    container.innerHTML = results.length ? 
      results.map(result => `<div class="result-item">${result.title}</div>`).join('') : 
      '<p>No results found.</p>';
  }

  async function displayManuals() {
    try {
      const response = await fetch('/api/manuals');
      const manuals = await response.json();
      if (manualsContainer) {
        manualsContainer.innerHTML = manuals.map(manual => `
          <div class="manual-card">
            <h4>${manual.title}</h4>
            <p>${manual.description}</p>
          </div>
        `).join('');
      }
      if (noManualsDiv) noManualsDiv.style.display = manuals.length ? 'none' : 'block';
    } catch (error) {
      console.error('Failed to display manuals:', error);
    }
  }

  async function handleManualUpload() {
    const file = manualFileInput?.files[0];
    if (!file) return alert('No file selected.');
    const formData = new FormData();
    formData.append('manual', file);
    try {
      const response = await fetch('/api/upload-manual', { method: 'POST', body: formData });
      if (response.ok) {
        alert('Upload successful.');
        displayManuals();
        if (uploadModal) uploadModal.style.display = 'none';
        resetUploadForm();
      } else {
        alert('Upload failed.');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  }

  function resetUploadForm() {
    if (manualFileInput) manualFileInput.value = '';
    const filePreview = document.getElementById('file-preview');
    if (filePreview) filePreview.innerHTML = '';
  }

  function closeReferenceModal() {
    if (referenceModal) referenceModal.style.display = 'none';
  }
});