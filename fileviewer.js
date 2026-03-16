// === CONFIG ===
const API_KEY = window.APP_CONFIG?.DRIVE_API_KEY || "AIzaSyD31jjNmYQWOwOnkUHwJpucsU_HceUAJWw";
const ROOT_FOLDER_ID = window.APP_CONFIG?.ROOT_FOLDER_ID || "19hxtBDM7U6IRepoEZiOHVG2MK_erNdrk";

// Month sorting mapping (English & Malay)
const MONTH_ORDER = {
  "jan": 1, "january": 1, "januari": 1,
  "feb": 2, "february": 2, "februari": 2,
  "mar": 3, "march": 3, "mac": 3,
  "apr": 4, "april": 4,
  "may": 5, "mei": 5,
  "jun": 6, "june": 6,
  "jul": 7, "july": 7, "julai": 7,
  "aug": 8, "august": 8, "ogos": 8,
  "sep": 9, "september": 9,
  "oct": 10, "october": 10, "oktober": 10,
  "nov": 11, "november": 11,
  "dec": 12, "december": 12, "disember": 12
};

// Elements
const fileList = document.getElementById("file-list");
const loaderWrapper = document.getElementById("file-loader");
const modal = document.getElementById("viewer-modal");
const closeViewer = document.getElementById("close-viewer");
const viewer = document.getElementById("file-viewer");
const breadcrumb = document.getElementById("breadcrumb");

// --- Session Persistence Helpers ---
const FOLDER_SESSION_KEY = "hsaas_last_folder_stack";

/**
 * Saves the current folder stack to sessionStorage
 */
function saveFolderId(stack) {
  sessionStorage.setItem(FOLDER_SESSION_KEY, JSON.stringify(stack));
}

/**
 * Retrieves the saved folder stack from sessionStorage
 */
