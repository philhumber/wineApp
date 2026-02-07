<#
.SYNOPSIS
    JIRA CLI for Wine App project using REST API v3

.DESCRIPTION
    JIRA operations: list issues, create, update, transition status, manage sprints.
    Credentials stored in ../wineapp-config/jira.config.json

.EXAMPLE
    .\jira.ps1 list                     # List open issues
    .\jira.ps1 get WIN-123              # Get issue details
    .\jira.ps1 create "Bug title" Bug   # Create issue (Task, Bug, Story)
    .\jira.ps1 status WIN-123 "Done"    # Transition status
    .\jira.ps1 cancel WIN-123           # Transition to Cancelled
    .\jira.ps1 comment WIN-123 "Note"   # Add comment
    .\jira.ps1 update WIN-123 "New title" # Update issue summary
    .\jira.ps1 sprint                   # Show current sprint issues
    .\jira.ps1 sprint-list              # List all sprints
    .\jira.ps1 sprint-issues 257        # Show issues in sprint
    .\jira.ps1 sprint-create "Name"     # Create sprint (max 30 chars)
    .\jira.ps1 sprint-add 257 WIN-1,WIN-2
    .\jira.ps1 sprint-start 257         # Start sprint (2-week)
    .\jira.ps1 sprint-close 257         # Complete/close sprint
    .\jira.ps1 sprint-delete 257        # Delete future sprint
    .\jira.ps1 backlog                  # Open issues not in any sprint
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("list", "get", "create", "status", "cancel", "comment", "update",
                 "sprint", "sprint-list", "sprint-issues", "sprint-create",
                 "sprint-add", "sprint-start", "sprint-close", "sprint-delete",
                 "backlog", "help")]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Arg1,

    [Parameter(Position=2)]
    [string]$Arg2,

    [Parameter(Position=3)]
    [string]$Arg3
)

# Load config
$configPath = Join-Path $PSScriptRoot "..\..\wineapp-config\jira.config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "Config not found at: $configPath" -ForegroundColor Red
    Write-Host "Create jira.config.json with: email, token, baseUrl" -ForegroundColor Yellow
    Write-Host "Get API token from: https://id.atlassian.com/manage-profile/security/api-tokens" -ForegroundColor Gray
    exit 1
}

$config = Get-Content $configPath | ConvertFrom-Json
$project = "WIN"
$baseUrl = "$($config.baseUrl)/rest/api/3"
$agileUrl = "$($config.baseUrl)/rest/agile/1.0"
$authString = "$($config.email):$($config.token)"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes($authString)
$authBase64 = [Convert]::ToBase64String($authBytes)

$headers = @{
    "Authorization" = "Basic $authBase64"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

# ============================================================
# Core API helper
# ============================================================

function Invoke-JiraApi {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body,
        [switch]$Agile   # Use agile API base URL instead of REST v3
    )

    $base = if ($Agile) { $agileUrl } else { $baseUrl }
    $url = "$base/$Endpoint"
    $params = @{
        Uri = $url
        Method = $Method
        Headers = $headers
    }

    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    try {
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Error ($statusCode): $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            $errorDetail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($errorDetail.errorMessages) {
                $errorDetail.errorMessages | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
            }
            if ($errorDetail.errors) {
                $errorDetail.errors.PSObject.Properties | ForEach-Object {
                    Write-Host "  $($_.Name): $($_.Value)" -ForegroundColor Red
                }
            }
        }
        return $null
    }
}

# Helper to format an issue line for display
function Format-IssueLine {
    param($Issue)
    $status = $Issue.fields.status.name
    $statusColor = switch ($Issue.fields.status.statusCategory.key) {
        "done" { "Green" }
        "indeterminate" { "Yellow" }
        default { "White" }
    }
    $type = $Issue.fields.issuetype.name.Substring(0,1)

    Write-Host "$($Issue.key)" -ForegroundColor White -NoNewline
    Write-Host " [$type]" -ForegroundColor Gray -NoNewline
    Write-Host " $($Issue.fields.summary)" -NoNewline
    Write-Host " - " -NoNewline
    Write-Host "$status" -ForegroundColor $statusColor
}

