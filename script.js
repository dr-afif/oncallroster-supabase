// script.js - Supabase version
let supabase = null;

/**
 * Initialize Supabase client
 */
async function getSupabase() {
  if (supabase) return supabase;

  const url = window.APP_CONFIG?.SUPABASE_URL;
  const key = window.APP_CONFIG?.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('PLACEHOLDER')) {
    throw new Error("Supabase configuration is missing. Ensure Cloudflare environment variables (SUPABASE_URL and SUPABASE_ANON_KEY) are set and the project is redeployed.");
  }

  // Ensure @supabase/supabase-js is loaded
  if (!window.supabase) {
    let tries = 0;
    while (!window.supabase && tries < 50) {
      await new Promise(r => setTimeout(r, 100));
      tries++;
    }
  }

  if (!window.supabase) {
    throw new Error("Supabase SDK failed to load. Check your internet connection or script tags.");
  }

  supabase = window.supabase.createClient(url, key);
  return supabase;
}

let lastDataHash = "";
let currentViewDate = getInitialDate();
let searchTimeout;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateHeaderDate();
  loadDashboard().catch(err => {
    console.error("Dashboard Init Error:", err);
    showError(err.message);
  });
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
  const headerEl = document.querySelector('#header-date');
  if (headerEl) headerEl.textContent = formattedDate;

  const today = getInitialDate();
  const isToday = currentViewDate.toDateString() === today.toDateString();
  const todayBtn = document.getElementById('today-btn');
  if (todayBtn) todayBtn.classList.toggle('hidden', isToday);
}

function formatAsYYYYMMDD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function changeDate(days) {
  triggerHaptic();
  currentViewDate.setDate(currentViewDate.getDate() + days);
  updateHeaderDate();
  loadDashboard();
}

function resetToToday() {
  triggerHaptic();
  currentViewDate = getInitialDate();
  updateHeaderDate();
  loadDashboard();
}

function handleDatePicker(input) {
  if (!input.value) return;
  const [y, m, d] = input.value.split('-');
  currentViewDate = new Date(y, m - 1, d);
  updateHeaderDate();
  loadDashboard();
}

function showError(msg) {
  const container = document.getElementById('doctor-list');
  if (container) {
    container.innerHTML = `
      <div class="p-8 text-center" style="color: var(--text-muted);">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="margin-bottom: 1.5rem; font-size: 0.95rem;">${msg}</p>
        <button onclick="location.reload()" style="background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: 8px; border: none; font-weight: 500; cursor: pointer;">Retry</button>
      </div>
    `;
  }
}

// --- Data Fetching ---
function showSkeleton() {
  const container = document.getElementById('doctor-list');
  if (!container) return;
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

async function loadDashboard() {
  const dateStr = formatAsYYYYMMDD(currentViewDate);
  const cacheKey = `roster_${dateStr}`;

  // 1. Try Cache
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      const data = JSON.parse(cachedData);
      renderDashboard(data, "📂 Supabase (Cached)");
      lastDataHash = JSON.stringify(data);
    } catch (e) {
      console.warn("Cache fail", e);
    }
  }

  if (!lastDataHash) showSkeleton();

  try {
    const sb = await getSupabase();
    console.log("Fetching roster for:", dateStr);

    const { data, error } = await sb
      .from('view_roster_merged')
      .select('*')
      .eq('date', dateStr);

    if (error) throw error;

    console.log(`Received ${data.length} rows for ${dateStr}`);

    const freshHash = JSON.stringify(data);
    if (freshHash !== lastDataHash) {
      renderDashboard(data, "📂 Supabase (Live)");
      localStorage.setItem(cacheKey, freshHash);
      lastDataHash = freshHash;
    } else {
      const sourceEl = document.getElementById("data-source");
      if (sourceEl) sourceEl.textContent = "📂 Supabase (Up to date)";
    }

    if (data.length === 0) {
      const container = document.getElementById("doctor-list");
      if (container) container.innerHTML = `<p class="p-8 text-center text-muted">No roster found for ${dateStr}.</p>`;
    }

    const updatedEl = document.getElementById("last-updated");
    if (updatedEl) updatedEl.textContent = `Last sync: ${new Date().toLocaleTimeString()}`;

  } catch (err) {
    console.error("Supabase load error:", err);
    if (!lastDataHash) {
      showError(err.message || 'Failed to connect to roster database.');
    }
  }
}

