// === CONFIG ===
const API_KEY = window.APP_CONFIG?.DRIVE_API_KEY || "AIzaSyD31jjNmYQWOwOnkUHwJpucsU_HceUAJWw";
const ROOT_FOLDER_ID = window.APP_CONFIG?.ROOT_FOLDER_ID || "19hxtBDM7U6IRepoEZiOHVG2MK_erNdrk";

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
    fileList.innerHTML = '<p class="p-8 text-center text-muted">No folders or rosters found here.</p>';
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
