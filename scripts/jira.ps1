<#
.SYNOPSIS
    JIRA CLI for Wine App project using REST API v3

.DESCRIPTION
    Simple JIRA operations: list issues, create, update, transition status.
    Credentials stored in ../wineapp-config/jira.config.json

.EXAMPLE
    .\jira.ps1 list                     # List open issues
    .\jira.ps1 get WIN-123              # Get issue details
    .\jira.ps1 create "Bug title"       # Create new task
    .\jira.ps1 status WIN-123 "Done"    # Transition status
    .\jira.ps1 comment WIN-123 "Note"   # Add comment
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("list", "get", "create", "status", "comment", "sprint", "sprint-create", "sprint-add", "sprint-start", "help")]
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
$authString = "$($config.email):$($config.token)"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes($authString)
$authBase64 = [Convert]::ToBase64String($authBytes)

$headers = @{
    "Authorization" = "Basic $authBase64"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

function Invoke-JiraApi {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body
    )

    $url = "$baseUrl/$Endpoint"
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
        }
        return $null
    }
}

function Show-Help {
    Write-Host "`nJIRA CLI for Wine App" -ForegroundColor Cyan
    Write-Host "=====================`n" -ForegroundColor Cyan
    Write-Host "Usage: .\jira.ps1 <command> [args]`n"
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  list [status]           List issues (default: open). Status: open, done, all"
    Write-Host "  get <key>               Get issue details (e.g., WIN-123)"
    Write-Host "  create <summary> [type] Create issue. Type: Task, Bug, Story (default: Task)"
    Write-Host "  status <key> <status>   Change status: 'To Do', 'In Progress', 'Done'"
    Write-Host "  comment <key> <text>    Add comment to issue"
    Write-Host "  sprint                  Show current sprint issues"
    Write-Host "  sprint-create <name>    Create a new sprint"
    Write-Host "  sprint-add <id> <keys>  Add issues to sprint (comma-separated keys)"
    Write-Host "  sprint-start <id>       Start a sprint (2-week duration)"
    Write-Host "  help                    Show this help`n"
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\jira.ps1 list"
    Write-Host "  .\jira.ps1 get WIN-124"
    Write-Host "  .\jira.ps1 create `"Fix login bug`" Bug"
    Write-Host "  .\jira.ps1 status WIN-124 `"In Progress`""
    Write-Host "  .\jira.ps1 comment WIN-124 `"Started working on this`""
    Write-Host "  .\jira.ps1 sprint-create `"Sprint 11: Stability`""
    Write-Host "  .\jira.ps1 sprint-add 42 WIN-182,WIN-183,WIN-184"
    Write-Host ""
}

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

    $result = Invoke-JiraApi -Endpoint "search/jql?jql=$encoded&maxResults=50&fields=key,summary,status,issuetype,priority"

    if ($result) {
        Write-Host "`n$($project) Issues ($Status):" -ForegroundColor Cyan
        Write-Host ("-" * 80)

        if ($result.issues.Count -eq 0) {
            Write-Host "No issues found." -ForegroundColor Gray
        }

        foreach ($issue in $result.issues) {
            $status = $issue.fields.status.name
            $statusColor = switch ($issue.fields.status.statusCategory.key) {
                "done" { "Green" }
                "indeterminate" { "Yellow" }
                default { "White" }
            }
            $type = $issue.fields.issuetype.name.Substring(0,1)

            Write-Host "$($issue.key)" -ForegroundColor White -NoNewline
            Write-Host " [$type]" -ForegroundColor Gray -NoNewline
            Write-Host " $($issue.fields.summary)" -NoNewline
            Write-Host " - " -NoNewline
            Write-Host "$status" -ForegroundColor $statusColor
        }
        Write-Host ""
    }
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

        Write-Host "`nURL: $($config.host)/browse/$($result.key)" -ForegroundColor Gray
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
        Write-Host "URL: $($config.host)/browse/$($result.key)" -ForegroundColor Gray
        Write-Host ""
    }
}

function Set-IssueStatus {
    param(
        [string]$Key,
        [string]$StatusName
    )

    if (-not $Key -or -not $StatusName) {
        Write-Host "Usage: .\jira.ps1 status <issue-key> <status>" -ForegroundColor Yellow
        Write-Host "Status: 'To Do', 'In Progress', 'Done'" -ForegroundColor Gray
        return
    }

    # Get available transitions
    $transitions = Invoke-JiraApi -Endpoint "issue/$Key/transitions"

    if (-not $transitions) { return }

    $targetTransition = $transitions.transitions | Where-Object { $_.name -eq $StatusName -or $_.to.name -eq $StatusName }

    if (-not $targetTransition) {
        Write-Host "Invalid status '$StatusName'. Available transitions:" -ForegroundColor Yellow
        $transitions.transitions | ForEach-Object { Write-Host "  - $($_.name) -> $($_.to.name)" }
        return
    }

    $body = @{
        transition = @{ id = $targetTransition.id }
    }

    $result = Invoke-JiraApi -Method "POST" -Endpoint "issue/$Key/transitions" -Body $body

    Write-Host "`n$Key transitioned to: $StatusName" -ForegroundColor Green
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

function Get-Sprint {
    # Get issues in current sprint
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
            $status = $issue.fields.status.name
            $statusColor = switch ($issue.fields.status.statusCategory.key) {
                "done" { "Green" }
                "indeterminate" { "Yellow" }
                default { "White" }
            }
            $type = $issue.fields.issuetype.name.Substring(0,1)

            Write-Host "$($issue.key)" -ForegroundColor White -NoNewline
            Write-Host " [$type]" -ForegroundColor Gray -NoNewline
            Write-Host " $($issue.fields.summary)" -NoNewline
            Write-Host " - " -NoNewline
            Write-Host "$status" -ForegroundColor $statusColor
        }
        Write-Host ""
    }
}

