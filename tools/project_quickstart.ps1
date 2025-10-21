# PowerShell quickstart script for repo warm-up
# Usage: pwsh -NoLogo -File tools/project_quickstart.ps1

Write-Host "=== Repo Quick Start ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  AI Agent 使用者請注意：" -ForegroundColor Red
Write-Host "   所有任務必須從 00_START_HERE.md 開始" -ForegroundColor Red
Write-Host "   未貼 START_CONTRACT 者一律 No-Go" -ForegroundColor Red
Write-Host "   → 請先閱讀根目錄的 00_START_HERE.md" -ForegroundColor Yellow
Write-Host ""

if (Test-Path "docs/todo/RECENT_WORK.md") {
    Write-Host "`n> Latest snapshot (docs/todo/RECENT_WORK.md):" -ForegroundColor Green
    Get-Content "docs/todo/RECENT_WORK.md" -TotalCount 40 | ForEach-Object { "  $_" }
} else {
    Write-Host "`n> Snapshot file not found. Create docs/todo/RECENT_WORK.md to track progress." -ForegroundColor Yellow
}

Write-Host "`n> Git status (short):" -ForegroundColor Green
git status -sb

Write-Host "`n> Recent commits:" -ForegroundColor Green
git log -5 --oneline

Write-Host "`n> Module map available at docs/modules_map.md" -ForegroundColor Cyan
Write-Host "  (open for page/module relationships)"

Write-Host ([Environment]::NewLine + 'Done.') -ForegroundColor Cyan
