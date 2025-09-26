const BACKEND_URL = 'https://sheets-proxy-backend.onrender.com';
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/dr-afif/hsaas-oncallroster/main/snapshot.json';
 
// replace with your repo path

const now = new Date();
const today = new Date(now);
if (now.getHours() < 8) {
  today.setDate(today.getDate() - 1);
}
const formattedDate = today.toLocaleDateString('en-MY', {
  weekday: 'long',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});
document.querySelector('#header-date').innerHTML += `<br><small style="font-weight: normal;">${formattedDate}</small>`;

function formatTodayAsDDMMYYYY() {
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const LOADING_TIMEOUT_MS = 60000;

function showLoading(timeoutMessage = null) {
  const container = document.getElementById('doctor-list');
  container.innerHTML = `
    <div class="loader-wrapper" style="display:flex;justify-content:center;align-items:center;height:60vh;">
      <!-- From Uiverse.io by Nawsome -->
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

  if (timeoutMessage) {
    setTimeout(() => {
      const stillLoading = container.querySelector('.loader');
      if (stillLoading) {
        container.innerHTML = `<p style="text-align:center;">⚠️ ${timeoutMessage}</p>`;
      }
    }, LOADING_TIMEOUT_MS);
  }
}

function getCachedData(key) {
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    const parsed = JSON.parse(item);
    const age = Date.now() - parsed.timestamp;
    if (age > 86400000) { // 24 hours
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setCachedData(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

function updateLastUpdatedTime() {
  const footer = document.getElementById('last-updated');
  const time = new Date().toLocaleString('en-MY');
  footer.textContent = `Last updated: ${time}`;
}

async function fetchSheetData(endpoint) {
  try {
    const res = await fetch(`${BACKEND_URL}/${endpoint}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch error for ${endpoint}`);
    const data = await res.json();
    return data.values || [];
  } catch (err) {
    console.error(`Error fetching ${endpoint}:`, err);
    return null;
  }
}

// --- NEW: Load snapshot.json as fallback ---
// --- Update your fetchSnapshotData function ---
async function fetchSnapshotData() {
  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Snapshot not found");
    const snapshot = await res.json();
    
    // Extract the raw data from the snapshot
    return {
      timetable: snapshot.timetable?.values || [],
      contacts: snapshot.contacts?.values || []
    };
  } catch (err) {
    console.error("Error fetching snapshot.json:", err);
    return null;
  }
}

async function loadDashboard() {
  showLoading("Loading snapshot data...");

  const container = document.getElementById('doctor-list');
  if (!container) return;

  const todayStr = formatTodayAsDDMMYYYY();
  const cached = getCachedData(todayStr);
  if (cached) {
    renderDashboard(cached.timetable, cached.contacts);
    document.getElementById("data-source").textContent = "💾 Data Source: Local Cache";
  }

  // 1. Try snapshot first (fast load if available)
  const snapshot = await fetchSnapshotData();
  if (snapshot && snapshot.timetable && snapshot.contacts) {
    renderDashboard(snapshot.timetable, snapshot.contacts);
    document.getElementById("data-source").textContent = "📂 Data Source: Snapshot (GitHub)";
  }

  // 2. Backend refresh disabled to limit server requests (kept for future use).
//   try {
//     const [timetable, contacts] = await Promise.all([
//       fetchSheetData('timetable'),
//       fetchSheetData('contacts')
//     ]);
// 
//     if (timetable && contacts) {
//       setCachedData(todayStr, { timetable, contacts });
//       renderDashboard(timetable, contacts);
//       updateLastUpdatedTime();
//       document.getElementById("data-source").textContent = "🌐 Data Source: Live Backend";
//     } else {
//       console.warn("Backend fetch failed, keeping snapshot/cache.");
//     }
//   } catch (err) {
//     console.error("Backend fetch error:", err);
//     // fallback already shown (snapshot or cache)
//   }
}



function renderDashboard(timetable, contacts) {
  const container = document.getElementById('doctor-list');
  container.style.opacity = 0; // start fade

  setTimeout(() => {
    container.innerHTML = buildDashboardHTML(timetable, contacts);
    container.style.transition = 'opacity 0.4s ease';
    container.style.opacity = 1; // fade in
  }, 100);
}

function buildDashboardHTML(timetable, contacts) {
  const todayStr = formatTodayAsDDMMYYYY();
  const headers = timetable[0].slice(1);
  const todayRow = timetable.find(row => row[0] === todayStr);
  if (!todayRow) return `<p>No on-call schedule found for today (${todayStr}).</p>`;

  const contactsMap = {};
  if (contacts.length > 0) {
    const headerRow = contacts[0];
    for (let i = 0; i < headerRow.length; i += 2) {
      const nameHeader = headerRow[i];
      const phoneHeader = headerRow[i + 1];
      if (!nameHeader || !phoneHeader) continue;

      const deptMatch = nameHeader.match(/^(.+?)\s+NAME$/i);
      if (!deptMatch) continue;

      const dept = deptMatch[1].trim().toUpperCase();
      if (!contactsMap[dept]) contactsMap[dept] = {};

      for (let j = 1; j < contacts.length; j++) {
        const row = contacts[j];
        const name = row[i]?.trim();
        const phone = row[i + 1]?.trim();
        if (name && phone) {
          contactsMap[dept][name] = phone;
        }
      }
    }
  }

  const grouped = {};
  headers.forEach((dept, i) => {
    const cell = todayRow[i + 1];
    if (!cell) return;

    const doctors = cell.split(/\r?\n/).map(d => d.trim()).filter(Boolean);
    if (!doctors.length) return;

    const parts = dept.split(' ');
    const main = parts[0].toUpperCase();
    const sub = dept.slice(main.length).trim() || 'General';

    if (!grouped[main]) grouped[main] = {};
    if (!grouped[main][sub]) grouped[main][sub] = [];

    doctors.forEach(name => {
      const phone = (contactsMap[main] && contactsMap[main][name]) || 'Unknown';
      grouped[main][sub].push({ name, phone });
    });
  });

  let html = '';
  Object.entries(grouped).forEach(([mainDept, subGroups]) => {
    html += `<div class="doctor-card"><h2 style="text-align:center;">${mainDept}</h2>`;
    Object.entries(subGroups).forEach(([subDept, doctors]) => {
      if (subDept !== 'General') {
        html += `<h3 style="margin-top: 12px; margin-bottom: 6px;">${subDept}</h3>`;
      }
      doctors.forEach(({ name, phone }) => {
        const tel = phone !== 'Unknown' ? `tel:${phone}` : '#';
        const wa = phone !== 'Unknown' ? `https://wa.me/6${phone.replace(/\D/g, '')}` : '#';
        html += `
          <div class="doctor-row">
            <div class="doctor-info">
              <strong>${name}</strong>
              <span>${phone}</span>
            </div>
            <div class="contact-icons">
              <a href="${tel}" title="Call ${name}" class="icon-link">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#4CAF50" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.11-.21c1.2.48 2.5.74 3.83.74a1 1 0 011 1v3.5a1 1 0 01-1 1A17.91 17.91 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.33.26 2.63.74 3.83a1 1 0 01-.21 1.11l-2.41 2.41z"/>
                </svg>
              </a>
              <a href="${wa}" title="WhatsApp ${name}" class="icon-link" target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 00-8.64 15.22L2 22l4.95-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.2-1.2l-.3-.2-2.9.8.8-2.9-.2-.3A8 8 0 1112 20zm4.47-5.73c-.26-.13-1.53-.75-1.77-.83s-.41-.13-.58.13-.66.83-.81 1-.3.2-.56.07a6.56 6.56 0 01-1.94-1.2 7.24 7.24 0 01-1.34-1.67c-.14-.25 0-.39.1-.52s.25-.3.37-.46a1.7 1.7 0 00.25-.42.48.48 0 00-.02-.45c-.07-.13-.57-1.36-.78-1.86s-.42-.43-.57-.44h-.48a.92.92 0 00-.67.32A2.79 2.79 0 006.5 9.4a4.85 4.85 0 00.28 1.7c.3.8.9 1.55 1 1.66s1.92 2.9 4.63 3.87a5.33 5.33 0 002.45.5 2.28 2.28 0 001.5-.7 1.9 1.9 0 00.42-1.32c-.06-.12-.24-.2-.5-.34z"/>
                </svg>
              </a>
            </div>
          </div>
        `;
      });
    });
    html += `</div>`;
  });

  return html || '<p>No doctors on-call today.</p>';
}

