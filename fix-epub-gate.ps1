$htmlPath = "c:\Users\Padam Kishore\Pictures\E-LIBRARY\PDF-Library\frontend\view-epub.html"
$htmlContent = Get-Content $htmlPath -Raw

# Update showGatedMode
$oldShowGated = @"
        // Show the reader app with preview content visible behind the gate
        document.getElementById("epub-reader-app").classList.remove("hidden");
        document.getElementById("epub-loading").style.display = "grid";
        document.body.classList.remove("is-authenticated");

        const gate = document.getElementById("reader-gate");
        gate.style.display = "";
        gate.classList.remove("hidden");
"@

$newShowGated = @"
        // Show the reader app with preview content visible behind the gate
        document.getElementById("epub-reader-app").classList.remove("hidden");
        document.getElementById("epub-reader-app").classList.add("preview-mode");
        document.getElementById("epub-loading").style.display = "grid";
        document.body.classList.remove("is-authenticated");

        const gate = document.getElementById("reader-gate");
        gate.style.display = "";
        gate.classList.remove("hidden");
        gate.classList.add("preview-active");
"@

$htmlContent = $htmlContent.Replace($oldShowGated, $newShowGated)

# Update handleAuthenticatedReader
$oldAuthGated = @"
        renderUserNav(user);
        document.body.classList.add("is-authenticated");
        document.getElementById("epub-reader-app").classList.remove("hidden");
        document.getElementById("epub-loading").style.display = "grid";
        const gate = document.getElementById("reader-gate");
        gate.style.display = "";
        gate.classList.remove("hidden");
"@

$newAuthGated = @"
        renderUserNav(user);
        document.body.classList.add("is-authenticated");
        document.getElementById("epub-reader-app").classList.remove("hidden");
        document.getElementById("epub-reader-app").classList.add("preview-mode");
        document.getElementById("epub-loading").style.display = "grid";
        const gate = document.getElementById("reader-gate");
        gate.style.display = "";
        gate.classList.remove("hidden");
        gate.classList.add("preview-active");
"@

$htmlContent = $htmlContent.Replace($oldAuthGated, $newAuthGated)

# Update unlockReader to remove preview classes
$oldUnlock = @"
        document.body.classList.add("is-authenticated");
        document.getElementById("epub-reader-app").classList.remove("hidden");
        document.getElementById("epub-loading").style.display = "grid";
        
        const gate = document.getElementById("reader-gate");
        gate.classList.add("unlocking");
"@

$newUnlock = @"
        document.body.classList.add("is-authenticated");
        const app = document.getElementById("epub-reader-app");
        app.classList.remove("hidden");
        app.classList.remove("preview-mode");
        document.getElementById("epub-loading").style.display = "grid";
        
        const gate = document.getElementById("reader-gate");
        gate.classList.remove("preview-active");
        gate.classList.add("unlocking");
"@

$htmlContent = $htmlContent.Replace($oldUnlock, $newUnlock)

Set-Content $htmlPath -Value $htmlContent -NoNewline
Write-Host "Updated view-epub.html logic"

$cssPath = "c:\Users\Padam Kishore\Pictures\E-LIBRARY\PDF-Library\frontend\assets\css\epub-reader.css"
$cssContent = Get-Content $cssPath -Raw

$cssChanges = @"

/* PREVIEW MODE FOR GATED BOOKS */
.epub-reader-app.preview-mode {
  height: 52vh;
  min-height: 52vh;
  overflow: hidden;
}

.epub-reader-gate.preview-active {
  inset: calc(68px + 52vh) 0 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at 50% 10%, rgba(10, 10, 14, 0.98), rgba(10, 10, 14, 0.96) 60%);
}
"@

$cssContent += $cssChanges
Set-Content $cssPath -Value $cssContent -NoNewline
Write-Host "Updated epub-reader.css logic"
