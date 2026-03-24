const CLIENT_ID =
  "877749541241-er2bgq0ficnur2pnuojr0h25200hg6tn.apps.googleusercontent.com";

let tokenClient;
let accounts = [];
let activeEmail = null;
let isAccordionExpanded = false;

// DOM Elements
const signInBtn = document.getElementById("sign-in-btn");
const profileBtn = document.getElementById("profile-btn");
const profileImg = document.getElementById("profile-img");
const profileInitials = document.getElementById("profile-initials");
const profilePopup = document.getElementById("profile-popup");
const closePopupBtn = document.getElementById("close-popup-btn");

const popupEmail = document.getElementById("popup-email");
const popupImg = document.getElementById("popup-img");
const popupInitials = document.getElementById("popup-initials");
const popupGreeting = document.getElementById("popup-greeting");

// Initialize Google Identity Services
window.onload = function () {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "email profile",
    prompt: "select_account",
    callback: async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        try {
          const res = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`,
              },
            },
          );
          const userInfo = await res.json();
          handleLogin(userInfo);
        } catch (error) {
          console.error("Failed to fetch user info", error);
        }
      }
    },
  });

  const savedAccounts = localStorage.getItem("pdf_lib_accounts");
  const savedActive = localStorage.getItem("pdf_lib_active_email");

  if (savedAccounts && savedActive) {
    accounts = JSON.parse(savedAccounts);
    activeEmail = savedActive;
    updateUI();
  }
};

function getInitials(name, email) {
  if (name)
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return "U";
}

function handleLogin(user) {
  const exists = accounts.find((a) => a.email === user.email);
  if (!exists) {
    accounts.push(user);
  }
  activeEmail = user.email;
  localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
  localStorage.setItem("pdf_lib_active_email", activeEmail);
  updateUI();
}

window.switchAccount = function (email) {
  activeEmail = email;
  localStorage.setItem("pdf_lib_active_email", activeEmail);
  isAccordionExpanded = false;
  updateUI();
};

window.handleLogout = function () {
  accounts = accounts.filter((a) => a.email !== activeEmail);
  localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));

  if (accounts.length > 0) {
    activeEmail = accounts[0].email;
    localStorage.setItem("pdf_lib_active_email", activeEmail);
  } else {
    activeEmail = null;
    localStorage.removeItem("pdf_lib_active_email");
    profilePopup.classList.add("hidden");
  }
  isAccordionExpanded = false;
  updateUI();
};

window.toggleAccordion = function () {
  isAccordionExpanded = !isAccordionExpanded;
  renderAuthActions();
};

window.addAccount = function () {
  tokenClient.requestAccessToken();
};

function renderAuthActions() {
  const container = document.getElementById("auth-actions-container");
  if (!container) return;

  const inactiveAccounts = accounts.filter((a) => a.email !== activeEmail);

  if (inactiveAccounts.length === 0) {
    // Single Account View
    container.innerHTML = `
      <div class="single-account-actions">
        <button class="action-btn" onclick="addAccount()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add account
        </button>
        <div class="divider"></div>
        <button class="action-btn" onclick="handleLogout()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign out
        </button>
      </div>
    `;
  } else {
    // Multiple Accounts View
    if (!isAccordionExpanded) {
      const avatarsHtml = inactiveAccounts
        .slice(0, 2)
        .map((acc) => {
          const initials = getInitials(acc.name, acc.email);
          return acc.picture
            ? `<div class="collapsed-avatar"><img src="${acc.picture}" referrerpolicy="no-referrer"></div>`
            : `<div class="collapsed-avatar"><span>${initials}</span></div>`;
        })
        .join("");

      container.innerHTML = `
        <div class="accounts-accordion">
          <button class="accordion-toggle" onclick="toggleAccordion()">
            <span style="font-size: 14px; font-weight: 500;">Show more accounts</span>
            <div class="accordion-toggle-right">
              <div class="collapsed-avatars">${avatarsHtml}</div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </button>
        </div>
      `;
    } else {
      let listHtml = "";
      inactiveAccounts.forEach((acc) => {
        const initials = getInitials(acc.name, acc.email);
        const avatarHtml = acc.picture
          ? `<img src="${acc.picture}" referrerpolicy="no-referrer">`
          : `<span>${initials}</span>`;

        listHtml += `
          <button class="secondary-account-item" onclick="switchAccount('${acc.email}')">
            <div class="secondary-account-avatar">${avatarHtml}</div>
            <div class="secondary-account-info">
              <div class="secondary-account-name">${acc.name || "User"}</div>
              <div class="secondary-account-email">${acc.email}</div>
            </div>
          </button>
        `;
      });

      container.innerHTML = `
        <div class="accounts-accordion">
          <button class="accordion-toggle" style="border-bottom: 1px solid #3c4043;" onclick="toggleAccordion()">
            <span style="font-size: 14px; font-weight: 500;">Hide more accounts</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <div class="secondary-accounts-list">${listHtml}</div>
          <div class="expanded-actions">
            <button class="action-btn" onclick="addAccount()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add another account
            </button>
            <button class="action-btn" onclick="handleLogout()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Sign out
            </button>
          </div>
        </div>
      `;
    }
  }
}

function updateUI() {
  const activeUser = accounts.find((a) => a.email === activeEmail);

  if (activeUser) {
    signInBtn.classList.add("hidden");
    profileBtn.classList.remove("hidden");

    popupEmail.textContent = activeUser.email;
    const firstName =
      activeUser.given_name ||
      (activeUser.name ? activeUser.name.split(" ")[0] : "User");
    popupGreeting.textContent = `Hi, ${firstName}!`;

    if (activeUser.picture) {
      profileImg.src = activeUser.picture;
      profileImg.classList.remove("hidden");
      profileInitials.classList.add("hidden");

      popupImg.src = activeUser.picture;
      popupImg.classList.remove("hidden");
      popupInitials.classList.add("hidden");
    } else {
      const initials = getInitials(activeUser.name, activeUser.email);
      profileInitials.textContent = initials;
      profileInitials.classList.remove("hidden");
      profileImg.classList.add("hidden");

      popupInitials.textContent = initials;
      popupInitials.classList.remove("hidden");
      popupImg.classList.add("hidden");
    }

    renderAuthActions();
  } else {
    signInBtn.classList.remove("hidden");
    profileBtn.classList.add("hidden");
    profilePopup.classList.add("hidden");
  }
}

// Event Listeners
signInBtn.addEventListener("click", () => tokenClient.requestAccessToken());
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profilePopup.classList.toggle("hidden");
});
profilePopup.addEventListener("click", (e) => {
  e.stopPropagation();
});
closePopupBtn.addEventListener("click", () =>
  profilePopup.classList.add("hidden"),
);
document.addEventListener("click", (e) => {
  if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
    profilePopup.classList.add("hidden");
  }
});
// =========================================
// CHANGE PROFILE PICTURE FUNCTIONALITY
// =========================================

const popupProfileContainer = document.getElementById(
  "popup-profile-container",
);
const changePicBackdrop = document.getElementById("change-pic-backdrop"); // NEW
const changePicModal = document.getElementById("change-pic-modal");
const closeChangePicBtn = document.getElementById("close-change-pic");
const largePreviewImg = document.getElementById("large-preview-img");
const largePreviewInitials = document.getElementById("large-preview-initials");

const uploadDeviceBtn = document.getElementById("upload-device-btn");
const hiddenFileInput = document.getElementById("hidden-file-input");

const takePictureBtn = document.getElementById("take-picture-btn");
const cameraUi = document.getElementById("camera-ui");
const cameraVideo = document.getElementById("camera-video");
const captureBtn = document.getElementById("capture-btn");
const cancelCameraBtn = document.getElementById("cancel-camera-btn");
const cameraCanvas = document.getElementById("camera-canvas");

let currentStream = null;

// 1. Open the Centered Panel when profile pic is clicked
popupProfileContainer.addEventListener("click", (e) => {
  e.stopPropagation(); // Stop the main popup from closing
  changePicBackdrop.classList.remove("hidden"); // Show the blurred backdrop

  // Load the current active user's picture into the large display
  const activeUser = accounts.find((a) => a.email === activeEmail);
  if (activeUser) {
    if (activeUser.picture) {
      // --- HD IMAGE TRICK ---
      // Google sends a small 96px image by default (=s96-c).
      // We replace it with =s400-c to get a crisp, high-quality 400px image.
      let highResPic = activeUser.picture;
      if (highResPic.includes("=s96-c")) {
        highResPic = highResPic.replace("=s96-c", "=s400-c");
      }

      largePreviewImg.src = highResPic;
      largePreviewImg.classList.remove("hidden");
      largePreviewInitials.classList.add("hidden");
    } else {
      largePreviewInitials.textContent = getInitials(
        activeUser.name,
        activeUser.email,
      );
      largePreviewInitials.classList.remove("hidden");
      largePreviewImg.classList.add("hidden");
    }
  }
});
// 2. Close the Panel
closeChangePicBtn.addEventListener("click", () => {
  changePicBackdrop.classList.add("hidden");
});

// Close when clicking the blurred background outside the modal
changePicBackdrop.addEventListener("click", (e) => {
  if (e.target === changePicBackdrop) {
    changePicBackdrop.classList.add("hidden");
  }
});

// Prevent clicks inside the modal from closing it
changePicModal.addEventListener("click", (e) => {
  e.stopPropagation();
});

// ... (Keep your existing code for Upload from Device and Take a Picture below this) ...

// 3. FUNCTION: Upload from Device
uploadDeviceBtn.addEventListener("click", () => {
  hiddenFileInput.click(); // Triggers the hidden file input
});

hiddenFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const newImageUrl = event.target.result;
      updateProfilePicture(newImageUrl);
    };
    reader.readAsDataURL(file); // Converts image to a usable URL
  }
});

// 4. FUNCTION: Take a Picture (Webcam)
takePictureBtn.addEventListener("click", async () => {
  try {
    cameraUi.classList.remove("hidden");
    // Request camera access
    currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraVideo.srcObject = currentStream;
  } catch (err) {
    alert("Camera access denied or not available on this device.");
    cameraUi.classList.add("hidden");
  }
});

cancelCameraBtn.addEventListener("click", () => {
  stopCamera();
});

captureBtn.addEventListener("click", () => {
  // Draw the current video frame onto a hidden canvas
  const context = cameraCanvas.getContext("2d");
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;

  // Mirror the image if needed, then draw
  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

  // Convert canvas to an image URL
  const newImageUrl = cameraCanvas.toDataURL("image/png");
  updateProfilePicture(newImageUrl);
  stopCamera();
});

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop()); // Turn off camera light
  }
  cameraUi.classList.add("hidden");
}

// 5. Helper function to apply the new picture everywhere
function updateProfilePicture(newImageUrl) {
  // Update the user in our local array
  const userIndex = accounts.findIndex((a) => a.email === activeEmail);
  if (userIndex !== -1) {
    accounts[userIndex].picture = newImageUrl;
    localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));

    // Update the large preview in the side panel
    largePreviewImg.src = newImageUrl;
    largePreviewImg.classList.remove("hidden");
    largePreviewInitials.classList.add("hidden");

    // Call your existing updateUI function to update the main header and popup!
    updateUI();
  }
}
// =========================================
// SIDEBAR & HISTORY FUNCTIONALITY
// =========================================

const openSidebarBtn = document.getElementById("open-sidebar-btn");
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const historyList = document.getElementById("history-list");

// Dummy History Data (Simulating recently read books)
let userHistory = [
  { id: 1, title: "The Great Gatsby" },
  { id: 2, title: "1984 by George Orwell" },
  { id: 3, title: "Introduction to Algorithms" },
  { id: 4, title: "Atomic Habits" },
];

// 1. Open Sidebar
openSidebarBtn.addEventListener("click", () => {
  sidebar.classList.add("active");
  sidebarOverlay.classList.add("active");
  renderHistory(); // Refresh list when opened
});

// 2. Close Sidebar (Clicking Back Arrow or Overlay)
function closeSidebar() {
  sidebar.classList.remove("active");
  sidebarOverlay.classList.remove("active");
  // Close any open delete menus
  document
    .querySelectorAll(".delete-dropdown")
    .forEach((menu) => menu.classList.add("hidden"));
}

closeSidebarBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// 3. Render History Items (With Tooltips)
function renderHistory() {
  historyList.innerHTML = ""; // Clear current list

  userHistory.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "history-item-wrapper";
    wrapper.setAttribute("data-tooltip", item.title); // Adds the sophisticated hover tooltip

    // Note: Clicking the left side opens the book. Clicking the 3 dots opens the delete menu.
    wrapper.innerHTML = `
            <div class="history-item">
                <div class="history-item-left" onclick="openBook(${item.id}, '${item.title.replace(/'/g, "\\'")}')">
                    <span class="material-symbols-outlined">menu_book</span>
                    <span class="history-text">${item.title}</span>
                </div>
                <button class="icon-btn history-more-btn" onclick="toggleDeleteMenu(event, ${item.id})">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
            <div id="delete-menu-${item.id}" class="delete-dropdown hidden">
                <button class="delete-btn" onclick="deleteHistoryItem(${item.id}, event)">
                    <span class="material-symbols-outlined">delete</span>
                    Delete
                </button>
            </div>
        `;
    historyList.appendChild(wrapper);
  });
}

// 4. Open Book (Closes sidebar and simulates opening)
window.openBook = function (id, title) {
  alert(`Opening eBook: ${title}`);
  closeSidebar(); // Automatically close the sidebar
  closeSearch(); // Automatically close search if it's open
};

// 5. Toggle Delete Menu
window.toggleDeleteMenu = function (event, id) {
  event.stopPropagation(); // Prevent opening the book accidentally

  // Close all other open menus first
  document.querySelectorAll(".delete-dropdown").forEach((menu) => {
    if (menu.id !== `delete-menu-${id}`) {
      menu.classList.add("hidden");
    }
  });

  const menu = document.getElementById(`delete-menu-${id}`);
  menu.classList.toggle("hidden");
};

// 6. Delete History Item (Permanently removes from list)
window.deleteHistoryItem = function (id, event) {
  if (event) event.stopPropagation(); // Prevent opening the book

  // Filter out the deleted item from the array
  userHistory = userHistory.filter((item) => item.id !== id);
  renderHistory(); // Re-render the UI immediately
};

// Close delete menus if clicking anywhere else inside the sidebar
sidebar.addEventListener("click", (e) => {
  if (
    !e.target.closest(".history-more-btn") &&
    !e.target.closest(".delete-dropdown")
  ) {
    document
      .querySelectorAll(".delete-dropdown")
      .forEach((menu) => menu.classList.add("hidden"));
  }
});

// =========================================
// SEARCH FUNCTIONALITY
// =========================================
const sidebarSearchBtn = document.getElementById("sidebar-search-btn");
const searchBackdrop = document.getElementById("search-backdrop");
const searchModal = document.getElementById("search-modal");
const closeSearchBtn = document.getElementById("close-search-btn");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

// All available books (Mock database for searching)
const allBooksDatabase = [
  { id: 1, title: "The Great Gatsby" },
  { id: 2, title: "1984 by George Orwell" },
  { id: 3, title: "Introduction to Algorithms" },
  { id: 4, title: "Atomic Habits" },
  { id: 5, title: "Clean Code" },
  { id: 6, title: "The Pragmatic Programmer" },
];

// Open Search Modal
sidebarSearchBtn.addEventListener("click", () => {
  searchBackdrop.classList.remove("hidden");
  searchBackdrop.classList.add("active"); // Reuse the dark overlay styling
  searchModal.classList.remove("hidden");
  searchInput.value = "";
  renderSearchResults(allBooksDatabase); // Show all books initially
  searchInput.focus(); // Automatically put cursor in the search box
});

// Close Search Modal
function closeSearch() {
  searchBackdrop.classList.add("hidden");
  searchBackdrop.classList.remove("active");
  searchModal.classList.add("hidden");
}

closeSearchBtn.addEventListener("click", closeSearch);
searchBackdrop.addEventListener("click", closeSearch);

// Filter books as you type
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allBooksDatabase.filter((book) =>
    book.title.toLowerCase().includes(query),
  );
  renderSearchResults(filtered);
});

// Render the search results
function renderSearchResults(results) {
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResults.innerHTML =
      '<div style="padding: 16px 24px; color: #9aa0a6; font-size: 14px;">No books found matching your search.</div>';
    return;
  }

  results.forEach((book) => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.innerHTML = `
            <span class="material-symbols-outlined">menu_book</span>
            <span class="history-text">${book.title}</span>
        `;
    // Clicking a search result opens the book
    div.onclick = () => {
      openBook(book.id, book.title);
    };
    searchResults.appendChild(div);
  });
}
// =========================================
// PREMIUM AI SIDEBAR FUNCTIONALITY
// =========================================

document.addEventListener("DOMContentLoaded", () => {
  const aiChatBtn = document.getElementById("ai-chat-btn");
  const aiSidebar = document.getElementById("ai-sidebar");
  const aiCloseBtn = document.getElementById("ai-close-btn");
  const aiChatBody = document.getElementById("ai-chat-body");
  const aiChatInput = document.getElementById("ai-chat-input");
  const aiSendBtn = document.getElementById("ai-send-btn");

  if (!aiChatBtn || !aiSidebar) return; // Safety check

  // 1. Open Sidebar
  aiChatBtn.addEventListener("click", () => {
    aiSidebar.classList.add("active");
    aiChatInput.focus(); // Auto-focus the typing area
  });

  // 2. Close Sidebar
  aiCloseBtn.addEventListener("click", () => {
    aiSidebar.classList.remove("active");
  });
  // 3. Append Message to UI (Now with Markdown formatting!)
  function appendMessage(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.className = sender === "user" ? "ai-msg-user" : "ai-msg-bot";

    if (sender === "bot") {
      // If it's the AI speaking, use the marked.js tool to format it beautifully
      if (typeof marked !== "undefined") {
        msgDiv.innerHTML = marked.parse(text);
      } else {
        // Fallback just in case
        msgDiv.innerHTML = text.replace(/\n/g, "<br>");
      }
    } else {
      // If it's the user speaking, just show normal text
      msgDiv.textContent = text;
    }

    aiChatBody.appendChild(msgDiv);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
  }

  // 4. Send Message to Backend (NOW WITH FILE SUPPORT)
  async function sendChatMessage() {
    const text = aiChatInput.value.trim();
    // Grab the files from the global array
    const filesToSend = window.attachedFiles || [];

    // Stop if there is no text AND no files
    if (!text && filesToSend.length === 0) return;

    // Create the visual message for the user
    let displayMsg = text;
    if (filesToSend.length > 0) {
      const fileNames = filesToSend.map((f) => f.name).join(", ");
      displayMsg += `\n\n*[Attached: ${fileNames}]*`;
    }

    // Show user message
    appendMessage(displayMsg, "user");
    aiChatInput.value = "";

    // Show loading state
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg-bot";
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML =
      '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span>';
    aiChatBody.appendChild(loadingDiv);
    aiChatBody.scrollTop = aiChatBody.scrollHeight;

    try {
      // Convert all attached files to Base64 format so the server can read them
      const filePromises = filesToSend.map((file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            resolve({
              inlineData: {
                data: reader.result.split(",")[1], // Extracts the raw Base64 data
                mimeType: file.type, // Tells Gemini if it's a PDF, PNG, JPEG, etc.
              },
            });
          };
          reader.onerror = (error) => reject(error);
        });
      });

      const processedFiles = await Promise.all(filePromises);

      // Clear the attachments UI now that they are being sent
      window.attachedFiles = [];
      if (typeof window.renderFilePreviews === "function")
        window.renderFilePreviews();

      // Call your Node.js backend, sending BOTH text and files
      const response = await fetch("http://localhost:3000/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          files: processedFiles,
        }),
      });

      const data = await response.json();
      document.getElementById(loadingId).remove(); // Remove loading icon
      if (data.answer) {
        appendMessage(data.answer, "bot");
        // NEW: Save this interaction to our persistent history
        if (window.saveInteractionToHistory) {
          window.saveInteractionToHistory(displayMsg, data.answer);
        }
      } else {
        appendMessage("Error: " + (data.error || "Unknown error"), "bot");
      }
    } catch (error) {
      console.error("AI Error:", error);
      if (document.getElementById(loadingId))
        document.getElementById(loadingId).remove();
      appendMessage(
        "Connection error. Ensure backend is running on port 3000.",
        "bot",
      );
    }
  }
  // 5. Event Listeners for Input
  // 5. Event Listeners for Input & Dynamic Send Button
  if (aiSendBtn) {
    // Triggers the Enter action when the button is clicked
    aiSendBtn.addEventListener("click", () => {
      sendChatMessage();
      aiSendBtn.classList.add("hidden-send"); // Hides button after sending
    });
  }

  if (aiChatInput) {
    // Triggers the Enter action when the Enter key is pressed
    aiChatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendChatMessage();
        aiSendBtn.classList.add("hidden-send"); // Hides button after sending
      }
    });

    // Constantly monitors typing to show/hide the button
    aiChatInput.addEventListener("input", () => {
      // Checks if there is at least one character typed
      if (aiChatInput.value.trim().length > 0) {
        aiSendBtn.classList.remove("hidden-send"); // Shows the button
      } else {
        aiSendBtn.classList.add("hidden-send"); // Hides the button if empty
      }
    });
  }

  // Add spin animation for the loading icon
  const style = document.createElement("style");
  style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
});
//* --- START OF COMPLETE UPLOAD & FILE CHIP LOGIC --- */
// Make these global so sendChatMessage can access them
window.attachedFiles = [];
window.renderFilePreviews = function () {
  const filePreviewContainer = document.getElementById(
    "file-preview-container",
  );
  if (!filePreviewContainer) return;
  filePreviewContainer.innerHTML = "";

  window.attachedFiles.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;

    chip.innerHTML = `
        ${icon}
        <span class="file-chip-name" title="${file.name}">${file.name}</span>
        <button class="file-chip-remove" data-index="${index}" type="button" title="Remove file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    filePreviewContainer.appendChild(chip);
  });

  document.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const indexToRemove = parseInt(
        e.currentTarget.getAttribute("data-index"),
      );
      window.attachedFiles.splice(indexToRemove, 1);
      window.renderFilePreviews();
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const plusBtn = document.getElementById("ai-plus-btn");
  const uploadPopup = document.getElementById("ai-upload-popup");
  const aiUploadDeviceBtn = document.getElementById("ai-upload-device-btn");
  const fileInput = document.getElementById("ai-file-input");

  if (plusBtn && uploadPopup) {
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      uploadPopup.classList.toggle("show");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      uploadPopup &&
      uploadPopup.classList.contains("show") &&
      !e.target.closest(".upload-container")
    ) {
      uploadPopup.classList.remove("show");
    }
  });

  if (aiUploadDeviceBtn && fileInput) {
    aiUploadDeviceBtn.addEventListener("click", () => {
      fileInput.click();
      uploadPopup.classList.remove("show");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        window.attachedFiles = window.attachedFiles.concat(files);
        window.renderFilePreviews();
        fileInput.value = "";
      }
    });
  }
});
/* --- END OF COMPLETE UPLOAD & FILE CHIP LOGIC --- */

