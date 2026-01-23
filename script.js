const BACKEND_URL = window.APP_CONFIG?.BACKEND_URL || 'https://sheets-proxy-backend.onrender.com';
const SNAPSHOT_URL = window.APP_CONFIG?.SNAPSHOT_URL || 'https://raw.githubusercontent.com/dr-afif/hsaas-oncallroster/main/snapshot.json';

let currentTimetable = [];
let currentContacts = [];
let cachedContactsMap = {};
let currentViewDate = getInitialDate();
let searchTimeout;
let lastDataHash = ""; // To avoid redundant re-renders

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  loadDashboard();
});

function getInitialDate() {
  const now = new Date();
  if (now.getHours() < 8) now.setDate(now.getDate() - 1);
  return now;
}

function triggerHaptic(duration = 10) {
  if (window.navigator?.vibrate) {
    window.navigator.vibrate(duration);
  }
}

function updateHeaderDate() {
  const formattedDate = currentViewDate.toLocaleDateString('en-MY', {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });
  document.querySelector('#header-date').textContent = formattedDate;

  // Show/Hide "Back to Today" button
  const today = getInitialDate();
  const isToday = currentViewDate.toDateString() === today.toDateString();
  document.getElementById('today-btn').classList.toggle('hidden', isToday);
}

function formatAsDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function changeDate(days) {
  triggerHaptic();
  currentViewDate.setDate(currentViewDate.getDate() + days);
  updateHeaderDate();
  renderDashboard(currentTimetable, currentContacts);
}

function resetToToday() {
  triggerHaptic();
  currentViewDate = getInitialDate();
  updateHeaderDate();
  renderDashboard(currentTimetable, currentContacts);
}

function handleDatePicker(input) {
  if (!input.value) return;
  const [y, m, d] = input.value.split('-');
  currentViewDate = new Date(y, m - 1, d);
  updateHeaderDate();
  renderDashboard(currentTimetable, currentContacts);
}

// --- Data Fetching ---
function showSkeleton() {
  const container = document.getElementById('doctor-list');
  container.innerHTML = Array(3).fill(`
        <div class="doctor-card skeleton-card">
            <div class="skeleton" style="height: 50px; width: 100%;"></div>
            <div style="padding: 1.25rem;">
                <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 1rem;"></div>
                <div class="skeleton" style="height: 60px; width: 100%; border-radius: 12px; margin-bottom: 0.5rem;"></div>
                <div class="skeleton" style="height: 60px; width: 100%; border-radius: 12px;"></div>
            </div>
        </div>
    `).join('');
}

async function fetchSnapshotData() {
  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Snapshot not found");
    return await res.json();
  } catch (err) {
    console.error("Error fetching snapshot.json:", err);
    return null;
  }
}

async function loadDashboard() {
  // 1. Try to load from LocalStorage first for "Instant-On"
  const cachedData = localStorage.getItem('roster_snapshot');
  if (cachedData) {
    try {
      const snapshot = JSON.parse(cachedData);
      processAndRender(snapshot, "📂 Snapshot (Cached)");
      lastDataHash = JSON.stringify(snapshot); // Track what we showed
    } catch (e) {
      console.warn("Failed to parse cached snapshot", e);
    }
  }

  // 2. If no cache, show skeleton
  if (!currentTimetable.length) {
    showSkeleton();
  }

  // 3. Fetch fresh data from cloud
  const freshSnapshot = await fetchSnapshotData();
  if (freshSnapshot) {
    const freshHash = JSON.stringify(freshSnapshot);

    // Only re-render if data actually changed
    if (freshHash !== lastDataHash) {
      processAndRender(freshSnapshot, "📂 Snapshot (Cloud)");
      localStorage.setItem('roster_snapshot', freshHash);
      lastDataHash = freshHash;
    } else {
      document.getElementById("data-source").textContent = "📂 Snapshot (Up to date)";
    }
  } else if (!currentTimetable.length) {
    document.getElementById("doctor-list").innerHTML = '<p class="p-8 text-center text-muted">Failed to load roster. Please check your connection.</p>';
  }
}

function processAndRender(snapshot, sourceLabel) {
  currentTimetable = snapshot.timetable?.values || [];
  currentContacts = snapshot.contacts?.values || [];
  cachedContactsMap = prepareContactsMap(currentContacts);
  renderDashboard(currentTimetable, currentContacts);
  document.getElementById("data-source").textContent = sourceLabel;
  if (snapshot.last_updated) {
    document.getElementById("last-updated").textContent = `Last sync: ${snapshot.last_updated}`;
  }
}

