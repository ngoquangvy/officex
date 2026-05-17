param(
    [string]$Action = "setup"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptPath "src\index.js"

function Show-InstallerGUI {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "OfficeX Installer"
    $form.Size = New-Object System.Drawing.Size(500, 350)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $scriptPath "OfficeX.exe"))

    $isUninstall = $Action -eq "uninstall"

    $title = New-Object System.Windows.Forms.Label
    $title.Text = "OfficeX - " + $(if ($isUninstall) { "Gỡ cài đặt" } else { "Cài đặt" })
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $title.Size = New-Object System.Drawing.Size(460, 40)
    $title.Location = New-Object System.Drawing.Point(20, 20)
    $title.TextAlign = "MiddleLeft"
    $form.Controls.Add($title)

    $desc = New-Object System.Windows.Forms.Label
    $desc.Text = if ($isUninstall) {
        "Ứng dụng mở file Office bằng Google Docs/Sheets"
    } else {
        "Công cụ mở file Office (.docx, .xlsx, .pptx) bằng Google Docs/Sheets qua Chrome."
    }
    $desc.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $desc.Size = New-Object System.Drawing.Size(460, 40)
    $desc.Location = New-Object System.Drawing.Point(20, 65)
    $form.Controls.Add($desc)

    $progressBar = New-Object System.Windows.Forms.ProgressBar
    $progressBar.Size = New-Object System.Drawing.Size(460, 25)
    $progressBar.Location = New-Object System.Drawing.Point(20, 120)
    $progressBar.Style = "Marquee"
    $progressBar.Visible = $false
    $form.Controls.Add($progressBar)

    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Text = ""
    $statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $statusLabel.Size = New-Object System.Drawing.Size(460, 40)
    $statusLabel.Location = New-Object System.Drawing.Point(20, 155)
    $form.Controls.Add($statusLabel)

    $outputBox = New-Object System.Windows.Forms.TextBox
    $outputBox.Multiline = $true
    $outputBox.ReadOnly = $true
    $outputBox.ScrollBars = "Vertical"
    $outputBox.Size = New-Object System.Drawing.Size(460, 80)
    $outputBox.Location = New-Object System.Drawing.Point(20, 200)
    $outputBox.Font = New-Object System.Drawing.Font("Consolas", 8)
    $outputBox.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
    $outputBox.ForeColor = [System.Drawing.Color]::LimeGreen
    $outputBox.Visible = $false
    $form.Controls.Add($outputBox)

    $btnAction = New-Object System.Windows.Forms.Button
    $btnAction.Text = if ($isUninstall) { "Gỡ cài đặt" } else { "Cài đặt" }
    $btnAction.Size = New-Object System.Drawing.Size(120, 35)
    $btnAction.Location = New-Object System.Drawing.Point(240, 290)
    $btnAction.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $form.Controls.Add($btnAction)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "Đóng"
    $btnClose.Size = New-Object System.Drawing.Size(100, 35)
    $btnClose.Location = New-Object System.Drawing.Point(370, 290)
    $btnClose.Enabled = $false
    $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $form.Controls.Add($btnClose)

    function Run-NodeScript {
        $btnAction.Enabled = $false
        $progressBar.Visible = $true
        $outputBox.Visible = $true
        $statusLabel.Text = if ($isUninstall) { "Đang gỡ cài đặt..." } else { "Đang cài đặt..." }

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "node"
        $psi.Arguments = "`"$nodeScript`" " + $(if ($isUninstall) { "--uninstall" } else { "--setup" })
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true

        $proc = [System.Diagnostics.Process]::Start($psi)
        $output = $proc.StandardOutput.ReadToEnd()
        $errorOut = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()

        $outputBox.Text = $output + "`n" + $errorOut

        $success = $proc.ExitCode -eq 0
        if ($success) {
            $statusLabel.Text = if ($isUninstall) { "✅ Gỡ cài đặt hoàn tất!" } else { "✅ Cài đặt hoàn tất!" }
            $statusLabel.ForeColor = [System.Drawing.Color]::Green
        } else {
            $statusLabel.Text = "❌ Có lỗi xảy ra (mã: $($proc.ExitCode)). Xem chi tiết bên dưới."
            $statusLabel.ForeColor = [System.Drawing.Color]::Red
        }

        $progressBar.Visible = $false
        $progressBar.Style = "Blocks"
        $progressBar.Value = if ($success) { 100 } else { 0 }
        $progressBar.Visible = $true
        $btnClose.Enabled = $true
    }

    $btnAction.Add_Click({
        if ($isUninstall) {
            $confirm = [System.Windows.Forms.MessageBox]::Show(
                "Bạn có chắc muốn gỡ OfficeX?`n`nFile associations và extensions sẽ bị xóa.",
                "Xác nhận gỡ cài đặt",
                [System.Windows.Forms.MessageBoxButtons]::YesNo,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
            if ($confirm -eq "Yes") { Run-NodeScript }
        } else {
            Run-NodeScript
        }
    })

    $btnClose.Add_Click({ $form.Close() })
    $form.ShowDialog() | Out-Null
}

Show-InstallerGUI