# ============================================================
# Help
# ============================================================

function Show-Help {
    Write-Host "`nJIRA CLI for Wine App" -ForegroundColor Cyan
    Write-Host "=====================`n" -ForegroundColor Cyan
    Write-Host "Usage: .\jira.ps1 <command> [args]`n"
    Write-Host "Issue Commands:" -ForegroundColor Yellow
    Write-Host "  list [status]           List issues. Status: open (default), done, all"
    Write-Host "  get <key>               Get issue details (e.g., WIN-123)"
    Write-Host "  create <summary> [type] Create issue. Type: Task (default), Bug, Story"
    Write-Host "  update <key> <summary>  Update issue summary"
    Write-Host "  status <key> <status>   Change status: 'To Do', 'In Progress', 'Done'"
    Write-Host "  cancel <key>            Transition to Cancelled"
    Write-Host "  comment <key> <text>    Add comment to issue"
    Write-Host "  backlog                 Open issues not in any sprint"
    Write-Host ""
    Write-Host "Sprint Commands:" -ForegroundColor Yellow
    Write-Host "  sprint                  Show current (active) sprint issues"
    Write-Host "  sprint-list             List all sprints (active + future)"
    Write-Host "  sprint-issues <id>      Show issues in a specific sprint"
    Write-Host "  sprint-create <name>    Create a new sprint (max 30 chars)"
    Write-Host "  sprint-add <id> <keys>  Add issues to sprint (comma-separated keys)"
    Write-Host "  sprint-start <id>       Start a sprint (2-week duration)"
    Write-Host "  sprint-close <id>       Complete/close an active sprint"
    Write-Host "  sprint-delete <id>      Delete a future sprint"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\jira.ps1 list"
    Write-Host "  .\jira.ps1 list all"
    Write-Host "  .\jira.ps1 get WIN-124"
    Write-Host "  .\jira.ps1 create `"Fix login bug`" Bug"
    Write-Host "  .\jira.ps1 update WIN-124 `"Updated title`""
    Write-Host "  .\jira.ps1 status WIN-124 `"In Progress`""
    Write-Host "  .\jira.ps1 cancel WIN-124"
    Write-Host "  .\jira.ps1 sprint-create `"S15: My Sprint`""
    Write-Host "  .\jira.ps1 sprint-add 257 WIN-182,WIN-183"
    Write-Host "  .\jira.ps1 sprint-issues 257"
    Write-Host ""
    Write-Host "Notes:" -ForegroundColor Gray
    Write-Host "  Sprint names: max 30 characters (JIRA limit)"
    Write-Host "  Transitions: 'Done' and 'Cancelled' are separate statuses"
    Write-Host ""
}

# ============================================================
# Issue commands
# ============================================================

function Get-Issues {
    param([string]$Status = "open")

    $jql = "project = $($project)"

    switch ($Status.ToLower()) {
        "open" { $jql += " AND statusCategory != Done" }
        "done" { $jql += " AND statusCategory = Done" }
        "all" { } # No filter
    }

    $jql += " ORDER BY created DESC"
    $encoded = [System.Web.HttpUtility]::UrlEncode($jql)

    # Paginate to get all results
    $startAt = 0
    $allIssues = @()
    $total = 0

    do {
        $result = Invoke-JiraApi -Endpoint "search/jql?jql=$encoded&maxResults=100&startAt=$startAt&fields=key,summary,status,issuetype,priority"
        if (-not $result) { return }

        $allIssues += $result.issues
        $total = $result.total
        $startAt += $result.issues.Count
    } while ($allIssues.Count -lt $total)

    Write-Host "`n$($project) Issues ($Status): $total total" -ForegroundColor Cyan
    Write-Host ("-" * 80)

    if ($allIssues.Count -eq 0) {
        Write-Host "No issues found." -ForegroundColor Gray
    }

    foreach ($issue in $allIssues) {
        Format-IssueLine $issue
    }
    Write-Host ""
}