function Get-BoardId {
    # Get the board ID for the project (needed for sprint operations)
    $agileUrl = "$($config.baseUrl)/rest/agile/1.0"
    $url = "$agileUrl/board?projectKeyOrId=$project"

    try {
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        if ($response.values.Count -gt 0) {
            return $response.values[0].id
        }
    }
    catch {
        Write-Host "Error getting board: $($_.Exception.Message)" -ForegroundColor Red
    }
    return $null
}

function New-Sprint {
    param([string]$Name)

    if (-not $Name) {
        Write-Host "Usage: .\jira.ps1 sprint-create <sprint-name>" -ForegroundColor Yellow
        Write-Host "Example: .\jira.ps1 sprint-create `"Sprint 11: Stability`"" -ForegroundColor Gray
        return
    }

    $boardId = Get-BoardId
    if (-not $boardId) {
        Write-Host "Could not find board for project $project" -ForegroundColor Red
        return
    }

    $agileUrl = "$($config.baseUrl)/rest/agile/1.0"
    $body = @{
        name = $Name
        originBoardId = $boardId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$agileUrl/sprint" -Method POST -Headers $headers -Body $body
        Write-Host "`nCreated sprint: $($response.name)" -ForegroundColor Green
        Write-Host "Sprint ID: $($response.id)" -ForegroundColor Gray
        Write-Host "State: $($response.state)" -ForegroundColor Gray
        Write-Host "`nTo add issues: .\jira.ps1 sprint-add $($response.id) WIN-123,WIN-124,WIN-125" -ForegroundColor Yellow
        Write-Host ""
        return $response.id
    }
    catch {
        Write-Host "Error creating sprint: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
}

function Add-IssuesToSprint {
    param(
        [string]$SprintId,
        [string]$IssueKeys
    )

    if (-not $SprintId -or -not $IssueKeys) {
        Write-Host "Usage: .\jira.ps1 sprint-add <sprint-id> <issue-keys>" -ForegroundColor Yellow
        Write-Host "Example: .\jira.ps1 sprint-add 42 WIN-182,WIN-183,WIN-184" -ForegroundColor Gray
        return
    }

    $keys = $IssueKeys -split "," | ForEach-Object { $_.Trim() }

    $agileUrl = "$($config.baseUrl)/rest/agile/1.0"
    $body = @{
        issues = $keys
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$agileUrl/sprint/$SprintId/issue" -Method POST -Headers $headers -Body $body
        Write-Host "`nAdded $($keys.Count) issue(s) to sprint $SprintId" -ForegroundColor Green
        foreach ($key in $keys) {
            Write-Host "  - $key" -ForegroundColor Gray
        }
        Write-Host ""
    }
    catch {
        Write-Host "Error adding issues to sprint: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
}

function Start-Sprint {
    param([string]$SprintId)

    if (-not $SprintId) {
        Write-Host "Usage: .\jira.ps1 sprint-start <sprint-id>" -ForegroundColor Yellow
        Write-Host "Example: .\jira.ps1 sprint-start 219" -ForegroundColor Gray
        return
    }

    $agileUrl = "$($config.baseUrl)/rest/agile/1.0"

    # Start date is now, end date is 2 weeks from now
    $startDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")
    $endDate = (Get-Date).AddDays(14).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz")

    $body = @{
        state = "active"
        startDate = $startDate
        endDate = $endDate
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$agileUrl/sprint/$SprintId" -Method POST -Headers $headers -Body $body
        Write-Host "`nStarted sprint: $($response.name)" -ForegroundColor Green
        Write-Host "State: $($response.state)" -ForegroundColor Gray
        Write-Host "End Date: $($response.endDate)" -ForegroundColor Gray
        Write-Host ""
    }
    catch {
        Write-Host "Error starting sprint: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
}

# Main
Add-Type -AssemblyName System.Web

switch ($Command) {
    "list"          { Get-Issues -Status $(if ($Arg1) { $Arg1 } else { "open" }) }
    "get"           { Get-Issue -Key $Arg1 }
    "create"        { New-Issue -Summary $Arg1 -Type $(if ($Arg2) { $Arg2 } else { "Task" }) }
    "status"        { Set-IssueStatus -Key $Arg1 -StatusName $Arg2 }
    "comment"       { Add-Comment -Key $Arg1 -Text $Arg2 }
    "sprint"        { Get-Sprint }
    "sprint-create" { New-Sprint -Name $Arg1 }
    "sprint-add"    { Add-IssuesToSprint -SprintId $Arg1 -IssueKeys $Arg2 }
    "sprint-start"  { Start-Sprint -SprintId $Arg1 }
    "help"          { Show-Help }
    default         { Show-Help }
}
