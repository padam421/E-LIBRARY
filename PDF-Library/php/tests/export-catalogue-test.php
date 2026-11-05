<?php
declare(strict_types=1);
require __DIR__ . '/../export-catalogue.php';

$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

function csvRows(array $books): array
{
    $buffer = fopen('php://temp', 'w+');
    writeCatalogueCsv($books, $buffer);
    rewind($buffer);
    $rows = [];
    while (($row = fgetcsv($buffer, 0, ',', '"', '')) !== false) $rows[] = $row;
    fclose($buffer);
    return $rows;
}

$rows = csvRows([
    ['id' => 1, 'title' => 'A "quoted", book', 'author' => "Line one\nLine two", 'has_pdf' => true, 'has_epub' => true],
    ['id' => '2', 'title' => 'हिन्दी पुस्तक', 'is_private' => 0],
    ['id' => 3, 'title' => 'Private book', 'is_private' => 1],
]);
check(count($rows) === 3, 'Private books must be excluded.');
check($rows[0] === ['ID', 'Title', 'Author', 'Category', 'Formats'], 'CSV header mismatch.');
check($rows[1][1] === 'A "quoted", book' && $rows[1][2] === "Line one\nLine two", 'CSV quoting must round-trip.');
check($rows[1][4] === 'PDF / EPUB', 'Both formats must appear.');
check($rows[2][1] === 'हिन्दी पुस्तक', 'Unicode must round-trip.');
check(count(csvRows([])) === 1, 'Empty catalogues must have a header.');
foreach (['=SUM(1,2)', '+1', '-1', '@SUM(A1)', '  =1', "\ttext", "\n=1"] as $formula) {
    check(str_starts_with(catalogueCsvCell($formula), "'"), 'Spreadsheet formula was not escaped.');
}
check(catalogueCsvCell('Normal title') === 'Normal title', 'Normal text must remain unchanged.');
foreach ([['id' => 0, 'title' => 'Invalid'], ['id' => [], 'title' => 'Invalid'], ['id' => 1, 'title' => []], ['id' => 1, 'title' => 'Valid', 'author' => []]] as $invalid) {
    $rejected = false;
    try { csvRows([$invalid]); } catch (RuntimeException $error) { $rejected = true; }
    check($rejected, 'Malformed metadata must be rejected.');
}

$input = tempnam(sys_get_temp_dir(), 'library-input-');
$output = $input . '.csv';
try {
    file_put_contents($input, json_encode([['id' => 1, 'title' => 'CLI export']], JSON_THROW_ON_ERROR));
    check(runCatalogueExport(['--input', $input, '--output', $output]) === 0, 'CLI export failed.');
    check(str_contains(file_get_contents($output), 'CLI export'), 'Output file is incomplete.');
    check(runCatalogueExport(['--input', $input, '--output', $output]) === 1, 'Existing files must never be overwritten.');
    file_put_contents($input, '{"error":"Not a book array"}');
    check(runCatalogueExport(['--input', $input]) === 1, 'Object API responses must be rejected.');
    file_put_contents($input, 'not json');
    check(runCatalogueExport(['--input', $input]) === 1, 'Invalid JSON must be rejected.');
    check(runCatalogueExport(['--api', 'file:///etc/passwd']) === 1, 'Non-HTTP API origins must be rejected.');
    check(runCatalogueExport(['--input']) === 1, 'Missing arguments must be rejected.');
} finally {
    unlink($input);
    if (is_file($output)) unlink($output);
}
echo "PASS: {$checks} catalogue export checks.\n";
