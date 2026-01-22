#Requires -Version 5.1
<#
.SYNOPSIS
    Deploys the Qvé Wine App to production server with backup and rollback support.

.DESCRIPTION
    This script deploys the Qvé Wine App to V:\html\wineApp with the following features:
    - Builds the SvelteKit app before deployment
    - Creates timestamped backup before deployment
    - Only deploys production-necessary files
    - Merges wine images (adds new, never overwrites existing)
    - Supports rollback to any previous backup
    - Auto-cleans backups older than retention limit (default: 5)

.PARAMETER DryRun
    Preview deployment without making changes.

.PARAMETER Rollback
    Restore from a specific backup (use timestamp format: yyyy-MM-dd_HHmmss).

.PARAMETER ListBackups
    List all available backups.

.PARAMETER SkipBuild
    Skip the npm build step (use existing build).

.EXAMPLE
    .\deploy.ps1
    Builds and deploys to production with automatic backup.

.EXAMPLE
    .\deploy.ps1 -DryRun
    Preview what would be deployed without making changes.

.EXAMPLE
    .\deploy.ps1 -SkipBuild
    Deploy without rebuilding (use existing build).

.EXAMPLE
    .\deploy.ps1 -Rollback "2026-01-22_143022"
    Restore from specific backup.

.EXAMPLE
    .\deploy.ps1 -ListBackups
    Show all available backups for rollback.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$Rollback,
    [switch]$ListBackups,
    [switch]$SkipBuild
)

# Configuration
$Config = @{
    SourcePath      = $PSScriptRoot
    QvePath         = Join-Path $PSScriptRoot "qve"
    BuildPath       = Join-Path $PSScriptRoot "qve\build"
    TargetPath      = "V:\html\wineApp"
    BackupPath      = "V:\html\wineApp-backups"
    BackupRetention = 5

    # Files to exclude from resources\php
    ExcludePhpFiles = @(
        "config.local.php"
        "config.local.php.example"
    )

    # File patterns to exclude
    ExcludePatterns = @(
        "*.log"
        "Thumbs.db"
        ".DS_Store"
        "Desktop.ini"
        "*.tmp"
    )
}

# Colors for output
function Write-Status { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host $Message -ForegroundColor Red }

function Test-Prerequisites {
    Write-Status "Checking prerequisites..."

    # Check if V: drive is accessible
    if (-not (Test-Path "V:\")) {
        Write-Error "ERROR: V: drive is not accessible. Please ensure the network drive is mapped."
        Write-Host "  To map the drive: net use V: \\10.0.0.10\www"
        return $false
    }

    # Check if source directory exists
    if (-not (Test-Path $Config.SourcePath)) {
        Write-Error "ERROR: Source path not found: $($Config.SourcePath)"
        return $false
    }

    # Check if qve directory exists
    if (-not (Test-Path $Config.QvePath)) {
        Write-Error "ERROR: Qvé app not found: $($Config.QvePath)"
        return $false
    }

    # Check if Node.js is installed
    $nodeVersion = & node --version 2>$null
    if (-not $nodeVersion) {
        Write-Error "ERROR: Node.js is not installed or not in PATH"
        return $false
    }

    Write-Success "  V: drive accessible"
    Write-Success "  Source path verified"
    Write-Success "  Qvé app found"
    Write-Success "  Node.js: $nodeVersion"
    return $true
}

function Build-QveApp {
    Write-Status "`nBuilding Qvé app..."

    if ($DryRun) {
        Write-Host "  [DRY RUN] Would run: npm run build"
        return $true
    }

    Push-Location $Config.QvePath
    try {
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "  Installing dependencies..." -ForegroundColor Gray
            & npm install 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Error "  npm install failed"
                return $false
            }
        }

        # Build the app
        Write-Host "  Running npm run build..." -ForegroundColor Gray
        $output = & npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "  Build failed:"
            Write-Host $output
            return $false
        }

        # Verify build output exists
        if (-not (Test-Path $Config.BuildPath)) {
            Write-Error "  Build output not found at: $($Config.BuildPath)"
            return $false
        }

        $buildFiles = (Get-ChildItem -Path $Config.BuildPath -Recurse -File).Count
        Write-Success "  Build completed: $buildFiles files"
        return $true
    }
    finally {
        Pop-Location
    }
}

