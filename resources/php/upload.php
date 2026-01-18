<?php
// ----------------------------
// CONFIG
// ----------------------------
$target_dir    = dirname(__DIR__, 2) . "/images/wines"; // absolute path
$hardcodedFile = __DIR__ . "/sample.jpg";              // CLI test file
$maxFileSize   = 10 * 1024 * 1024;                      // 10MB
$allowedTypes  = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$canvasSize    = 800;   // Output square canvas size (800x800px)

// Ensure target directory exists
if (!is_dir($target_dir)) {
    mkdir($target_dir, 0777, true);
}

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------
function generate_guid_filename(string $extension): string {
    return bin2hex(random_bytes(16)) . '.' . $extension;
}

function is_cli(): bool {
    return php_sapi_name() === 'cli';
}

function get_uploaded_file() {
    global $hardcodedFile;

    if (is_cli()) {
        if (!file_exists($hardcodedFile)) {
            return "Error: Hardcoded file not found: $hardcodedFile";
        }

        return [
            'name'     => basename($hardcodedFile),
            'type'     => function_exists('mime_content_type') ? mime_content_type($hardcodedFile) : 'image/jpeg',
            'tmp_name' => $hardcodedFile,
            'error'    => 0,
            'size'     => filesize($hardcodedFile),
        ];
    }

    if (!isset($_FILES['fileToUpload'])) {
        return("Error: No file uploaded.");
    }

    return $_FILES['fileToUpload'];
}

function validate_image(array $file, array $allowedTypes, int $maxSize): bool {
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if ($file['size'] > $maxSize) {
        echo "Error: File is too large.\n";
        return false;
    }

    if (!in_array($extension, $allowedTypes)) {
        echo "Error: Only " . implode(', ', $allowedTypes) . " files are allowed.\n";
        return false;
    }

    $check = getimagesize($file['tmp_name']);
    if ($check === false) {
        echo "Error: File is not a valid image.\n";
        return false;
    }

    return true;
}

function get_unique_filename(string $dir, string $extension): string {
    do {
        $filename = generate_guid_filename($extension);
        $fullPath = $dir . DIRECTORY_SEPARATOR . $filename;
    } while (file_exists($fullPath));

    return $filename;
}

/**
 * Sample edge pixels and find dominant color for background
 * @param resource $image GD image resource
 * @return array RGB color ['red' => int, 'green' => int, 'blue' => int]
 */
function getDominantEdgeColor($image) {
    $width = imagesx($image);
    $height = imagesy($image);
    $white = ['red' => 255, 'green' => 255, 'blue' => 255];

    // ---- Quick check: sample top-left corner (5 pixels diagonal) ----
    $transparentCount = 0;
    $whiteCount = 0;

    for ($i = 0; $i < 5; $i++) {
        $color = imagecolorat($image, $i, $i);
        $alpha = ($color >> 24) & 0x7F;

        if ($alpha > 64) {
            $transparentCount++;
            continue;
        }

        $r = ($color >> 16) & 0xFF;
        $g = ($color >> 8) & 0xFF;
        $b = $color & 0xFF;

        if ($r > 240 && $g > 240 && $b > 240) {
            $whiteCount++;
        }
    }

    // If 3+ transparent or 3+ white, use white
    if ($transparentCount >= 3 || $whiteCount >= 3) {
        return $white;
    }

    // ---- Full edge sampling ----
    $colors = [];
    $step = 5;

    for ($x = 0; $x < $width; $x += $step) {
        $colors[] = imagecolorat($image, $x, 0);
        $colors[] = imagecolorat($image, $x, $height - 1);
    }
    for ($y = 0; $y < $height; $y += $step) {
        $colors[] = imagecolorat($image, 0, $y);
        $colors[] = imagecolorat($image, $width - 1, $y);
    }

    // Find dominant color using binning
    $bins = [];
    $binSize = 32;
    $transparentPixels = 0;

    foreach ($colors as $color) {
        $alpha = ($color >> 24) & 0x7F;

        if ($alpha > 64) {
            $transparentPixels++;
            continue;
        }

        $r = ($color >> 16) & 0xFF;
        $g = ($color >> 8) & 0xFF;
        $b = $color & 0xFF;

        $binKey = (intdiv($r, $binSize) * $binSize) . '_' .
                  (intdiv($g, $binSize) * $binSize) . '_' .
                  (intdiv($b, $binSize) * $binSize);

        if (!isset($bins[$binKey])) {
            $bins[$binKey] = ['count' => 0, 'r' => 0, 'g' => 0, 'b' => 0];
        }
        $bins[$binKey]['count']++;
        $bins[$binKey]['r'] += $r;
        $bins[$binKey]['g'] += $g;
        $bins[$binKey]['b'] += $b;
    }

    // If majority transparent, use white
    if ($transparentPixels > count($colors) / 2) {
        return $white;
    }

    // Find most frequent bin
    $maxCount = 0;
    $dominantBin = null;
    foreach ($bins as $bin) {
        if ($bin['count'] > $maxCount) {
            $maxCount = $bin['count'];
            $dominantBin = $bin;
        }
    }

    if ($dominantBin === null) {
        return $white;
    }

    return [
        'red'   => intdiv($dominantBin['r'], $dominantBin['count']),
        'green' => intdiv($dominantBin['g'], $dominantBin['count']),
        'blue'  => intdiv($dominantBin['b'], $dominantBin['count'])
    ];
}