/* --- START OF AI HISTORY LOGIC --- */
document.addEventListener("DOMContentLoaded", () => {
  const historyBtn = document.getElementById("ai-history-btn");
  const historyDropdown = document.getElementById("ai-history-dropdown");
  const historyList = document.getElementById("ai-history-list");
  const aiChatBody = document.getElementById("ai-chat-body");

  // 1. PERMANENT STORAGE: Load history from the browser's local storage
  let chatHistory = JSON.parse(localStorage.getItem("ai_chat_history")) || [];

  // Expose save function globally so sendChatMessage can use it
  window.saveInteractionToHistory = function (userText, botText) {
    const interaction = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      user: userText,
      bot: botText,
    };
    chatHistory.unshift(interaction); // Add newest to the top
    // PERMANENTLY SAVE to browser
    localStorage.setItem("ai_chat_history", JSON.stringify(chatHistory));
    renderHistoryDropdown();
  };

  function renderHistoryDropdown() {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (chatHistory.length === 0) {
      historyList.innerHTML =
        '<div style="padding: 12px 16px; color: #9aa0a6; font-size: 12px;">No history yet.</div>';
      return;
    }

    chatHistory.forEach((item) => {
      const div = document.createElement("div");
      div.className = "ai-history-item";

      // Injecting the text, the 3 dots, and the hidden delete menu
      div.innerHTML = `
                <div class="ai-history-item-content">
                    <div class="ai-history-item-query">${item.user.replace(/\n/g, " ")}</div>
                    <div class="ai-history-item-date">${item.date}</div>
                </div>
                <button class="ai-history-more-btn" title="More options">
                    <span class="material-symbols-outlined" style="font-size: 18px;">more_vert</span>
                </button>
                <div class="ai-history-delete-menu hidden">
                    <button class="ai-history-delete-btn">
                        <span class="material-symbols-outlined">delete</span>
                        Delete
                    </button>
                </div>
            `;

      const contentArea = div.querySelector(".ai-history-item-content");
      const moreBtn = div.querySelector(".ai-history-more-btn");
      const deleteMenu = div.querySelector(".ai-history-delete-menu");
      const deleteBtn = div.querySelector(".ai-history-delete-btn");

      // Action A: Click the text area to load the chat
      contentArea.addEventListener("click", () => {
        loadInteraction(item);
        historyDropdown.classList.add("hidden-dropdown");
      });

      // Action B: Click the 3 dots to open the delete menu
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevents the chat from loading
        // Close any other open delete menus first
        document.querySelectorAll(".ai-history-delete-menu").forEach((menu) => {
          if (menu !== deleteMenu) menu.classList.add("hidden");
        });
        deleteMenu.classList.toggle("hidden");
      });

      // Action C: Click "Delete" to PERMANENTLY remove the item
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Remove this specific item from the array
        chatHistory = chatHistory.filter((h) => h.id !== item.id);
        // Save the updated array to local storage PERMANENTLY
        localStorage.setItem("ai_chat_history", JSON.stringify(chatHistory));
        // Redraw the list
        renderHistoryDropdown();
      });

      historyList.appendChild(div);
    });
  }

  function loadInteraction(item) {
    if (!aiChatBody) return;
    aiChatBody.innerHTML = ""; // Clear current chat screen

    // Re-create user message bubble
    const userDiv = document.createElement("div");
    userDiv.className = "ai-msg-user";
    userDiv.textContent = item.user;
    aiChatBody.appendChild(userDiv);

    // Re-create AI message bubble (with Markdown formatting)
    const botDiv = document.createElement("div");
    botDiv.className = "ai-msg-bot";
    if (typeof marked !== "undefined") {
      botDiv.innerHTML = marked.parse(item.bot);
    } else {
      botDiv.innerHTML = item.bot.replace(/\n/g, "<br>");
    }
    aiChatBody.appendChild(botDiv);

    aiChatBody.scrollTop = aiChatBody.scrollHeight; // Scroll to bottom
  }

  // Handle opening and closing the main history menu
  if (historyBtn && historyDropdown) {
    historyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      historyDropdown.classList.toggle("hidden-dropdown");
      renderHistoryDropdown(); // Refresh list when opened
    });

    // Close dropdowns if user clicks anywhere else on the screen
    document.addEventListener("click", (e) => {
      // Close main history dropdown
      if (
        !e.target.closest("#ai-history-dropdown") &&
        !e.target.closest("#ai-history-btn")
      ) {
        historyDropdown.classList.add("hidden-dropdown");
      }
      // Close individual delete menus if clicking outside them
      if (
        !e.target.closest(".ai-history-more-btn") &&
        !e.target.closest(".ai-history-delete-menu")
      ) {
        document.querySelectorAll(".ai-history-delete-menu").forEach((menu) => {
          menu.classList.add("hidden");
        });
      }
    });
  }

  // Initial render on page load
  renderHistoryDropdown();
});
/* --- END OF AI HISTORY LOGIC --- */
/* --- START OF NEW CHAT LOGIC --- */
document.addEventListener("DOMContentLoaded", () => {
  const newChatBtn = document.getElementById("ai-new-chat-btn");
  const aiChatBody = document.getElementById("ai-chat-body");
  const aiChatInput = document.getElementById("ai-chat-input");
  const aiSendBtn = document.getElementById("ai-send-btn");

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      // 1. Clear the chat screen (closes previous session visually)
      if (aiChatBody) {
        aiChatBody.innerHTML = "";
      }

      // 2. Clear the text input box
      if (aiChatInput) {
        aiChatInput.value = "";
      }

      // 3. Clear any attached files from the upload array
      window.attachedFiles = [];
      if (typeof window.renderFilePreviews === "function") {
        window.renderFilePreviews();
      }

      // 4. Hide the Royal Send button (since the input is now empty)
      if (aiSendBtn) {
        aiSendBtn.classList.add("hidden-send");
      }
    });
  }
});
/* --- END OF NEW CHAT LOGIC --- */

