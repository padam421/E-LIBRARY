$filePath = "c:\Users\Padam Kishore\Pictures\E-LIBRARY\PDF-Library\frontend\view-pdf.html"
$content = Get-Content $filePath -Raw

$handleAuthOld = @"
        const page = document.getElementById("reader-page");
        const wrap = document.getElementById("custom-pdf-wrapper");
        const gate = document.getElementById("reader-gate");
        const fade = document.getElementById("pdf-preview-fade");
        const loading = document.getElementById("pdf-loading");

        page.classList.remove("authenticated");
        document.body.classList.add("is-authenticated");
"@

$handleAuthNew = @"
        const page = document.getElementById("reader-page");
        const wrap = document.getElementById("custom-pdf-wrapper");
        const gate = document.getElementById("reader-gate");
        const fade = document.getElementById("pdf-preview-fade");
        const loading = document.getElementById("pdf-loading");

        page.classList.remove("authenticated");
        document.body.classList.remove("is-authenticated");
"@

$content = $content.Replace($handleAuthOld, $handleAuthNew)

Set-Content $filePath -Value $content -NoNewline
Write-Host "Updated view-pdf.html successfully to remove is-authenticated"