// --- Search & Filtering ---
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = document.getElementById('global-search-input').value.toLowerCase();
    renderDashboard(currentTimetable, currentContacts, query);
  }, 150); // 150ms debounce
}

// --- Rendering Logic ---
function renderDashboard(timetable, contacts, query = '') {
  const container = document.getElementById('doctor-list');
  const html = buildDashboardHTML(timetable, contacts, query);
  container.innerHTML = html;
}

function buildDashboardHTML(timetable, contacts, query = '') {
  const viewDateStr = formatAsDDMMYYYY(currentViewDate);
  if (!timetable || timetable.length === 0) return '<p>Loading schedule...</p>';

  const headers = timetable[0].slice(1);
  const targetRow = timetable.find(row => row[0] === viewDateStr);
  if (!targetRow) return `<p class="p-4 text-center text-muted">No roster found for ${viewDateStr}.</p>`;

  const contactsMap = cachedContactsMap;

  // We process in original header order
  const deptsInOrder = [];
  const grouped = {};

  headers.forEach((dept, i) => {
    const cell = targetRow[i + 1];
    if (!cell) return;
    const doctors = cell.split(/\r?\n/).map(d => d.trim()).filter(Boolean);
    if (!doctors.length) return;

    const main = dept.split(' ')[0].toUpperCase();
    const sub = dept.slice(main.length).trim() || 'General';

    if (!grouped[main]) {
      grouped[main] = {};
      deptsInOrder.push(main);
    }
    if (!grouped[main][sub]) grouped[main][sub] = [];

    doctors.forEach(name => {
      const phone = (contactsMap[main] && contactsMap[main][name]) || 'Unknown';
      grouped[main][sub].push({ name, phone });
    });
  });

  let html = '';
  deptsInOrder.forEach(mainDept => {
    const subGroups = grouped[mainDept];
    let subHtml = '';

    Object.entries(subGroups).forEach(([subDept, doctors]) => {
      const filteredDoctors = doctors.filter(d =>
        mainDept.toLowerCase().includes(query) || d.name.toLowerCase().includes(query) || d.phone.includes(query)
      );

      if (filteredDoctors.length > 0) {
        if (subDept !== 'General') {
          subHtml += `<h3>${subDept}</h3>`;
        }
        filteredDoctors.forEach(({ name, phone }) => {
          subHtml += renderDoctorRow(name, phone);
        });
      }
    });

    if (subHtml) {
      html += `
                <div class="doctor-card">
                    <h2>${mainDept}</h2>
                    ${subHtml}
                </div>
            `;
    }
  });

  return html || `<p class="p-8 text-center text-muted">No results found for "${query}"</p>`;
}

function prepareContactsMap(contacts) {
  const map = {};
  if (!contacts || contacts.length === 0) return map;
  const headerRow = contacts[0];
  for (let i = 0; i < headerRow.length; i += 2) {
    const nameHeader = headerRow[i];
    if (!nameHeader) continue;
    const deptMatch = nameHeader.match(/^(.+?)\s+NAME$/i);
    if (!deptMatch) continue;
    const dept = deptMatch[1].trim().toUpperCase();
    map[dept] = {};
    for (let j = 1; j < contacts.length; j++) {
      const name = contacts[j][i]?.trim();
      const phone = contacts[j][i + 1]?.trim();
      if (name && phone) map[dept][name] = phone;
    }
  }
  return map;
}

function renderDoctorRow(name, phone) {
  const tel = phone !== 'Unknown' ? `tel:${phone}` : '#';
  const wa = phone !== 'Unknown' ? `https://wa.me/6${phone.replace(/\D/g, '')}` : '#';

  return `
        <div class="doctor-row">
            <div class="doctor-info">
                <strong>${name}</strong>
                <span>${phone}</span>
            </div>
            <div class="contact-icons">
                <a href="${tel}" onclick="triggerHaptic()" class="icon-link">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </a>
                <a href="${wa}" onclick="triggerHaptic()" target="_blank" class="icon-link">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M12.031 6.172c-2.203 0-4.004 1.8-4.004 4.004 0 .823.252 1.589.687 2.22l-.547 2.015 2.072-.544c.541.311 1.171.492 1.844.492 2.203 0 4.004-1.8 4.004-4.004 0-2.203-1.801-4.004-4.056-4.004zM12.031 2c-5.523 0-10 4.477-10 10 0 1.765.459 3.42 1.258 4.851l-1.332 4.904 5.034-1.321c1.45.811 3.125 1.271 4.912 1.271 5.523 0 10-4.477 10-10s-4.477-10-9.872-10z"/></svg>
                </a>
            </div>
        </div>
    `;
}
