$filePath = "c:\Users\Padam Kishore\Pictures\E-LIBRARY\PDF-Library\frontend\assets\js\auth.js"
$content = Get-Content $filePath -Raw

$oldFunc = @"
function getScopedStorageKey(prefix, email = activeEmail) {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey) return null;
  return `${prefix}::${emailKey}`;
}
"@

$newFunc = @"
function getScopedStorageKey(prefix, email = activeEmail) {
  const emailKey = normalizeEmailKey(email);
  return emailKey ? "`${prefix}::`${emailKey}`" : "`${prefix}::guest`";
}
"@

$content = $content.Replace($oldFunc, $newFunc)

Set-Content $filePath -Value $content -NoNewline
Write-Host "Updated getScopedStorageKey successfully"