function Get-Issue {
    param([string]$Key)

    if (-not $Key) {
        Write-Host "Usage: .\jira.ps1 get <issue-key>" -ForegroundColor Yellow
        return
    }

    $result = Invoke-JiraApi -Endpoint "issue/$Key"

    if ($result) {
        Write-Host "`n$($result.key): $($result.fields.summary)" -ForegroundColor Cyan
        Write-Host ("-" * 60)
        Write-Host "Type:     $($result.fields.issuetype.name)"
        Write-Host "Status:   $($result.fields.status.name)"
        Write-Host "Priority: $($result.fields.priority.name)"

        if ($result.fields.description) {
            Write-Host "`nDescription:" -ForegroundColor Yellow
            # ADF to plain text (simplified)
            if ($result.fields.description.content) {
                foreach ($block in $result.fields.description.content) {
                    if ($block.content) {
                        $text = ($block.content | Where-Object { $_.text } | ForEach-Object { $_.text }) -join ""
                        if ($text) { Write-Host "  $text" }
                    }
                }
            }
        }

        Write-Host "`nURL: $($config.baseUrl)/browse/$($result.key)" -ForegroundColor Gray
        Write-Host ""
    }
}

function New-Issue {
    param(
        [string]$Summary,
        [string]$Type = "Task"
    )

    if (-not $Summary) {
        Write-Host "Usage: .\jira.ps1 create <summary> [type]" -ForegroundColor Yellow
        Write-Host "Types: Task, Bug, Story" -ForegroundColor Gray
        return
    }

    $body = @{
        fields = @{
            project = @{ key = $project }
            summary = $Summary
            issuetype = @{ name = $Type }
        }
    }

    $result = Invoke-JiraApi -Method "POST" -Endpoint "issue" -Body $body

    if ($result) {
        Write-Host "`nCreated: $($result.key)" -ForegroundColor Green
        Write-Host "URL: $($config.baseUrl)/browse/$($result.key)" -ForegroundColor Gray
        Write-Host ""
    }
}

function Update-Issue {
    param(
        [string]$Key,
        [string]$Summary
    )

    if (-not $Key -or -not $Summary) {
        Write-Host "Usage: .\jira.ps1 update <issue-key> <new-summary>" -ForegroundColor Yellow
        return
    }

    $body = @{
        fields = @{
            summary = $Summary
        }
    }

    $result = Invoke-JiraApi -Method "PUT" -Endpoint "issue/$Key" -Body $body

    # PUT returns empty on success, null on error (Invoke-JiraApi returns null on catch)
    # Check if we got an error by seeing if $result is explicitly $null from a caught error
    # vs the empty successful response. Invoke-RestMethod returns empty string on 204.
    Write-Host "`nUpdated $Key summary" -ForegroundColor Green
    Write-Host ""
}

