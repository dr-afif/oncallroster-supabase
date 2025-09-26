// -----------------------------
// contacts.js - Fixed Version
// -----------------------------

// Backend + snapshot URLs
const SHEET_URL = 'https://sheets-proxy-backend.onrender.com/contacts';
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/dr-afif/hsaas-oncallroster/main/contacts-snapshot.json';

const LOADING_TIMEOUT_MS = 60000;

// Place this near your other utility/date functions

function formatTimestampAsDDMMYYYY(timestamp, withTime = false) {
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (withTime) {
    const timeStr = date.toLocaleTimeString('en-MY');
    return `${dd}/${mm}/${yyyy} ${timeStr}`;
  }
  return `${dd}/${mm}/${yyyy}`;
}

// -----------------------------
// Loading animation
// -----------------------------
function showLoading(timeoutMessage = null) {
  const container = document.getElementById('departments');
  container.innerHTML = `
    <div class="loader-wrapper" style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:50vh;">
      <div class="loader">
        <div>
          <ul>
            ${Array(7).fill(`
              <li>
                <svg fill="currentColor" viewBox="0 0 90 120">
                  <path d="M90,0 L90,120 L11,120 C4.9,120 0,115.07 0,109 L0,11 C0,4.92 4.92,0 11,0 L90,0 Z 
                  M71.5,81 L18.5,81 C17.12,81 16,82.12 16,83.5 C16,84.83 17.03,85.91 18.34,85.99 
                  L18.5,86 L71.5,86 C72.88,86 74,84.88 74,83.5 C74,82.17 72.97,81.09 71.66,81.00 L71.5,81 Z 
                  M71.5,57 L18.5,57 C17.12,57 16,58.12 16,59.5 C16,60.82 17.03,61.91 18.34,61.99 
                  L18.5,62 L71.5,62 C72.88,62 74,60.88 74,59.5 C74,58.12 72.88,57 71.5,57 Z 
                  M71.5,33 L18.5,33 C17.12,33 16,34.12 16,35.5 C16,36.82 17.03,37.91 18.34,37.99 
                  L18.5,38 L71.5,38 C72.88,38 74,36.88 74,35.5 C74,34.12 72.88,33 71.5,33 Z"></path>
                </svg>
              </li>
            `).join('')}
          </ul>
        </div>
        <span>Loading</span>
      </div>
    </div>
  `;

  // Set timeout to show error message if loading takes too long
  let timeoutId = null;
  if (timeoutMessage) {
    timeoutId = setTimeout(() => {
      const stillLoading = container.querySelector('.loader');
      if (stillLoading) {
        container.innerHTML = `<p style="text-align:center;">⚠️ ${timeoutMessage}</p>`;
      }
    }, LOADING_TIMEOUT_MS);
  }

  // Store timeout ID so we can clear it later
  container.timeoutId = timeoutId;
}

