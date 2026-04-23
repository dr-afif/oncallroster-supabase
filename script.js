// script.js - Supabase version
let sbClient = null;

/**
 * Initialize Supabase client
 */
async function getSupabase() {
  if (sbClient) return sbClient;

  const url = window.APP_CONFIG?.SUPABASE_URL;
  const key = window.APP_CONFIG?.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('PLACEHOLDER')) {
    const platform = window.location.hostname.includes('github.io') ? 'GitHub Secrets' : 'Cloudflare Environment Variables';
    const detectedUrl = url ? `${url.substring(0, 8)}...` : 'undefined';
    const detectedKey = key ? `${key.substring(0, 8)}...` : 'undefined';
    throw new Error(`Supabase configuration is missing. Platform: ${platform}, URL: ${detectedUrl}, Key: ${detectedKey}. Please ensure secrets are set correctly and the project is redeployed. (Force-Refresh with v2.0.4)`);
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

  sbClient = window.supabase.createClient(url, key);
  return sbClient;
}

let lastDataHash = "";
let allContactsMap = {}; // Global map for name matching
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
      window._orderedDepts = JSON.parse(localStorage.getItem('dept_order_cache') || '[]');
      window._deptNames = JSON.parse(localStorage.getItem('dept_names_cache') || '{}');
      allContactsMap = JSON.parse(localStorage.getItem('contacts_cache_map') || '{}');
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

    const [rosterRes, deptsRes, allContactsRes] = await Promise.all([
      sb.from('view_roster_merged').select('*').eq('date', dateStr).neq('department_id', 'ADMIN').order('slot_order', { ascending: true }),
      sb.from('departments').select('id, name').eq('active', true).neq('id', 'ADMIN').order('order_index', { ascending: true }),
      sb.from('contacts').select('short_name, phone_number, department_id').eq('active', true)
    ]);

    if (rosterRes.error) throw rosterRes.error;
    if (deptsRes.error) throw deptsRes.error;
    if (allContactsRes.error) console.warn("Contacts fetch failed", allContactsRes.error);

    const { data } = rosterRes;
    const orderedDepts = deptsRes.data.map(d => d.id.toUpperCase());
    const deptNames = {};
    deptsRes.data.forEach(d => {
      deptNames[d.id.toUpperCase()] = d.name.replace(/department/gi, '').trim().toUpperCase();
    });

    // Build contacts map for fuzzy matching
    const contactMap = {};
    if (allContactsRes.data) {
      allContactsRes.data.forEach(c => {
        const key = `${c.department_id}:${c.short_name}`.toUpperCase();
        contactMap[key] = c.phone_number;
      });
    }
    allContactsMap = contactMap;

    // Always update global states and cache
    window._orderedDepts = orderedDepts;
    window._deptNames = deptNames;
    localStorage.setItem('dept_order_cache', JSON.stringify(orderedDepts));
    localStorage.setItem('dept_names_cache', JSON.stringify(deptNames));
    localStorage.setItem('contacts_cache_map', JSON.stringify(contactMap));

    console.log(`Received ${rosterRes.data.length} rows for ${dateStr}`);

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
      if (container) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 3rem 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1.5rem; opacity: 0.4; color: var(--text-muted);">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-main); font-weight: 500; font-size: 1.2rem;">No Roster Available</h3>
            <p style="margin-bottom: 1.5rem; color: var(--text-muted); text-align: center; max-width: 80%;">We couldn't find any roster data for ${dateStr}.</p>
            <button onclick="lastDataHash=''; showSkeleton(); loadDashboard();" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: background 0.2s;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Refresh Data
            </button>
          </div>
        `;
      }
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
function highlightText(text, query) {
  if (!query || !text) return text;
  // Escape regex specials from query to be safe
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeQuery})`, 'gi');
  return String(text).replace(regex, '<span class="highlight">$1</span>');
}

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
  const deptsInOrder = [...(window._orderedDepts || [])];

  data.forEach(row => {
    const main = (row.department_id || 'OTHER').toUpperCase();
    const sub = row.slot_label || 'General';

    if (!grouped[main]) {
      grouped[main] = {};
      if (!deptsInOrder.includes(main)) deptsInOrder.push(main);
    }
    if (!grouped[main][sub]) grouped[main][sub] = [];

    const names = row.merged_names ? row.merged_names.split('\n') : [];
    const phones = row.merged_phones ? row.merged_phones.split('\n') : [];
    const subLabels = row.sub_labels || [];

    names.forEach((name, i) => {
      let phone = phones[i] || '-';
      const subLabel = subLabels[i] || '';

      // Fix: If phone is missing or '-', try to match from contacts pool
      if (phone === '-' || !phone || phone === 'Unknown') {
        const lookupKey = `${row.department_id}:${name}`.toUpperCase();
        if (allContactsMap[lookupKey]) {
          phone = allContactsMap[lookupKey];
        }
      }

      grouped[main][sub].push({ name, subLabel, phone });
    });
  });

  let html = '';
  deptsInOrder.forEach(mainDept => {
    const subGroups = grouped[mainDept];
    if (!subGroups) return;
    let subHtml = '';

    Object.entries(subGroups).forEach(([subDept, doctors]) => {
      const filteredDoctors = doctors.filter(d =>
        mainDept.toLowerCase().includes(query) ||
        subDept.toLowerCase().includes(query) ||
        d.name.toLowerCase().includes(query) ||
        d.subLabel.toLowerCase().includes(query) ||
        d.phone.includes(query)
      );

      if (filteredDoctors.length > 0) {
        if (subDept !== 'General' && subDept !== mainDept) {
          subHtml += `<h3>${highlightText(subDept, query)}</h3>`;
        }
        filteredDoctors.forEach(({ name, subLabel, phone }) => {
          subHtml += renderDoctorRow(highlightText(name, query), highlightText(phone, query), highlightText(subLabel, query));
        });
      }
    });

    if (subHtml) {
      const displayName = (window._deptNames && window._deptNames[mainDept]) || mainDept;
      const cardId = `dept-card-${mainDept.replace(/\s+/g, '-')}`;
      
      html += `
                <div class="doctor-card" id="${cardId}">
                    <div class="card-header">
                        <h2>${highlightText(displayName, query)}</h2>
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

function renderDoctorRow(name, phone, subLabel = '') {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const tel = cleanPhone ? `tel:${phone}` : '#';
  const wa = cleanPhone ? `https://wa.me/6${cleanPhone}` : '#';

  const subLabelHtml = subLabel ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">${subLabel}</div>` : '';

  return `
        <div class="doctor-row">
            <div class="doctor-info">
                ${subLabelHtml}
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

    // Extract rich text from the card DOM for the sharing text
    let shareText = `*${deptName} Roster*\n${dateStr}\n`;
    if (card) {
      Array.from(card.children).forEach(child => {
        if (child.tagName === 'H3') {
          shareText += `\n*${child.textContent.trim()}*\n`;
        } else if (child.classList.contains('doctor-row')) {
          const subLabelEl = child.querySelector('.doctor-info div');
          const subLabelInfo = subLabelEl ? subLabelEl.textContent.trim() : '';
          const nameInfo = child.querySelector('strong')?.textContent.trim() || '';
          const phoneInfo = child.querySelector('span')?.textContent.trim() || '';
          
          if (subLabelInfo) {
            shareText += `_${subLabelInfo}_\n${nameInfo} - ${phoneInfo}\n\n`;
          } else {
            shareText += `${nameInfo} - ${phoneInfo}\n`;
          }
        }
      });
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${deptName} Roster`,
        text: shareText
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