/**
 * Process image: rotate (EXIF), resize to fit canvas, center on square with edge-sampled background
 * @param string $sourcePath Path to source image
 * @param string $targetPath Path for output (will be converted to .jpg)
 * @param int $canvasSize Size of square output canvas (default 800)
 * @return string Path to saved file or error message
 */
function rotateAndResizeImage($sourcePath, $targetPath, $canvasSize = 800) {
    // Force JPEG output - replace any extension with .jpg
    $targetPath = preg_replace('/\.(png|gif|webp|jpeg|jpg)$/i', '.jpg', $targetPath);

    $info = getimagesize($sourcePath);
    if ($info === false) {
        return "Error: Cannot get image info.";
    }

    list($origWidth, $origHeight, $imageType) = $info;

    // Load source image based on type
    switch ($imageType) {
        case IMAGETYPE_JPEG: $source = imagecreatefromjpeg($sourcePath); break;
        case IMAGETYPE_PNG:  $source = imagecreatefrompng($sourcePath); break;
        case IMAGETYPE_GIF:  $source = imagecreatefromgif($sourcePath); break;
        case IMAGETYPE_WEBP: $source = imagecreatefromwebp($sourcePath); break;
        default: return "Error: Unsupported image type.";
    }

    // ---- Rotate JPEG according to EXIF orientation ----
    if ($imageType === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($sourcePath);
        $orientation = isset($exif['Orientation']) ? (int)$exif['Orientation'] : 1;
        switch ($orientation) {
            case 3: $source = imagerotate($source, 180, 0); break;
            case 6: $source = imagerotate($source, -90, 0); break;
            case 8: $source = imagerotate($source, 90, 0); break;
        }
        $origWidth = imagesx($source);
        $origHeight = imagesy($source);
    }

    // ---- Calculate resize dimensions to fit within canvas (maintaining aspect ratio) ----
    $ratio = $origWidth / $origHeight;
    if ($ratio > 1) {
        // Wider than tall
        $newWidth = $canvasSize;
        $newHeight = (int)($canvasSize / $ratio);
    } else {
        // Taller than wide (or square)
        $newHeight = $canvasSize;
        $newWidth = (int)($canvasSize * $ratio);
    }

    // ---- Create resized image (temporary, for edge sampling) ----
    $resized = imagecreatetruecolor($newWidth, $newHeight);

    // Preserve transparency for PNG/GIF/WebP during resize (needed for edge color sampling)
    if ($imageType == IMAGETYPE_PNG || $imageType == IMAGETYPE_GIF || $imageType == IMAGETYPE_WEBP) {
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
        imagefill($resized, 0, 0, $transparent);
    }

    imagecopyresampled($resized, $source, 0, 0, 0, 0,
                       $newWidth, $newHeight, $origWidth, $origHeight);

    // ---- Sample dominant edge color for background ----
    $bgColor = getDominantEdgeColor($resized);

    // ---- Create final square canvas with background color ----
    $canvas = imagecreatetruecolor($canvasSize, $canvasSize);
    $background = imagecolorallocate($canvas,
                                     $bgColor['red'],
                                     $bgColor['green'],
                                     $bgColor['blue']);
    imagefill($canvas, 0, 0, $background);

    // ---- Calculate center position ----
    $x = (int)(($canvasSize - $newWidth) / 2);
    $y = (int)(($canvasSize - $newHeight) / 2);

    // ---- Paste resized image onto canvas at center ----
    imagecopy($canvas, $resized, $x, $y, 0, 0, $newWidth, $newHeight);

    // ---- Save as JPEG at 90% quality ----
    imagejpeg($canvas, $targetPath, 90);

    // ---- Cleanup ----
    imagedestroy($source);
    imagedestroy($resized);
    imagedestroy($canvas);

    return $targetPath;
}

// ----------------------------
// MAIN SCRIPT
// ----------------------------
$uploadedFile  = get_uploaded_file();
// Check if it's a valid upload
if (!isset($uploadedFile) || !is_array($uploadedFile) || !isset($uploadedFile['name'])) {
    $output = 'Error: Invalid file upload. Likely the image is too large or the wrong format.';
    echo json_encode($output);
    return;
}
    $imageFileType = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
 
if (!validate_image($uploadedFile, $allowedTypes, $maxFileSize)) {
    $output = "Error: Upload failed.";
}else{
    // Always generate .jpg filename since output is forced to JPEG
    $guidFilename = get_unique_filename($target_dir, 'jpg');
    $finalFile = $target_dir . DIRECTORY_SEPARATOR . $guidFilename;
    try{
        $output = rotateAndResizeImage($uploadedFile['tmp_name'], $finalFile, $canvasSize);
        echo "Filename: images/wines/" . basename($output);
        return;
    }catch(Exception $e) {
        $output = ['data' => 'Error: ' . $e->getMessage()];
        $output = json_encode($output);	
    }
}
?>