// --- Search & Filtering ---
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = document.getElementById('global-search-input')?.value.toLowerCase() || '';
    const dateStr = formatAsYYYYMMDD(currentViewDate);
    const data = JSON.parse(localStorage.getItem(`roster_${dateStr}`) || '[]');
    const sourceLabel = document.getElementById("data-source")?.textContent || '';
    renderDashboard(data, sourceLabel, query);
  }, 150);
}

// --- Rendering Logic ---
function renderDashboard(data, sourceLabel, query = '') {
  const sourceEl = document.getElementById("data-source");
  if (sourceEl) sourceEl.textContent = sourceLabel;

  const container = document.getElementById('doctor-list');
  if (!container) return;

  if (!data || data.length === 0) {
    if (query) {
      container.innerHTML = `<p class="p-8 text-center text-muted">No results found for "${query}"</p>`;
    }
    return;
  }

  // Grouping: department_id -> slot_label -> doctors
  const grouped = {};
  const deptsInOrder = [];

  data.forEach(row => {
    const main = (row.department_id || 'OTHER').toUpperCase();
    const sub = row.slot_label || 'General';

    if (!grouped[main]) {
      grouped[main] = {};
      deptsInOrder.push(main);
    }
    if (!grouped[main][sub]) grouped[main][sub] = [];

    const names = row.merged_names ? row.merged_names.split('\n') : [];
    const phones = row.merged_phones ? row.merged_phones.split('\n') : [];

    names.forEach((name, i) => {
      const phone = phones[i] || 'Unknown';
      grouped[main][sub].push({ name, phone });
    });
  });

  let html = '';
  deptsInOrder.sort().forEach(mainDept => {
    const subGroups = grouped[mainDept];
    let subHtml = '';

    Object.entries(subGroups).forEach(([subDept, doctors]) => {
      const filteredDoctors = doctors.filter(d =>
        mainDept.toLowerCase().includes(query) ||
        subDept.toLowerCase().includes(query) ||
        d.name.toLowerCase().includes(query) ||
        d.phone.includes(query)
      );

      if (filteredDoctors.length > 0) {
        if (subDept !== 'General' && subDept !== mainDept) {
          subHtml += `<h3>${subDept}</h3>`;
        }
        filteredDoctors.forEach(({ name, phone }) => {
          subHtml += renderDoctorRow(name, phone);
        });
      }
    });

    if (subHtml) {
      const cardId = `dept-card-${mainDept.replace(/\s+/g, '-')}`;
      html += `
                <div class="doctor-card" id="${cardId}">
                    <div class="card-header">
                        <h2>${mainDept}</h2>
                        <button class="share-card-btn" onclick="shareCardAsImage('${cardId}', '${mainDept}')" title="Share as Image">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        </button>
                    </div>
                    ${subHtml}
                </div>
            `;
    }
  });

  container.innerHTML = html || `<p class="p-8 text-center text-muted">No results found for "${query}"</p>`;
}

function renderDoctorRow(name, phone) {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const tel = cleanPhone ? `tel:${phone}` : '#';
  const wa = cleanPhone ? `https://wa.me/6${cleanPhone}` : '#';

  return `
        <div class="doctor-row">
            <div class="doctor-info">
                <strong>${name}</strong>
                <span>${phone || 'No phone'}</span>
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

async function shareCardAsImage(cardId, deptName) {
  if (typeof html2canvas === 'undefined') {
    alert('Sharing library is still loading. Please try again in a moment.');
    return;
  }
  triggerHaptic(20);
  const card = document.getElementById(cardId);
  const shareBtn = card?.querySelector('.share-card-btn');
  if (shareBtn) shareBtn.style.display = 'none';

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      useCORS: true,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
      logging: false,
      onclone: (clonedDoc) => {
        const clonedCard = clonedDoc.getElementById(cardId);
        if (clonedCard) clonedCard.style.borderRadius = '0';
      }
    });

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
    const dateStr = document.getElementById('header-date')?.textContent || 'roster';
    const fileName = `HSAAS_Roster_${deptName}_${dateStr.replace(/[/\\?%*:|"<>]/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${deptName} Roster`,
        text: `On-Call Roster for ${deptName} (${dateStr})`
      });
    } else {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  } catch (err) {
    console.error('Error sharing image:', err);
    alert('Failed to generate image. Please try again.');
  } finally {
    if (shareBtn) shareBtn.style.display = 'flex';
  }
}
