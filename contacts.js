const SNAPSHOT_URL = window.APP_CONFIG?.SNAPSHOT_URL || 'https://raw.githubusercontent.com/dr-afif/hsaas-oncallroster/main/snapshot.json';
let allContacts = { depts: [], deptMap: {} };
let lastContactsHash = "";

document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  fetchContacts();
});

function updateHeaderDate() {
  const now = new Date();
  document.querySelector('#header-date').textContent = now.toLocaleDateString('en-MY', {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });
}

function triggerHaptic(duration = 10) {
  if (window.navigator?.vibrate) {
    window.navigator.vibrate(duration);
  }
}

async function fetchContacts() {
  // 1. Try Cache
  const cached = localStorage.getItem('roster_snapshot');
  if (cached) {
    try {
      const data = JSON.parse(cached);
      const raw = data.contacts?.values || [];
      allContacts = processRawContacts(raw);
      renderDepartments(allContacts);
      lastContactsHash = JSON.stringify(raw);
    } catch (e) { }
  }

  // 2. Fetch fresh from cloud (using the same snapshot)
  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    const data = await res.json();
    const raw = data.contacts?.values || [];
    const freshHash = JSON.stringify(raw);

    if (freshHash !== lastContactsHash) {
      allContacts = processRawContacts(raw);
      renderDepartments(allContacts);
      lastContactsHash = freshHash;
      // Note: script.js also saves this, but we save it here too just in case
      localStorage.setItem('roster_snapshot', JSON.stringify(data));
    }
  } catch (e) {
    console.error("Fetch failed", e);
  }
}

function processRawContacts(rawData) {
  if (!rawData || !rawData.length) return { depts: [], deptMap: {} };
  const headers = rawData[0];
  const depts = [];
  const deptMap = {};

  for (let j = 0; j < headers.length; j += 2) {
    const head = headers[j];
    if (!head) continue;
    const deptMatch = head.match(/^(.+?)\s+NAME$/i);
    if (!deptMatch) continue;

    const deptName = deptMatch[1].trim().toUpperCase();
    depts.push(deptName);
    deptMap[deptName] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const name = row[j]?.trim();
      const phone = row[j + 1]?.trim();
      if (name && phone) deptMap[deptName].push({ name, phone });
    }
  }
  return { depts, deptMap };
}

function handleSearch() {
  const query = document.getElementById('global-search-input').value.toLowerCase();
  renderDepartments(allContacts, query);
}

function renderDepartments(data, query = '') {
  const container = document.getElementById('departments');
  if (!data.depts.length) return;

  let html = '';
  data.depts.forEach(dept => {
    const doctors = data.deptMap[dept];
    const filtered = doctors.filter(d =>
      dept.toLowerCase().includes(query) || d.name.toLowerCase().includes(query) || d.phone.includes(query)
    );

    if (filtered.length > 0) {
      html += `
                <div class="doctor-card">
                    <h2 onclick="toggleDept(this)" class="${query ? '' : 'collapsed'}">
                        ${dept}
                        <svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                    </h2>
                    <div class="contacts-grid ${query ? '' : 'hidden'}">
                        ${filtered.map(d => renderContactRow(d.name, d.phone, dept)).join('')}
                    </div>
                </div>
            `;
    }
  });
  container.innerHTML = html;
}

function toggleDept(el) {
  el.classList.toggle('collapsed');
  const grid = el.nextElementSibling;
  grid.classList.toggle('hidden');
  if (window.navigator?.vibrate) window.navigator.vibrate(5);
}

function renderContactRow(name, phone, dept) {
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
                <button onclick="shareContact('${name.replace(/'/g, "\\'")}', '${phone}', '${dept.replace(/'/g, "\\'")}')" class="icon-link share-btn" title="Share Contact">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
            </div>
        </div>
    `;
}

function shareContact(name, phone, dept) {
  triggerHaptic(20);
  const fullName = name.toUpperCase().startsWith('DR.') ? name.toUpperCase() : `DR. ${name.toUpperCase()}`;
  const text = `*HSAAS On-Call Contact*\n\n*Dept:* ${dept}\n*Name:* ${fullName}\n*Phone:* ${phone}\n\nWhatsapp directly: wa.me/6${phone.replace(/\D/g, '')}`;

  if (navigator.share) {
    navigator.share({
      title: fullName,
      text: text
    }).catch(console.error);
  } else {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }
}
