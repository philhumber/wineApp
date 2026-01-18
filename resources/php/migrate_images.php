<?php
/**
 * Migration script to reprocess existing wine images to 800x800 square format
 *
 * Usage:
 *   php migrate_images.php              # Process all images
 *   php migrate_images.php --dry-run    # List images without modifying
 *   php migrate_images.php --skip-backup # Skip backup creation
 *
 * This script:
 * - Backs up all existing images to images/wines_backup/
 * - Reprocesses each image to 800x800 square with edge-sampled background
 * - Converts all images to JPEG format
 * - Skips the placeholder image (placeBottle.png)
 */

// Include the upload.php to reuse getDominantEdgeColor and processing logic
require_once __DIR__ . '/upload.php';

// Configuration
$imageDir = dirname(__DIR__, 2) . '/images/wines';
$backupDir = dirname(__DIR__, 2) . '/images/wines_backup';
$canvasSize = 800;
$skipFiles = ['placeBottle.png']; // Files to skip

// Parse command line arguments
$dryRun = in_array('--dry-run', $argv);
$skipBackup = in_array('--skip-backup', $argv);

echo "===========================================\n";
echo "Wine Image Migration Script\n";
echo "===========================================\n";
echo "Mode: " . ($dryRun ? "DRY RUN (no changes)" : "LIVE") . "\n";
echo "Source: $imageDir\n";
echo "Backup: " . ($skipBackup ? "SKIPPED" : $backupDir) . "\n";
echo "Canvas: {$canvasSize}x{$canvasSize}px\n";
echo "-------------------------------------------\n\n";

// Get all image files
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$images = [];

if (!is_dir($imageDir)) {
    die("Error: Image directory not found: $imageDir\n");
}

$files = scandir($imageDir);
foreach ($files as $file) {
    if ($file === '.' || $file === '..') continue;
    if (in_array($file, $skipFiles)) continue;

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (in_array($ext, $allowedExtensions)) {
        $images[] = $file;
    }
}

echo "Found " . count($images) . " images to process\n\n";

if (count($images) === 0) {
    echo "No images to process. Exiting.\n";
    exit(0);
}

// Create backup directory if needed
if (!$dryRun && !$skipBackup) {
    if (!is_dir($backupDir)) {
        if (!mkdir($backupDir, 0777, true)) {
            die("Error: Could not create backup directory: $backupDir\n");
        }
        echo "Created backup directory: $backupDir\n\n";
    }
}

// Process each image
$processed = 0;
$skipped = 0;
$errors = 0;

foreach ($images as $index => $filename) {
    $sourcePath = $imageDir . DIRECTORY_SEPARATOR . $filename;
    $num = $index + 1;
    $total = count($images);

    echo "[$num/$total] Processing: $filename\n";

    if ($dryRun) {
        // Just show what would happen
        $info = @getimagesize($sourcePath);
        if ($info) {
            echo "  Current: {$info[0]}x{$info[1]}px\n";
            echo "  Output:  {$canvasSize}x{$canvasSize}px (JPEG)\n";
        } else {
            echo "  Warning: Could not read image info\n";
        }
        $processed++;
        continue;
    }

    // Backup original
    if (!$skipBackup) {
        $backupPath = $backupDir . DIRECTORY_SEPARATOR . $filename;
        if (!copy($sourcePath, $backupPath)) {
            echo "  ERROR: Failed to backup, skipping\n";
            $errors++;
            continue;
        }
        echo "  Backed up to: wines_backup/$filename\n";
    }

    // Generate new filename (always .jpg)
    $newFilename = pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
    $tempPath = $imageDir . DIRECTORY_SEPARATOR . 'temp_' . $newFilename;

    // Process the image using the updated rotateAndResizeImage function
    $result = rotateAndResizeImage($sourcePath, $tempPath, $canvasSize);

    if (strpos($result, 'Error') === 0) {
        echo "  ERROR: $result\n";
        @unlink($tempPath); // Clean up temp file
        $errors++;
        continue;
    }

    // Remove original if different extension
    if ($filename !== $newFilename) {
        if (!unlink($sourcePath)) {
            echo "  WARNING: Could not remove original file\n";
        }
    }

    // Move temp to final location
    $finalPath = $imageDir . DIRECTORY_SEPARATOR . $newFilename;
    if (file_exists($finalPath) && $finalPath !== $sourcePath) {
        unlink($finalPath); // Remove if exists (shouldn't happen with GUID names)
    }
    rename($tempPath, $finalPath);

    $info = @getimagesize($finalPath);
    echo "  Output: {$info[0]}x{$info[1]}px -> $newFilename\n";
    $processed++;
}

echo "\n-------------------------------------------\n";
echo "Migration Complete!\n";
echo "-------------------------------------------\n";
echo "Processed: $processed\n";
echo "Skipped:   $skipped\n";
echo "Errors:    $errors\n";

if ($dryRun) {
    echo "\nThis was a DRY RUN. No files were modified.\n";
    echo "Run without --dry-run to apply changes.\n";
}

if (!$skipBackup && !$dryRun && $processed > 0) {
    echo "\nBackups saved to: $backupDir\n";
    echo "To restore: copy files from wines_backup/ back to wines/\n";
}
?>