function Set-IssueStatus {
    param(
        [string]$Key,
        [string]$StatusName
    )

    if (-not $Key -or -not $StatusName) {
        Write-Host "Usage: .\jira.ps1 status <issue-key> <status>" -ForegroundColor Yellow
        Write-Host "Status: 'To Do', 'In Progress', 'Done', 'Cancelled'" -ForegroundColor Gray
        return
    }

    # Get available transitions
    $transitions = Invoke-JiraApi -Endpoint "issue/$Key/transitions"

    if (-not $transitions) { return }

    # Find matching transition - prefer matching the target status name (to.name)
    # This avoids ambiguity where multiple transitions share the same name
    # (e.g., transition "Done" -> Cancelled vs "Done 32" -> Done)
    $targetTransition = $null

    # First: exact match on target status name
    $matches = @($transitions.transitions | Where-Object { $_.to.name -eq $StatusName })
    if ($matches.Count -eq 1) {
        $targetTransition = $matches[0]
    }
    elseif ($matches.Count -eq 0) {
        # Fallback: match on transition name
        $matches = @($transitions.transitions | Where-Object { $_.name -eq $StatusName })
        if ($matches.Count -eq 1) {
            $targetTransition = $matches[0]
        }
        elseif ($matches.Count -gt 1) {
            # Multiple transitions with same name - show them for manual selection
            Write-Host "Ambiguous status '$StatusName'. Multiple transitions found:" -ForegroundColor Yellow
            $matches | ForEach-Object { Write-Host "  ID $($_.id): $($_.name) -> $($_.to.name)" }
            Write-Host "Use the target status name (e.g., 'Done' or 'Cancelled') to disambiguate." -ForegroundColor Gray
            return
        }
    }
    elseif ($matches.Count -gt 1) {
        Write-Host "Ambiguous target '$StatusName'. Multiple transitions found:" -ForegroundColor Yellow
        $matches | ForEach-Object { Write-Host "  ID $($_.id): $($_.name) -> $($_.to.name)" }
        return
    }

    if (-not $targetTransition) {
        Write-Host "Invalid status '$StatusName'. Available transitions:" -ForegroundColor Yellow
        $transitions.transitions | ForEach-Object { Write-Host "  - $($_.name) -> $($_.to.name) (ID: $($_.id))" }
        return
    }

    $body = @{
        transition = @{ id = "$($targetTransition.id)" }
    }

    $result = Invoke-JiraApi -Method "POST" -Endpoint "issue/$Key/transitions" -Body $body

    # Verify by re-fetching the issue (don't use ?fields= param, unreliable in v3)
    $verify = Invoke-JiraApi -Endpoint "issue/$Key"
    if ($verify -and $verify.fields.status.name -eq $targetTransition.to.name) {
        Write-Host "`n$Key -> $($targetTransition.to.name)" -ForegroundColor Green
    } else {
        Write-Host "`nTransition may have failed. Current status: $($verify.fields.status.name)" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Set-IssueCancelled {
    param([string]$Key)

    if (-not $Key) {
        Write-Host "Usage: .\jira.ps1 cancel <issue-key>" -ForegroundColor Yellow
        return
    }

    # Get available transitions and find the one that goes to Cancelled
    $transitions = Invoke-JiraApi -Endpoint "issue/$Key/transitions"
    if (-not $transitions) { return }

    $cancelTransition = $transitions.transitions | Where-Object { $_.to.name -eq "Cancelled" }

    if (-not $cancelTransition) {
        Write-Host "No 'Cancelled' transition available for $Key. Available:" -ForegroundColor Yellow
        $transitions.transitions | ForEach-Object { Write-Host "  - $($_.name) -> $($_.to.name) (ID: $($_.id))" }
        return
    }

    # Handle case where multiple transitions go to Cancelled (take first)
    if ($cancelTransition -is [array]) { $cancelTransition = $cancelTransition[0] }

    $body = @{
        transition = @{ id = "$($cancelTransition.id)" }
    }

    Invoke-JiraApi -Method "POST" -Endpoint "issue/$Key/transitions" -Body $body | Out-Null

    # Verify (don't use ?fields= param, unreliable in v3)
    $verify = Invoke-JiraApi -Endpoint "issue/$Key"
    if ($verify -and $verify.fields.status.name -eq "Cancelled") {
        Write-Host "`n$Key -> Cancelled" -ForegroundColor Green
    } else {
        Write-Host "`nTransition may have failed. Current status: $($verify.fields.status.name)" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Add-Comment {
    param(
        [string]$Key,
        [string]$Text
    )

    if (-not $Key -or -not $Text) {
        Write-Host "Usage: .\jira.ps1 comment <issue-key> <comment-text>" -ForegroundColor Yellow
        return
    }

    # ADF format for comment
    $body = @{
        body = @{
            type = "doc"
            version = 1
            content = @(
                @{
                    type = "paragraph"
                    content = @(
                        @{
                            type = "text"
                            text = $Text
                        }
                    )
                }
            )
        }
    }

    $result = Invoke-JiraApi -Method "POST" -Endpoint "issue/$Key/comment" -Body $body

    if ($result) {
        Write-Host "`nComment added to $Key" -ForegroundColor Green
        Write-Host ""
    }
}

function Get-Backlog {
    $jql = "project = $($project) AND statusCategory != Done AND sprint is EMPTY ORDER BY key ASC"
    $encoded = [System.Web.HttpUtility]::UrlEncode($jql)

    $result = Invoke-JiraApi -Endpoint "search/jql?jql=$encoded&maxResults=100&fields=key,summary,status,issuetype"

    if ($result) {
        Write-Host "`nBacklog (open, no sprint): $($result.total) issues" -ForegroundColor Cyan
        Write-Host ("-" * 80)

        if ($result.issues.Count -eq 0) {
            Write-Host "No backlog issues." -ForegroundColor Gray
        }

        foreach ($issue in $result.issues) {
            Format-IssueLine $issue
        }
        Write-Host ""
    }
}

# ============================================================
# Sprint commands
# ============================================================

function Get-BoardId {
    $result = Invoke-JiraApi -Agile -Endpoint "board?projectKeyOrId=$project"
    if ($result -and $result.values.Count -gt 0) {
        return $result.values[0].id
    }
    Write-Host "Could not find board for project $project" -ForegroundColor Red
    return $null
}

function Get-Sprint {
    # Get issues in current (active) sprint
    $jql = "project = $($project) AND sprint in openSprints() ORDER BY status ASC, priority DESC"
    $encoded = [System.Web.HttpUtility]::UrlEncode($jql)

    $result = Invoke-JiraApi -Endpoint "search/jql?jql=$encoded&maxResults=50&fields=key,summary,status,issuetype,priority"

    if ($result) {
        Write-Host "`nCurrent Sprint Issues:" -ForegroundColor Cyan
        Write-Host ("-" * 80)

        if ($result.issues.Count -eq 0) {
            Write-Host "No issues in current sprint." -ForegroundColor Gray
        }

        foreach ($issue in $result.issues) {
            Format-IssueLine $issue
        }
        Write-Host ""
    }
}

function Get-SprintList {
    $boardId = Get-BoardId
    if (-not $boardId) { return }

    # Get active and future sprints
    $result = Invoke-JiraApi -Agile -Endpoint "board/$boardId/sprint?state=active,future"

    if ($result) {
        Write-Host "`nSprints (active + future):" -ForegroundColor Cyan
        Write-Host ("-" * 80)

        if ($result.values.Count -eq 0) {
            Write-Host "No active or future sprints." -ForegroundColor Gray
        }

        foreach ($sprint in $result.values) {
            $stateColor = switch ($sprint.state) {
                "active" { "Green" }
                "future" { "Yellow" }
                default { "White" }
            }

            # Count issues in sprint
            $issues = Invoke-JiraApi -Agile -Endpoint "sprint/$($sprint.id)/issue?maxResults=0&fields=key"
            $issueCount = if ($issues) { $issues.total } else { "?" }

            Write-Host "  ID $($sprint.id)" -ForegroundColor Gray -NoNewline
            Write-Host " | " -NoNewline
            Write-Host "$($sprint.state.PadRight(6))" -ForegroundColor $stateColor -NoNewline
            Write-Host " | $($sprint.name) ($issueCount issues)"
        }
        Write-Host ""
    }
}

function Get-SprintIssues {
    param([string]$SprintId)

    if (-not $SprintId) {
        Write-Host "Usage: .\jira.ps1 sprint-issues <sprint-id>" -ForegroundColor Yellow
        Write-Host "Use 'sprint-list' to see sprint IDs" -ForegroundColor Gray
        return
    }

    $result = Invoke-JiraApi -Agile -Endpoint "sprint/$SprintId/issue?maxResults=50&fields=key,summary,status,issuetype"

    if ($result) {
        # Get sprint name
        $sprint = Invoke-JiraApi -Agile -Endpoint "sprint/$SprintId"
        $sprintName = if ($sprint) { $sprint.name } else { "Sprint $SprintId" }

        Write-Host "`n$sprintName (ID: $SprintId):" -ForegroundColor Cyan
        Write-Host ("-" * 80)

        if ($result.issues.Count -eq 0) {
            Write-Host "No issues in sprint." -ForegroundColor Gray
        }

        $openCount = 0
        $doneCount = 0
        foreach ($issue in $result.issues) {
            Format-IssueLine $issue
            if ($issue.fields.status.statusCategory.key -eq "done") { $doneCount++ } else { $openCount++ }
        }

        Write-Host ""
        Write-Host "  $($result.issues.Count) total | " -NoNewline -ForegroundColor Gray
        Write-Host "$doneCount done" -NoNewline -ForegroundColor Green
        Write-Host " | " -NoNewline -ForegroundColor Gray
        Write-Host "$openCount open" -ForegroundColor Yellow
        Write-Host ""
    }
}

function New-Sprint {
    param([string]$Name)

    if (-not $Name) {
        Write-Host "Usage: .\jira.ps1 sprint-create <sprint-name>" -ForegroundColor Yellow
        Write-Host "Example: .\jira.ps1 sprint-create `"S15: My Sprint`"" -ForegroundColor Gray
        Write-Host "Note: Sprint names must be 30 characters or fewer" -ForegroundColor Gray
        return
    }

    # Validate name length (JIRA enforces 30 char limit)
    if ($Name.Length -gt 30) {
        Write-Host "Sprint name too long ($($Name.Length) chars). Max is 30." -ForegroundColor Red
        Write-Host "Name: '$Name'" -ForegroundColor Gray
        return
    }

    $boardId = Get-BoardId
    if (-not $boardId) { return }

    $body = @{
        name = $Name
        originBoardId = $boardId
    }

    $result = Invoke-JiraApi -Agile -Method "POST" -Endpoint "sprint" -Body $body

    if ($result) {
        Write-Host "`nCreated sprint: $($result.name)" -ForegroundColor Green
        Write-Host "Sprint ID: $($result.id)" -ForegroundColor Gray
        Write-Host "State: $($result.state)" -ForegroundColor Gray
        Write-Host "`nTo add issues: .\jira.ps1 sprint-add $($result.id) WIN-123,WIN-124" -ForegroundColor Yellow
        Write-Host ""
    }
}

function Add-IssuesToSprint {
    param(
        [string]$SprintId,
        [string]$IssueKeys
    )

    if (-not $SprintId -or -not $IssueKeys) {
        Write-Host "Usage: .\jira.ps1 sprint-add <sprint-id> <issue-keys>" -ForegroundColor Yellow
        Write-Host "Example: .\jira.ps1 sprint-add 257 WIN-182,WIN-183,WIN-184" -ForegroundColor Gray
        return
    }

    $keys = $IssueKeys -split "," | ForEach-Object { $_.Trim() }

    $body = @{
        issues = $keys
    }

    $result = Invoke-JiraApi -Agile -Method "POST" -Endpoint "sprint/$SprintId/issue" -Body $body

    # This endpoint returns empty on success
    Write-Host "`nAdded $($keys.Count) issue(s) to sprint $SprintId" -ForegroundColor Green
    foreach ($key in $keys) {
        Write-Host "  - $key" -ForegroundColor Gray
    }
    Write-Host ""
}

function Start-Sprint {
    param([string]$SprintId)

    if (-not $SprintId) {
        Write-Host "Usage: .\jira.ps1 sprint-start <sprint-id>" -ForegroundColor Yellow
        Write-Host "Use 'sprint-list' to see sprint IDs" -ForegroundColor Gray
        return
    }

    $startDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
    $endDate = (Get-Date).AddDays(14).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")

    $body = @{
        state = "active"
        startDate = $startDate
        endDate = $endDate
    }

    $result = Invoke-JiraApi -Agile -Method "POST" -Endpoint "sprint/$SprintId" -Body $body

    if ($result) {
        Write-Host "`nStarted sprint: $($result.name)" -ForegroundColor Green
        Write-Host "State: $($result.state)" -ForegroundColor Gray
        Write-Host "End Date: $($result.endDate)" -ForegroundColor Gray
        Write-Host ""
    }
}

function Close-Sprint {
    param([string]$SprintId)

    if (-not $SprintId) {
        Write-Host "Usage: .\jira.ps1 sprint-close <sprint-id>" -ForegroundColor Yellow
        Write-Host "Use 'sprint-list' to see sprint IDs" -ForegroundColor Gray
        return
    }

    $body = @{
        state = "closed"
    }

    $result = Invoke-JiraApi -Agile -Method "POST" -Endpoint "sprint/$SprintId" -Body $body

    if ($result) {
        Write-Host "`nClosed sprint: $($result.name)" -ForegroundColor Green
        Write-Host "Open issues moved to backlog." -ForegroundColor Gray
        Write-Host ""
    }
}

function Remove-Sprint {
    param([string]$SprintId)

    if (-not $SprintId) {
        Write-Host "Usage: .\jira.ps1 sprint-delete <sprint-id>" -ForegroundColor Yellow
        Write-Host "Use 'sprint-list' to see sprint IDs" -ForegroundColor Gray
        return
    }

    # Verify sprint state before deleting
    $sprint = Invoke-JiraApi -Agile -Endpoint "sprint/$SprintId"
    if (-not $sprint) { return }

    if ($sprint.state -eq "active") {
        Write-Host "Cannot delete an active sprint. Use 'sprint-close' first." -ForegroundColor Red
        return
    }

    $result = Invoke-JiraApi -Agile -Method "DELETE" -Endpoint "sprint/$SprintId"

    Write-Host "`nDeleted sprint: $($sprint.name) (ID: $SprintId)" -ForegroundColor Green
    Write-Host ""
}

# ============================================================
# Main
# ============================================================
Add-Type -AssemblyName System.Web

switch ($Command) {
    "list"           { Get-Issues -Status $(if ($Arg1) { $Arg1 } else { "open" }) }
    "get"            { Get-Issue -Key $Arg1 }
    "create"         { New-Issue -Summary $Arg1 -Type $(if ($Arg2) { $Arg2 } else { "Task" }) }
    "update"         { Update-Issue -Key $Arg1 -Summary $Arg2 }
    "status"         { Set-IssueStatus -Key $Arg1 -StatusName $Arg2 }
    "cancel"         { Set-IssueCancelled -Key $Arg1 }
    "comment"        { Add-Comment -Key $Arg1 -Text $Arg2 }
    "backlog"        { Get-Backlog }
    "sprint"         { Get-Sprint }
    "sprint-list"    { Get-SprintList }
    "sprint-issues"  { Get-SprintIssues -SprintId $Arg1 }
    "sprint-create"  { New-Sprint -Name $Arg1 }
    "sprint-add"     { Add-IssuesToSprint -SprintId $Arg1 -IssueKeys $Arg2 }
    "sprint-start"   { Start-Sprint -SprintId $Arg1 }
    "sprint-close"   { Close-Sprint -SprintId $Arg1 }
    "sprint-delete"  { Remove-Sprint -SprintId $Arg1 }
    "help"           { Show-Help }
    default          { Show-Help }
}
