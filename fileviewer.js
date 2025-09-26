// === CONFIG ===
const API_KEY = "AIzaSyD31jjNmYQWOwOnkUHwJpucsU_HceUAJWw";   // replace with your restricted key
const ROOT_FOLDER_ID = "19hxtBDM7U6IRepoEZiOHVG2MK_erNdrk"; // your shared folder ID

// Elements
const fileList = document.getElementById("file-list");
const loaderWrapper = document.getElementById("file-loader");
const modal = document.getElementById("viewer-modal");
const closeViewer = document.getElementById("close-viewer");
const viewer = document.getElementById("file-viewer");
const breadcrumb = document.getElementById("breadcrumb");

let folderStack = [{ id: ROOT_FOLDER_ID, name: "Shared Folder" }];

console.log("✅ script.js loaded");
function showLoader() {
  if (loaderWrapper) {
    loaderWrapper.classList.remove("is-hidden");
  }
  if (fileList) {
    fileList.classList.add("is-hidden");
  }
}

function hideLoader() {
  if (loaderWrapper) {
    loaderWrapper.classList.add("is-hidden");
  }
  if (fileList) {
    fileList.classList.remove("is-hidden");
  }
}


// make gapiLoaded a property of window so onload can call it
window.gapiLoaded = function() {
  console.log("👉 gapiLoaded called");
  gapi.load("client", initializeGapiClient);
};

async function initializeGapiClient() {
  console.log("👉 initializeGapiClient called");
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  console.log("👉 Drive API ready");
  listFiles(ROOT_FOLDER_ID);
}

async function listFiles(folderId) {
  showLoader();
  fileList.innerHTML = "";

  try {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: "folder,name desc",
      pageSize: 100,
      fields: "files(id, name, mimeType, webViewLink, iconLink, thumbnailLink)"
    });

    const files = response.result.files || [];

    hideLoader();

    if (files.length === 0) {
      fileList.textContent = "No files here.";
      return;
    }

    files.forEach(file => {
      const div = document.createElement("div");
      div.className = "file-card";

      if (file.mimeType === "application/vnd.google-apps.folder") {
        div.innerHTML = `
          <div class="folder-thumb">📁</div>
          <div class="file-name">${file.name}</div>
        `;
        div.onclick = () => enterFolder(file);
      } else {
        const thumb = file.thumbnailLink
          ? `<img src="${file.thumbnailLink}" alt="thumb" class="file-thumb" />`
          : `<div class="file-icon">📁</div>`;

        div.innerHTML = `
          ${thumb}
          <div class="file-name">${file.name}</div>
        `;
        div.onclick = () => openViewer(file);
      }

      fileList.appendChild(div);
    });

    updateBreadcrumb();
  } catch (err) {
    console.error(err);
    hideLoader();
    fileList.textContent = "Error loading files.";
  }
}

function enterFolder(folder) {
  folderStack.push({ id: folder.id, name: folder.name });
  listFiles(folder.id);
}

function updateBreadcrumb() {
  breadcrumb.innerHTML = "";
  folderStack.forEach((f, index) => {
    const span = document.createElement("span");
    span.textContent = f.name;
    span.onclick = () => {
      folderStack = folderStack.slice(0, index + 1);
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