/* =========================================
   PDF LIBRARY FETCH & RENDER LOGIC
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Fetch PDFs as soon as the page loads
  fetchPDFs();
});

async function fetchPDFs() {
  try {
    // Calls your backend route
    const response = await fetch("http://localhost:3000/api/pdfs");
    const pdfs = await response.json();
    renderPDFRows(pdfs);
  } catch (error) {
    console.error("Error fetching PDFs:", error);
  }
}

function renderPDFRows(pdfs) {
  const container = document.getElementById("pdf-container");
  if (!container) return;

  container.innerHTML = ""; // Clear container

  // Group PDFs into fake categories for the row layout
  const categories = {
    "Continue Reading": pdfs.slice(0, 5),
    "Recommended for You": pdfs.slice(5, 10),
    "Recently Added": pdfs.slice(10, 15),
  };

  // If you have less than 5 PDFs, just show them in one row
  if (pdfs.length < 5) {
    categories["All Books"] = pdfs;
  }

  // Loop through categories and build rows
  for (const [categoryName, categoryPdfs] of Object.entries(categories)) {
    if (!categoryPdfs || categoryPdfs.length === 0) continue;

    // Create Row Container
    const rowContainer = document.createElement("div");
    rowContainer.className = "pdf-row-container";

    // Create Row Title
    const title = document.createElement("h2");
    title.className = "row-title";
    title.textContent = categoryName;
    rowContainer.appendChild(title);

    // Create Horizontal Scrolling Area
    const row = document.createElement("div");
    row.className = "pdf-row";

    // Add PDF Cards to the row
    categoryPdfs.forEach((pdf) => {
      const pdfLink = document.createElement("a");
      if (pdf.pdf_drive_id) {
        // Link to our new viewer page, passing the ID and Title in the URL
        pdfLink.href = `view-pdf.html?id=${encodeURIComponent(pdf.pdf_drive_id)}&title=${encodeURIComponent(pdf.title)}`;
      } else {
        pdfLink.href = "#";
      }
      // THIS MAKES IT OPEN IN A NEW TAB
      pdfLink.target = "_blank";

      pdfLink.className = "pdf-card";

      // Placeholder image if your database doesn't have thumbnails yet
      const imageUrl =
        pdf.thumbnail_url ||
        "https://images.unsplash.com/photo-1618365908648-e71bd5716cba?q=80&w=250&auto=format&fit=crop";

      pdfLink.innerHTML = `
                <img src="${imageUrl}" alt="PDF Cover" class="pdf-thumbnail" referrerpolicy="no-referrer">
                <div class="pdf-info">
                    <p class="pdf-title">${pdf.title || "Untitled Document"}</p>
                </div>
            `;

      row.appendChild(pdfLink);
    });

    rowContainer.appendChild(row);
    container.appendChild(rowContainer);
  }
}