function Get-Backups {
    if (-not (Test-Path $Config.BackupPath)) {
        return @()
    }

    return Get-ChildItem -Path $Config.BackupPath -Directory |
           Sort-Object Name -Descending
}

function Show-Backups {
    $backups = Get-Backups

    if ($backups.Count -eq 0) {
        Write-Warning "No backups found at $($Config.BackupPath)"
        return
    }

    Write-Status "`nAvailable backups:"
    Write-Host "==================`n"

    foreach ($backup in $backups) {
        $size = (Get-ChildItem -Path $backup.FullName -Recurse -File |
                 Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "  $($backup.Name)" -ForegroundColor White -NoNewline
        Write-Host "  ($([math]::Round($size, 2)) MB)" -ForegroundColor Gray
    }

    Write-Host "`nTo rollback: .\deploy.ps1 -Rollback `"<backup-name>`""
}

function New-Backup {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $backupDir = Join-Path $Config.BackupPath $timestamp

    Write-Status "Creating backup: $timestamp"

    if (-not (Test-Path $Config.TargetPath)) {
        Write-Warning "  No existing deployment to backup"
        return $null
    }

    if ($DryRun) {
        Write-Host "  [DRY RUN] Would create backup at: $backupDir"
        return $timestamp
    }

    # Create backup directory
    if (-not (Test-Path $Config.BackupPath)) {
        New-Item -Path $Config.BackupPath -ItemType Directory -Force | Out-Null
    }

    # Copy current production to backup
    $robocopyArgs = @(
        $Config.TargetPath
        $backupDir
        "/E"           # Copy subdirectories including empty ones
        "/R:1"         # Retry once on failure
        "/W:1"         # Wait 1 second between retries
        "/NFL"         # No file list
        "/NDL"         # No directory list
        "/NJH"         # No job header
        "/NJS"         # No job summary
    )

    & robocopy @robocopyArgs | Out-Null

    # Robocopy exit codes 0-7 are success
    if ($LASTEXITCODE -le 7) {
        $size = (Get-ChildItem -Path $backupDir -Recurse -File |
                 Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Success "  Backup created: $([math]::Round($size, 2)) MB"
        return $timestamp
    } else {
        Write-Error "  Backup failed with exit code: $LASTEXITCODE"
        return $null
    }
}

function Remove-OldBackups {
    $backups = Get-Backups

    if ($backups.Count -le $Config.BackupRetention) {
        return
    }

    Write-Status "Cleaning old backups (keeping $($Config.BackupRetention) most recent)..."

    $toDelete = $backups | Select-Object -Skip $Config.BackupRetention

    foreach ($backup in $toDelete) {
        if ($DryRun) {
            Write-Host "  [DRY RUN] Would delete: $($backup.Name)"
        } else {
            Remove-Item -Path $backup.FullName -Recurse -Force
            Write-Host "  Deleted: $($backup.Name)" -ForegroundColor Gray
        }
    }
}

function Invoke-Rollback {
    param([string]$BackupName)

    $backupDir = Join-Path $Config.BackupPath $BackupName

    if (-not (Test-Path $backupDir)) {
        Write-Error "Backup not found: $BackupName"
        Write-Host "Use -ListBackups to see available backups"
        return $false
    }

    Write-Status "Rolling back to: $BackupName"

    if ($DryRun) {
        Write-Host "  [DRY RUN] Would restore from: $backupDir"
        Write-Host "  [DRY RUN] Would restore to: $($Config.TargetPath)"
        return $true
    }

    # Create a backup of current state before rollback
    $preRollbackBackup = New-Backup
    if ($preRollbackBackup) {
        Write-Host "  Pre-rollback backup: $preRollbackBackup" -ForegroundColor Gray
    }

    # Restore from backup
    $robocopyArgs = @(
        $backupDir
        $Config.TargetPath
        "/MIR"         # Mirror (delete files not in source)
        "/R:1"
        "/W:1"
        "/NFL"
        "/NDL"
        "/NJH"
        "/NJS"
    )

    & robocopy @robocopyArgs | Out-Null

    if ($LASTEXITCODE -le 7) {
        Write-Success "Rollback completed successfully!"
        return $true
    } else {
        Write-Error "Rollback failed with exit code: $LASTEXITCODE"
        return $false
    }
}

function Deploy-Files {
    Write-Status "`nDeploying files..."

    $stats = @{
        FilesUpdated = 0
        FilesCopied = 0
        DirsCreated = 0
        Errors = 0
    }

    # Create target directory if needed
    if (-not (Test-Path $Config.TargetPath)) {
        if ($DryRun) {
            Write-Host "  [DRY RUN] Would create: $($Config.TargetPath)"
        } else {
            New-Item -Path $Config.TargetPath -ItemType Directory -Force | Out-Null
            $stats.DirsCreated++
        }
    }

    # Deploy Qvé build (SvelteKit static files)
    Write-Host "`n  Qvé app (SvelteKit build):" -ForegroundColor White
    $qveBuildSource = $Config.BuildPath
    $qveTarget = Join-Path $Config.TargetPath "qve"

    if (Test-Path $qveBuildSource) {
        $robocopyArgs = @(
            $qveBuildSource
            $qveTarget
            "/E"           # Copy subdirectories
            "/PURGE"       # Delete files in target not in source
            "/R:1"
            "/W:1"
            "/XF"          # Exclude files
            "*.log"
            "Thumbs.db"
        )

        if ($DryRun) {
            $robocopyArgs += "/L"  # List only
        }

        & robocopy @robocopyArgs | Out-Null
        $buildFiles = (Get-ChildItem -Path $qveBuildSource -Recurse -File).Count

        if ($DryRun) {
            Write-Host "    [DRY RUN] $buildFiles files to qve/"
        } else {
            Write-Host "    $buildFiles files synced to qve/" -ForegroundColor Gray
            $stats.FilesCopied += $buildFiles
        }
    } else {
        Write-Warning "    Build not found - run without -SkipBuild"
    }

    # Deploy PHP files (excluding config.local.php)
    Write-Host "`n  PHP backend:" -ForegroundColor White
    $phpSource = Join-Path $Config.SourcePath "resources\php"
    $phpTarget = Join-Path $Config.TargetPath "resources\php"

    if (Test-Path $phpSource) {
        # Build exclusion list
        $excludeFiles = $Config.ExcludePhpFiles + @("*.log", "Thumbs.db")

        $robocopyArgs = @(
            $phpSource
            $phpTarget
            "/E"
            "/PURGE"
            "/R:1"
            "/W:1"
        )

        # Add file exclusions
        foreach ($exclude in $excludeFiles) {
            $robocopyArgs += "/XF"
            $robocopyArgs += $exclude
        }

        if ($DryRun) {
            $robocopyArgs += "/L"
        }

        & robocopy @robocopyArgs | Out-Null
        $phpFiles = (Get-ChildItem -Path $phpSource -File |
                     Where-Object { $_.Name -notin $Config.ExcludePhpFiles }).Count

        if ($DryRun) {
            Write-Host "    [DRY RUN] $phpFiles files (excluding config.local.php)"
        } else {
            Write-Host "    $phpFiles files synced (excluding config.local.php)" -ForegroundColor Gray
            $stats.FilesCopied += $phpFiles
        }
    }

    # Deploy SQL schema
    Write-Host "`n  SQL schema:" -ForegroundColor White
    $sqlSource = Join-Path $Config.SourcePath "resources\sql"
    $sqlTarget = Join-Path $Config.TargetPath "resources\sql"

    if (Test-Path $sqlSource) {
        $robocopyArgs = @(
            $sqlSource
            $sqlTarget
            "/E"
            "/PURGE"
            "/R:1"
            "/W:1"
        )

        if ($DryRun) {
            $robocopyArgs += "/L"
        }

        & robocopy @robocopyArgs | Out-Null
        $sqlFiles = (Get-ChildItem -Path $sqlSource -Recurse -File).Count

        if ($DryRun) {
            Write-Host "    [DRY RUN] $sqlFiles files"
        } else {
            Write-Host "    $sqlFiles files synced" -ForegroundColor Gray
            $stats.FilesCopied += $sqlFiles
        }
    }

    # Deploy wine images (MERGE mode - add new, never overwrite)
    Write-Host "`n  Wine images (merge - add new only):" -ForegroundColor White
    $wineImgSource = Join-Path $Config.SourcePath "images\wines"
    $wineImgTarget = Join-Path $Config.TargetPath "images\wines"

    if (Test-Path $wineImgSource) {
        $robocopyArgs = @(
            $wineImgSource
            $wineImgTarget
            "/E"
            "/XC"          # Exclude changed files (don't overwrite)
            "/XN"          # Exclude newer files
            "/XO"          # Exclude older files
            "/R:1"
            "/W:1"
            "/XF"
            "Thumbs.db"
            ".DS_Store"
        )

        if ($DryRun) {
            $robocopyArgs += "/L"
        }

        & robocopy @robocopyArgs | Out-Null

        # Count new files that would be/were added
        $localCount = (Get-ChildItem -Path $wineImgSource -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Host "    images/wines/: $localCount local files (new files added, existing preserved)" -ForegroundColor Gray
    }

    return $stats
}

function Show-Summary {
    param($Stats, $BackupName)

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "        DEPLOYMENT SUMMARY" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    if ($DryRun) {
        Write-Warning "DRY RUN - No changes were made`n"
    }

    Write-Host "  Target:       $($Config.TargetPath)"
    if ($BackupName) {
        Write-Host "  Backup:       $BackupName"
    }
    Write-Host ""

    if (-not $DryRun) {
        Write-Success "Deployment completed successfully!"
        Write-Host "`nVerify at: http://10.0.0.16/qve/"
    } else {
        Write-Host "Run without -DryRun to execute deployment"
    }

    Write-Host ""
}

# Main execution
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     Qvé Wine App Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Handle ListBackups
if ($ListBackups) {
    Show-Backups
    exit 0
}

# Handle Rollback
if ($Rollback) {
    if (-not (Test-Prerequisites)) {
        exit 1
    }

    $success = Invoke-Rollback -BackupName $Rollback
    exit $(if ($success) { 0 } else { 1 })
}

# Normal deployment
if ($DryRun) {
    Write-Warning "DRY RUN MODE - No changes will be made`n"
}

# Pre-flight checks
if (-not (Test-Prerequisites)) {
    exit 1
}

# Build the app (unless skipped)
if (-not $SkipBuild) {
    $buildSuccess = Build-QveApp
    if (-not $buildSuccess -and -not $DryRun) {
        Write-Error "Build failed. Aborting deployment."
        exit 1
    }
} else {
    Write-Warning "Skipping build (using existing build)"
    if (-not (Test-Path $Config.BuildPath)) {
        Write-Error "No existing build found at: $($Config.BuildPath)"
        Write-Host "Run without -SkipBuild to build the app"
        exit 1
    }
}

# Create backup
$backupName = New-Backup
if (-not $backupName -and -not $DryRun -and (Test-Path $Config.TargetPath)) {
    Write-Error "Backup failed. Aborting deployment."
    exit 1
}

# Deploy files
$stats = Deploy-Files

# Clean old backups
Remove-OldBackups

# Show summary
Show-Summary -Stats $stats -BackupName $backupName