// -----------------------------
// LocalStorage caching (similar to index.js)
// -----------------------------
function getCachedData(key) {
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    const parsed = JSON.parse(item);
    const age = Date.now() - parsed.timestamp;
    if (age > 86400000) { // 24h
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setCachedData(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

// -----------------------------
// Process raw contact data from spreadsheet format
// -----------------------------
function processRawContacts(rawData) {
  if (!rawData || !rawData.length) return [];
  
  const headers = rawData[0]; // First row contains headers
  const contacts = [];
  
  // Process each data row
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Process pairs of columns (name, phone)
    for (let j = 0; j < headers.length; j += 2) {
      const nameHeader = headers[j];
      const name = row[j]?.trim();
      const phone = row[j + 1]?.trim();
      
      if (name && phone && nameHeader) {
        // Extract department from header like "RESQ NAME"
        const deptMatch = nameHeader.match(/^(.+?)\s+NAME$/i);
        if (deptMatch) {
          contacts.push({
            name: name,
            phone: phone,
            department: deptMatch[1].trim().toUpperCase()
          });
        }
      }
    }
  }
  
  return contacts;
}

// -----------------------------
// Fetch contacts (similar structure to index.js)
// -----------------------------
async function fetchContacts() {
  showLoading("Loading contacts snapshot... please check your connection if this takes too long.");
  
  const container = document.getElementById('departments');
  if (!container) return;

  // 1. Check cache first (but don't return early - just display while fetching fresh data)
  const cached = getCachedData('contactsData');
  if (cached) {
    renderDepartments(cached.data);
    updateDataSource(`💾 Data Source: Cached (${formatTimestampAsDDMMYYYY(cached.timestamp).toLocaleString()})`);
  }

  // 2. Try snapshot fallback
  let snapshotUsed = false;
  try {
    const snapshotRes = await fetch(SNAPSHOT_URL);
    if (snapshotRes.ok) {
      const snapshotData = await snapshotRes.json();
      
      // Handle different data structures
      let contacts;
      if (snapshotData.values) {
        // Raw spreadsheet format
        contacts = processRawContacts(snapshotData.values);
      } else {
        // Already processed format
        contacts = snapshotData.contacts || snapshotData;
      }
      
      if (contacts && contacts.length > 0) {
        // Clear timeout since we got data
        if (container.timeoutId) {
          clearTimeout(container.timeoutId);
        }
        
        renderDepartments(contacts);
        updateDataSource("📂 Data Source: Snapshot (GitHub)");
        setCachedData('contactsData', contacts);
        snapshotUsed = true;
      }
    }
  } catch (e) {
    console.warn("Snapshot fetch failed:", e);
  }

  // 3. Backend refresh disabled to limit server requests (kept for future use).
//  try {
//    const res = await fetch(SHEET_URL);
//    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//    
//    const data = await res.json();
//    
//    // Handle different response structures
//    let contacts;
//    if (data.values) {
//      // Raw spreadsheet format from backend
//      contacts = processRawContacts(data.values);
//    } else {
//      // Pre-processed format
//      contacts = data.contacts || data;
//    }
//    
//    if (contacts && contacts.length > 0) {
//      // Clear timeout since we got fresh data
//      if (container.timeoutId) {
//        clearTimeout(container.timeoutId);
//      }
//      
//      renderDepartments(contacts);
//      updateDataSource(`🌐 Data Source: Live Backend (${formatTimestampAsDDMMYYYY(Date.now(), true)})`);
//      setCachedData('contactsData', contacts);
//    }
//  } catch (error) {
//    console.error('Live backend fetch failed:', error);
//    
//    if (!snapshotUsed && !cached) {
//      // No fallback data available
//      if (container.timeoutId) {
//        clearTimeout(container.timeoutId);
//      }
//      container.innerHTML = `
//        <div style="text-align:center; padding: 2rem;">
//          <p>⚠️ Unable to load contacts</p>
//          <p style="font-size: 0.9em; color: #666; margin-top: 0.5rem;">
//            Please check your internet connection and try again.
//          </p>
//          <button onclick="fetchContacts()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
//            Retry
//          </button>
//        </div>
//      `;
//      updateDataSource("❌ Failed to load");
//    }
//  }
  if (!snapshotUsed && !cached) {
    if (container.timeoutId) {
      clearTimeout(container.timeoutId);
    }
    container.innerHTML = `
      <div style="text-align:center; padding: 2rem;">
        <p>Warning: Unable to load contacts</p>
        <p style="font-size: 0.9em; color: #666; margin-top: 0.5rem;">
          Please check your internet connection and try again.
        </p>
        <button onclick="fetchContacts()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
    updateDataSource("Warning: Failed to load");
  }

}

// -----------------------------
// Update data source status
// -----------------------------
function updateDataSource(message) {
  const el = document.getElementById('data-source-b');
  if (el) el.innerHTML = message;
}

// -----------------------------
// Render departments and contacts (enhanced for better UX)
// -----------------------------
function renderDepartments(contacts) {
  const container = document.getElementById('departments');
  
  // Clear timeout if still running
  if (container.timeoutId) {
    clearTimeout(container.timeoutId);
  }
  
  // Fade out current content
  container.style.opacity = 0;
  container.style.transition = 'opacity 0.3s ease';

  setTimeout(() => {
    if (!contacts || contacts.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 2rem;">No contacts available.</p>';
      container.style.opacity = 1;
      return;
    }

    // Group contacts by department
    const deptMap = {};
    contacts.forEach(contact => {
      const dept = contact.department || 'OTHER';
      if (!deptMap[dept]) deptMap[dept] = [];
      deptMap[dept].push(contact);
    });

    // Sort departments alphabetically
    const sortedDepts = Object.keys(deptMap).sort();
    
    let html = '';
    
    sortedDepts.forEach(dept => {
      const deptContacts = deptMap[dept];
      
      html += `
        <div class="department">
          <div class="department-header" onclick="toggleDepartment(this)">
            <span>${dept} (${deptContacts.length})</span>
            <span class="toggle-icon">▼</span>
          </div>
          <div class="contacts-list" style="display: none;">
      `;
      
      // Sort contacts within department by name
      deptContacts.sort((a, b) => a.name.localeCompare(b.name));
      
      deptContacts.forEach(contact => {
        const cleanPhone = contact.phone.replace(/\D/g, '');
        const telLink = `tel:${contact.phone.replace(/\s+/g, '')}`;
        const waLink = `https://wa.me/6${cleanPhone}`;

        html += `
          <div class="contact-item">
            <span class="contact-name">${contact.name}</span>
            <div class="contact-icons">
              <a href="${telLink}" title="Call ${contact.name}" class="icon-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#4CAF50" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.83.74a1 1 0 011 1v3.5a1 1 0 01-1 1A17.91 17.91 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.33.26 2.63.74 3.83a1 1 0 01-.21 1.11l-2.41 2.41z"/>
                </svg>
              </a>
              <a href="${waLink}" title="WhatsApp ${contact.name}" class="icon-link" target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 00-8.64 15.22L2 22l4.95-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.2-1.2l-.3-.2-2.9.8.8-2.9-.2-.3A8 8 0 1112 20zm4.47-5.73c-.26-.13-1.53-.75-1.77-.83s-.41-.13-.58.13-.66.83-.81 1-.3.2-.56.07a6.56 6.56 0 01-1.94-1.2 7.24 7.24 0 01-1.34-1.67c-.14-.25 0-.39.1-.52s.25-.3.37-.46a1.7 1.7 0 00.25-.42.48.48 0 00-.02-.45c-.07-.13-.57-1.36-.78-1.86s-.42-.43-.57-.44h-.48a.92.92 0 00-.67.32A2.79 2.79 0 006.5 9.4a4.85 4.85 0 00.28 1.7c.3.8.9 1.55 1 1.66s1.92 2.9 4.63 3.87a5.33 5.33 0 002.45.5 2.28 2.28 0 001.5-.7 1.9 1.9 0 00.42-1.32c-.06-.12-.24-.2-.5-.34z"/>
                </svg>
              </a>
            </div>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.style.opacity = 1;
  }, 100);
}

// -----------------------------
// Toggle department visibility
// -----------------------------
function toggleDepartment(headerElement) {
  const contactsList = headerElement.nextElementSibling;
  const toggleIcon = headerElement.querySelector('.toggle-icon');
  
  if (contactsList.style.display === 'none') {
    contactsList.style.display = 'block';
    toggleIcon.textContent = '▲';
    headerElement.classList.add('expanded');
  } else {
    contactsList.style.display = 'none';
    toggleIcon.textContent = '▼';
    headerElement.classList.remove('expanded');
  }
}

// -----------------------------
// Update header date (similar to index.js)
// -----------------------------
function updateHeaderDate() {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  const dateElement = document.getElementById('header-date');
  if (dateElement) {
    dateElement.innerHTML = `<br><small style="font-weight: normal;">${formattedDate}</small>`;
  }
}

// -----------------------------
// Initialize page
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  fetchContacts();
});

// Handle page visibility change (refresh data when page becomes visible)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Page is now visible, refresh if data is old
    const cached = getCachedData('contactsData');
    if (!cached || (Date.now() - cached.timestamp) > 3600000) { // 1 hour
      fetchContacts();
    }
  }
});

