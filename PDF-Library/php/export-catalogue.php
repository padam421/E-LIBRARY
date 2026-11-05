<?php
declare(strict_types=1);

// Supplementary CLI report tool. The main application remains Node.js/Express.
// Usage: php export-catalogue.php --input catalogue.json --output catalogue.csv
// Or:    php export-catalogue.php --api https://your-api.example --output catalogue.csv
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function catalogueCsvCell(string $value): string
{
    // Prevent spreadsheet applications from interpreting metadata as formulas.
    return preg_match('/^[\s\x00-\x1F]*[=+@-]|^[\t\r\n]/u', $value) ? "'" . $value : $value;
}

function writeCatalogueCsv(array $books, $stream): void
{
    fputcsv($stream, ['ID', 'Title', 'Author', 'Category', 'Formats'], ',', '"', '', "\r\n");
    foreach ($books as $book) {
        if (!is_array($book) || !isset($book['id'], $book['title']) ||
            !is_int($book['id']) && !is_string($book['id']) ||
            !ctype_digit((string) $book['id']) || (int) $book['id'] < 1 ||
            !is_string($book['title'])) {
            throw new RuntimeException('Invalid catalogue row. Expected a positive ID and a title.');
        }
        // Also exclude private entries when processing a local JSON export.
        if (in_array($book['is_private'] ?? false, [true, 1, '1'], true)) {
            continue;
        }
        $formats = [];
        if (in_array($book['has_pdf'] ?? false, [true, 1], true)) $formats[] = 'PDF';
        if (in_array($book['has_epub'] ?? false, [true, 1], true)) $formats[] = 'EPUB';
        $row = [(string) $book['id'], $book['title'], $book['author'] ?? '', $book['category'] ?? '', implode(' / ', $formats)];
        foreach ($row as $cell) {
            if (!is_string($cell)) throw new RuntimeException('Book metadata must contain text values.');
        }
        if (fputcsv($stream, array_map('catalogueCsvCell', $row), ',', '"', '', "\r\n") === false) {
            throw new RuntimeException('Could not write the catalogue.');
        }
    }
}

function runCatalogueExport(array $arguments): int
{
    try {
        $options = [];
        for ($i = 0; $i < count($arguments); $i++) {
            $option = $arguments[$i];
            if (!in_array($option, ['--api', '--input', '--output'], true) || !isset($arguments[$i + 1]) || str_starts_with($arguments[$i + 1], '--')) {
                throw new RuntimeException('Usage: php export-catalogue.php [--api ORIGIN | --input FILE.json] [--output FILE.csv]');
            }
            if (isset($options[$option])) throw new RuntimeException('Duplicate option.');
            $options[$option] = $arguments[++$i];
        }
        if (isset($options['--api'], $options['--input'])) throw new RuntimeException('Choose either --api or --input.');
        if (isset($options['--input'])) {
            if (!is_file($options['--input'])) throw new RuntimeException('Input JSON file was not found.');
            $source = @fopen($options['--input'], 'rb');
        } else {
            $origin = rtrim($options['--api'] ?? (getenv('LIBRARY_API_ORIGIN') ?: 'https://e-library-dtx4.onrender.com'), '/');
            $url = parse_url($origin);
            if (!$url || !in_array($url['scheme'] ?? '', ['http', 'https'], true) || empty($url['host']) ||
                isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) || !in_array($url['path'] ?? '', ['', '/'], true)) {
                throw new RuntimeException('The API origin must be an HTTP(S) origin without credentials, a path or a query.');
            }
            $context = stream_context_create(['http' => ['timeout' => 45, 'follow_location' => 0, 'header' => "Accept: application/json\r\n"]]);
            $source = @fopen($origin . '/api/pdfs', 'rb', false, $context);
            if ($source === false || !preg_match('/^HTTP\/\S+ 200\b/', stream_get_meta_data($source)['wrapper_data'][0] ?? '')) {
                if (is_resource($source)) fclose($source);
                throw new RuntimeException('The public catalogue API is unavailable. Retry or use --input with a saved public JSON catalogue.');
            }
        }
        if ($source === false) throw new RuntimeException('Could not read the catalogue input.');
        $json = stream_get_contents($source, 8 * 1024 * 1024 + 1);
        fclose($source);
        if ($json === false || strlen($json) > 8 * 1024 * 1024) throw new RuntimeException('The catalogue exceeds the 8 MB input limit.');
        $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($data) || !array_is_list($data) || !str_starts_with(ltrim($json), '[')) {
            throw new RuntimeException('Expected a JSON array of public books.');
        }
        // Validate and build completely before creating the destination file.
        $buffer = fopen('php://temp/maxmemory:2097152', 'w+b');
        writeCatalogueCsv($data, $buffer);
        rewind($buffer);
        $output = isset($options['--output']) ? @fopen($options['--output'], 'xb') : fopen('php://stdout', 'wb');
        if ($output === false) throw new RuntimeException('Output could not be created. Choose a new writable filename; existing files are never overwritten.');
        if (stream_copy_to_stream($buffer, $output) === false) throw new RuntimeException('Could not save the catalogue.');
        fclose($buffer);
        fclose($output);
        return 0;
    } catch (Throwable $error) {
        fwrite(STDERR, 'Catalogue export failed: ' . $error->getMessage() . PHP_EOL);
        return 1;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    exit(runCatalogueExport(array_slice($argv, 1)));
}
