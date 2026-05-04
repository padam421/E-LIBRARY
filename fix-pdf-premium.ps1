$filePath = "c:\Users\Padam Kishore\Pictures\E-LIBRARY\PDF-Library\frontend\view-pdf.html"
$content = Get-Content $filePath -Raw

$renderUserNav = @"
      function renderUserNav(user) {
        const initials = getInitials(user.name, user.email);
        const firstName =
          user.given_name ||
          (user.name ? String(user.name).trim().split(" ")[0] : "User");
        const navSlot  = document.getElementById("nav-right-slot");
        const pictureSrc = safeImageSrc(user.picture);
        const safeInitials = escapeHtml(initials);
        const safeFirstName = escapeHtml(firstName);

        navSlot.innerHTML = pictureSrc
          ? `<div class="reader-user-chip"><img class="reader-avatar" src="`${escapeHtml(pictureSrc)}`" alt="`${safeInitials}`" referrerpolicy="no-referrer" /><span>`${safeFirstName}`</span></div>`
          : `<div class="reader-user-chip"><div class="reader-avatar-initials">`${safeInitials}`</div><span>`${safeFirstName}`</span></div>`;
      }
"@

# Replace unlockReader body to use renderUserNav
$content = $content -replace '(?s)function unlockReader\(user, animate\) \{.*?navSlot\.innerHTML = .*?;', "function unlockReader(user, animate) {`n        renderUserNav(user);"

# Add renderUserNav before unlockReader
$content = $content -replace 'function unlockReader\(user, animate\) \{', "$renderUserNav`n`n      function unlockReader(user, animate) {"

# Now fix handleAuthenticatedReader
$handleAuthOld = @"
        const page = document.getElementById("reader-page");
        const wrap = document.getElementById("custom-pdf-wrapper");
        const gate = document.getElementById("reader-gate");
        const fade = document.getElementById("pdf-preview-fade");
        const loading = document.getElementById("pdf-loading");

        page.classList.remove("authenticated");
        document.body.classList.remove("is-authenticated");
"@

$handleAuthNew = @"
        renderUserNav(user);
        
        const page = document.getElementById("reader-page");
        const wrap = document.getElementById("custom-pdf-wrapper");
        const gate = document.getElementById("reader-gate");
        const fade = document.getElementById("pdf-preview-fade");
        const loading = document.getElementById("pdf-loading");

        page.classList.remove("authenticated");
        document.body.classList.add("is-authenticated");
"@

$content = $content.Replace($handleAuthOld, $handleAuthNew)

Set-Content $filePath -Value $content -NoNewline
Write-Host "Updated view-pdf.html successfully"
