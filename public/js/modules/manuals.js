// Manuals Module for HVAC Troubleshooting App
import { showLoader, hideLoader, showNotification } from './ui.js';
import { getManuals, uploadManual, deleteManual as deleteManualAPI } from './api.js';

const manualsContainer = document.getElementById('manuals-container');
const noManualsDiv = document.getElementById('no-manuals');
const desktopSearch = document.getElementById('manual-search-desktop');
const mobileSearch = document.getElementById('manual-search-mobile');
const modalSearch = document.getElementById('manual-search-modal');
const categoryFilter = document.getElementById('category-filter');
const uploadModal = document.getElementById('upload-modal');
const manualFileInput = document.getElementById('manual-file');

let allManuals = []; // Cache for all manuals
let currentPage = 1;
const itemsPerPage = 6;

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createManualCard(manual) {
  const uploadDate = new Date(manual.uploadDate).toLocaleDateString();
  return `
    <div class="manual-card" data-id="${manual._id}">
      <div class="manual-card-header">
        <i class="fas fa-file-pdf manual-icon"></i>
        <div class="manual-info">
          <div class="manual-title">${manual.title}</div>
          <span class="manual-category">${manual.category.replace('-', ' ')}</span>
        </div>
      </div>
      <div class="manual-description">${manual.description}</div>
      <div class="manual-meta">
        <span>Uploaded: ${uploadDate}</span>
        <div class="manual-actions">
          <button class="btn btn-small" onclick="viewManual('${manual.filePath}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-small btn-danger" onclick="deleteManual('${manual._id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `;
}

function createManualListItem(manual) {
  const uploadDate = new Date(manual.uploadDate).toLocaleDateString();
  return `
    <div class="manual-list-item" data-id="${manual._id}">
      <i class="fas fa-file-pdf manual-list-icon"></i>
      <div class="manual-list-info">
        <div class="manual-list-title">${manual.title}</div>
        <div class="manual-list-meta">
          ${manual.category.replace('-', ' ')} • ${uploadDate} • ${formatFileSize(manual.fileSize)}
        </div>
      </div>
      <div class="manual-list-actions">
        <button class="btn btn-small" onclick="viewManual('${manual.filePath}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-small btn-danger" onclick="deleteManual('${manual._id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

export async function displayManuals() {
  showLoader();
  try {
    // Fetch all manuals only if the cache is empty
    if (allManuals.length === 0) {
      allManuals = await getManuals('', '');
    }

    const searchQuery = manualSearch ? manualSearch.value.toLowerCase() : '';
    const category = categoryFilter ? categoryFilter.value : '';

    const filteredManuals = allManuals.filter(manual => {
      const titleMatch = manual.title.toLowerCase().includes(searchQuery);
      const descriptionMatch = manual.description.toLowerCase().includes(searchQuery);
      const categoryMatch = category ? manual.category === category : true;
      return (titleMatch || descriptionMatch) && categoryMatch;
    });

    const isGridView = manualsContainer && manualsContainer.classList.contains('manuals-grid');

    if (manualsContainer) {
        if (filteredManuals.length === 0) {
            manualsContainer.innerHTML = '';
            manualsContainer.style.display = 'none';
            if (noManualsDiv) noManualsDiv.classList.remove('hidden');
        } else {
            manualsContainer.style.display = isGridView ? 'grid' : 'block';
            if (noManualsDiv) noManualsDiv.classList.add('hidden');
        }
    }

    renderPagination(filteredManuals.length, 'pagination-container');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedManuals = filteredManuals.slice(startIndex, endIndex);

    if (manualsContainer) {
      manualsContainer.innerHTML = paginatedManuals.map(manual =>
        isGridView ? createManualCard(manual) : createManualListItem(manual)
      ).join('');
    }

  } catch (error) {
    showNotification(error.message, 'error');
    if (manualsContainer) {
      manualsContainer.innerHTML = '<p>Could not load manuals. Please try again later.</p>';
    }
  } finally {
    hideLoader();
  }
}

export async function handleManualUpload() {
  const form = document.getElementById('upload-form');
  const formData = new FormData(form);
  const file = manualFileInput.files[0];

  if (!formData.get('title') || !formData.get('category') || !file) {
    showNotification('Please fill in all required fields and select a file.', 'error');
    return;
  }

  showLoader();
  try {
    await uploadManual(formData);
    uploadModal.style.display = 'none';
    form.reset();
    displayManuals();
    showNotification('Manual uploaded successfully!');
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    hideLoader();
  }
}

export async function deleteManual(id) {
  if (confirm('Are you sure you want to delete this manual?')) {
    showLoader();
    try {
      await deleteManualAPI(id);
      displayManuals();
      showNotification('Manual deleted successfully!');
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      hideLoader();
    }
  }
}

function renderPagination(totalItems, containerId) {
  const paginationContainer = document.getElementById(containerId);
  if (!paginationContainer) return;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  paginationContainer.innerHTML = '';

  if (totalPages <= 1) return;

  // Previous Button
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&laquo;';
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayManuals();
    }
  });
  paginationContainer.appendChild(prevButton);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageButton = document.createElement('button');
    pageButton.textContent = i;
    pageButton.classList.toggle('active', i === currentPage);
    pageButton.addEventListener('click', () => {
      currentPage = i;
      displayManuals();
    });
    paginationContainer.appendChild(pageButton);
  }

  // Next Button
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '&raquo;';
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      displayManuals();
    }
  });
  paginationContainer.appendChild(nextButton);
}

export function viewManual(filePath) {
  window.open(`/${filePath}`, '_blank');
}

export function getManualsCache() {
  return allManuals;
}