function getSavedFolderId() {
  const saved = sessionStorage.getItem(FOLDER_SESSION_KEY);
  try {
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Caches a folder's file list in sessionStorage
 */
function setFilesToCache(folderId, files) {
  sessionStorage.setItem(`cache_files_${folderId}`, JSON.stringify(files));
}

/**
 * Retrieves a folder's file list from sessionStorage
 */
function getFilesFromCache(folderId) {
  const saved = sessionStorage.getItem(`cache_files_${folderId}`);
  try {
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

// Initial state: Restore from session or use defaults
let folderStack = getSavedFolderId() || [{ id: ROOT_FOLDER_ID, name: "Shared Folder" }];

console.log("✅ fileviewer.js loaded");

function highlightSecondWord(name) {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return name;
  const first = words[0];
  const second = words[1];
  const rest = words.slice(2).join(" ");
  return `${first} <span class="accent">${second}</span> ${rest}`.trim();
}

function showLoader() {
  if (loaderWrapper) {
    loaderWrapper.classList.remove("hidden");
  }
  if (fileList) {
    fileList.classList.add("hidden");
  }
}

function hideLoader() {
  if (loaderWrapper) {
    loaderWrapper.classList.add("hidden");
  }
  if (fileList) {
    fileList.classList.remove("hidden");
  }
}


// Polling for GAPI to load
async function startGapi() {
  console.log("🧐 Checking for GAPI...");
  let tries = 0;
  while (typeof gapi === 'undefined' || !gapi.load) {
    await new Promise(r => setTimeout(r, 100));
    if (++tries > 100) {
      console.error("GAPI timed out");
      hideLoader();
      fileList.textContent = "Google API failed to load.";
      return;
    }
  }
  gapi.load("client", initializeGapiClient);
}
startGapi();

async function initializeGapiClient() {
  console.log("👉 initializeGapiClient...");
  try {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    });
    console.log("👉 Drive API ready");
    // On page load: Restore the last folder from the stack
    const currentFolder = folderStack[folderStack.length - 1];
    await listFiles(currentFolder.id);
  } catch (err) {
    console.error("GAPI Init Error:", err);
    hideLoader();
    fileList.textContent = "Failed to connect to Google Drive.";
  }
}

async function listFiles(folderId) {
  // ⚡ 1. Try to load from Cache first for immediate display
  const cachedFiles = getFilesFromCache(folderId);
  if (cachedFiles) {
    console.log("⚡ Instant load from cache");
    renderFilesUI(cachedFiles);
    updateBreadcrumb();
    hideLoader();
  } else {
    showLoader();
    fileList.innerHTML = "";
  }

  // 📡 2. Fetch fresh data from Google Drive in the background
  try {
    console.log(`📂 Fetching live files for folder: ${folderId}`);
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`, // Use live ID here
      orderBy: "folder,name desc",
      pageSize: 100,
      fields: "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink)"
    });

    const files = response.result.files || [];
    console.log(`✅ Received ${files.length} fresh files`);

    // --- Custom Sorting Logic ---
    const currentFolderName = folderStack[folderStack.length - 1]?.name || "";
    const isYearFolder = /^\d{4}$/.test(currentFolderName);

    files.sort((a, b) => {
      const isFolderA = a.mimeType === "application/vnd.google-apps.folder";
      const isFolderB = b.mimeType === "application/vnd.google-apps.folder";

      // 1. Folders first
      if (isFolderA && !isFolderB) return -1;
      if (!isFolderA && isFolderB) return 1;

      // 2. Month-based sorting
      const getMonthPriority = (name) => {
        const lower = name.toLowerCase().trim();
        // Check for common month prefixes
        for (const [m, p] of Object.entries(MONTH_ORDER)) {
          if (lower.startsWith(m)) return p;
        }
        return null;
      };

      const pA = getMonthPriority(a.name);
      const pB = getMonthPriority(b.name);

      if (pA !== null && pB !== null) {
        if (pA !== pB) return pA - pB; // Chronological (Jan-Dec)
      } else if (pA !== null) {
        return -1; // Month folder before other folder/file
      } else if (pB !== null) {
        return 1;
      }

      // 3. Year-based sorting (Descending - 2026 before 2025)
      const isYearA = /^\d{4}$/.test(a.name);
      const isYearB = /^\d{4}$/.test(b.name);
      if (isYearA && isYearB) {
        return b.name.localeCompare(a.name);
      }

      // 4. Fallback sorting
      if (isYearFolder) {
        // Inside a year folder (like 2026), prefer ascending alphabetic for other items
        return a.name.localeCompare(b.name);
      }

      // Maintain original "name desc" behavior for general content
      return b.name.localeCompare(a.name);
    });

    // 💾 3. Update cache with fresh data
    setFilesToCache(folderId, files);

    // 🎨 4. Render fresh data (UI updates smoothly)
    renderFilesUI(files);
    updateBreadcrumb();
    hideLoader();
  } catch (err) {
    console.error("ListFiles Error:", err);
    if (!cachedFiles) {
      hideLoader();
      fileList.textContent = "Error loading files. Check connection.";
    }
  }
}

function renderFilesUI(files) {
  fileList.innerHTML = "";

  if (files.length === 0) {
    fileList.innerHTML = `
      <div class="empty-state" style="padding: 3rem 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1.5rem; opacity: 0.4; color: var(--text-muted);">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="9" y1="14" x2="15" y2="14"></line>
        </svg>
        <h3 style="margin-bottom: 0.5rem; color: var(--text-main); font-weight: 500; font-size: 1.2rem;">Folder is Empty</h3>
        <p style="margin-bottom: 1.5rem; color: var(--text-muted); max-width: 80%;">No folders or rosters found here.</p>
        <button onclick="const fid = folderStack[folderStack.length - 1].id; sessionStorage.removeItem('cache_files_' + fid); listFiles(fid);" style="background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: background 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Refresh Folder
        </button>
      </div>
    `;
    return;
  }

  files.forEach(file => {
    const div = document.createElement("div");
    div.className = "file-card";
    const nameMarkup = highlightSecondWord(file.name);

    if (file.mimeType === "application/vnd.google-apps.folder") {
      div.innerHTML = `
          <div class="folder-thumb">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--primary)" opacity="0.9">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
          </div>
          <div class="file-name">${nameMarkup}</div>
        `;
      div.onclick = () => enterFolder(file);
    } else {
      // Boost thumbnail resolution from default (usually =s220) to =s400 for crispness
      const thumbUrl = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+$/, '=s400') : null;
      const thumbMarkup = thumbUrl
        ? `<img src="${thumbUrl}" alt="thumb" class="file-thumb" />`
        : `<div class="file-icon">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
             </svg>
          </div>`;

      div.innerHTML = `
          ${thumbMarkup}
          <div class="file-name">${nameMarkup}</div>
        `;
      div.onclick = () => openViewer(file);
    }
    fileList.appendChild(div);
  });
}

function enterFolder(folder) {
  folderStack.push({ id: folder.id, name: folder.name });
  saveFolderId(folderStack); // Persist state
  listFiles(folder.id);
}

function updateBreadcrumb() {
  breadcrumb.innerHTML = "";
  folderStack.forEach((f, index) => {
    const span = document.createElement("span");
    span.textContent = f.name;
    span.onclick = () => {
      folderStack = folderStack.slice(0, index + 1);
      saveFolderId(folderStack); // Persist state
      listFiles(f.id);
    };
    breadcrumb.appendChild(span);
    if (index < folderStack.length - 1) {
      breadcrumb.append(" › ");
    }
  });
}

function openViewer(file) {
  modal.classList.remove("hidden");
  if (file.mimeType === "application/pdf") {
    viewer.src = `https://drive.google.com/file/d/${file.id}/preview`;
  } else if (file.mimeType.startsWith("image/")) {
    viewer.src = `https://drive.google.com/uc?id=${file.id}`;
  } else {
    viewer.src = file.webViewLink;
  }
}

closeViewer.onclick = () => {
  modal.classList.add("hidden");
  viewer.src = "";
};
