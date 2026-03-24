// Jab poori website load ho jaye, tab ye code chalega
window.addEventListener("load", () => {
  // 2.5 second (2500 miliseconds) ka timer set kiya hai
  setTimeout(() => {
    // Splash screen ko poori tarah hide kar do
    document.getElementById("splash-screen").style.display = "none";

    // Main website ko dikha do
    document.getElementById("main-content").style.display = "block";

    // Scrolling wapas chalu kar do
    document.body.style.overflow = "auto";
  }, 0.1);
});
// Function called automatically by Google Sign-In upon success
function handleCredentialResponse(response) {
  // Google returns a JWT (JSON Web Token). We need to decode it to get user info.
  const responsePayload = decodeJwt(response.credential);

  const userName = responsePayload.name;
  const userEmail = responsePayload.email;
  const userPicture = responsePayload.picture;
  const givenName = responsePayload.given_name || userName.split(" ")[0];

  // Hide Sign-In Button, Show Profile Container
  document.getElementById("google-signin-btn").classList.add("hidden");
  document.getElementById("user-profile-container").classList.remove("hidden");

  // Populate Popup Data
  document.getElementById("popup-email").innerText = userEmail;
  document.getElementById("popup-greeting").innerText = `Hi, ${givenName}!`;

  // Handle Image vs Initials Logic
  const avatarBtn = document.getElementById("profile-avatar-btn");
  const popupImg = document.getElementById("popup-avatar-img");
  const popupInitials = document.getElementById("popup-avatar-initials");

  // Check if the picture exists and is not a default silhouette from Google
  if (userPicture && !userPicture.includes("default-user")) {
    // Display Image
    avatarBtn.innerHTML = `<img src="${userPicture}" alt="Profile">`;
    popupImg.src = userPicture;
    popupImg.classList.remove("hidden");
    popupInitials.classList.add("hidden");
  } else {
    // Generate Initials (e.g., Padam Kishore -> PK)
    const initials = getInitials(userName);
    avatarBtn.innerHTML = initials;

    popupInitials.innerText = initials;
    popupInitials.classList.remove("hidden");
    popupImg.classList.add("hidden");
  }

  // Optional: Send 'response.credential' to your backend (e.g., $Root/backend/src/routes/authRoutes.js)
  // to verify the token and establish a session.
}

// Utility: Decode JWT
function decodeJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
  return JSON.parse(jsonPayload);
}

// Utility: Get Initials from Name
function getInitials(name) {
  let initials = name.match(/\b\w/g) || [];
  initials = ((initials.shift() || "") + (initials.pop() || "")).toUpperCase();
  return initials;
}

// UI Toggle: Show/Hide the popup
function toggleProfilePopup() {
  const popup = document.getElementById("profile-popup");
  popup.classList.toggle("hidden");
}

// UI Action: Sign out
function signOut() {
  // Hide Profile, Show Sign-in button
  document.getElementById("user-profile-container").classList.add("hidden");
  document.getElementById("google-signin-btn").classList.remove("hidden");

  // Ensure popup is closed
  document.getElementById("profile-popup").classList.add("hidden");

  // Revoke Google session (optional but recommended for complete sign-out)
  google.accounts.id.disableAutoSelect();
}