document.addEventListener('DOMContentLoaded', loadDashboard);

/*
// -----------------------------
// Background prefetch contacts
// -----------------------------
async function preloadContacts() {
  try {
    const res = await fetch('https://sheets-proxy-backend.onrender.com/contacts', { cache: "no-store" });
    if (!res.ok) throw new Error('Failed to fetch contacts for preloading');
    const data = await res.json();
    window.contactsCache = data; // store for later use
    console.log('Contacts preloaded in background');
  } catch (err) {
    console.warn('Background contacts preload failed:', err);
  }
}

preloadContacts(); // start preloading silently

// Listen for SW update message
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'UPDATE_AVAILABLE') {
      showUpdateToast();
    }
  });
}

// -----------------------------
// Background preload contacts for SPA feel
// -----------------------------
async function preloadContacts() {
  try {
    const res = await fetch('https://sheets-proxy-backend.onrender.com/contacts', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to preload contacts');
    const data = await res.json();
    window.contactsCache = data; // store globally for contacts page
    console.log('Contacts preloaded in background');
  } catch (err) {
    console.error('Background preload failed:', err);
  }
}

// Call preload after dashboard loads
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  preloadContacts();
});


*/

function showUpdateToast() {
  const toast = document.createElement('div');
  toast.textContent = '🔄 App updated to latest version';
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = '#323232';
  toast.style.color = '#fff';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '1000';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.5s ease';
  document.body.appendChild(toast);
  setTimeout(() => toast.style.opacity = '1', 50);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
