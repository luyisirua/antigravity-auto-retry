# Antigravity 2.0 Auto-Retry (Windows UI Automation + System Tray)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Win32Helper {
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr handle);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam,
        uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@

# Configuration
$TargetLabels = @("retry", "try again", "resume", "try again…", "retry…", "重试", "再试一次")
$ScanIntervalMs = 3000
$CooldownMs = 5000
$LogFile = "C:\Users\KT\Documents\antigravity-auto-retry\retry.log"

$script:enabled = $true
$script:retryCount = 0
$script:lastClickTime = [DateTime]::MinValue
$script:lastBtnCount = -1

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] $Message" -Encoding UTF8
}

function Wake-ChromiumAccessibility {
    param([System.Windows.Automation.AutomationElement]$WinElem)
    try {
        # Send WM_GETOBJECT (0x003D) with OBJID_CLIENT (-4) to wake lazy Chromium a11y
        $hwnd = [IntPtr]$WinElem.Current.NativeWindowHandle
        if ($hwnd -ne [IntPtr]::Zero) {
            [IntPtr]$res = [IntPtr]::Zero
            [Win32Helper]::SendMessageTimeout($hwnd, 0x003D, [IntPtr]::Zero, [IntPtr](-4), 2, 200, [ref]$res) | Out-Null
        }
        $children = $WinElem.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($c in $children) {
            if ($c.Current.ClassName -eq "Chrome_RenderWidgetHostHWND") {
                $ch = [IntPtr]$c.Current.NativeWindowHandle
                if ($ch -ne [IntPtr]::Zero) {
                    [IntPtr]$res2 = [IntPtr]::Zero
                    [Win32Helper]::SendMessageTimeout($ch, 0x003D, [IntPtr]::Zero, [IntPtr](-4), 2, 200, [ref]$res2) | Out-Null
                }
            }
        }
    } catch {}
}

function New-CircleIcon {
    param([System.Drawing.Color]$Color)
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $brush = New-Object System.Drawing.SolidBrush($Color)
    $g.FillEllipse($brush, 1, 1, 14, 14)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 1.5)
    $g.DrawArc($pen, 4, 4, 8, 8, 30, 290)

    $brush.Dispose()
    $pen.Dispose()
    $g.Dispose()

    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $cloned = $icon.Clone()
    $icon.Dispose()
    [Win32Helper]::DestroyIcon($hIcon) | Out-Null
    $bmp.Dispose()
    return $cloned
}

$iconOn = New-CircleIcon -Color ([System.Drawing.Color]::FromArgb(22, 163, 74))
$iconOff = New-CircleIcon -Color ([System.Drawing.Color]::FromArgb(107, 114, 128))

# Tray Setup
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$menuStatus = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStatus.Enabled = $false

$menuToggle = New-Object System.Windows.Forms.ToolStripMenuItem
$menuDiag = New-Object System.Windows.Forms.ToolStripMenuItem("诊断控件识别 (测试)")
$menuLog = New-Object System.Windows.Forms.ToolStripMenuItem("打开运行日志")
$menuExit = New-Object System.Windows.Forms.ToolStripMenuItem("退出")

$contextMenu.Items.Add($menuStatus) | Out-Null
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$contextMenu.Items.Add($menuToggle) | Out-Null
$contextMenu.Items.Add($menuDiag) | Out-Null
$contextMenu.Items.Add($menuLog) | Out-Null
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$contextMenu.Items.Add($menuExit) | Out-Null

$notifyIcon.ContextMenuStrip = $contextMenu

function Update-TrayUI {
    if ($script:enabled) {
        $notifyIcon.Icon = $iconOn
        $notifyIcon.Text = "Antigravity Auto-Retry: ON (已重试 $($script:retryCount) 次)"
        $menuStatus.Text = "状态: 运行中 (已重试 $($script:retryCount) 次)"
        $menuToggle.Text = "暂停 Auto-Retry"
    } else {
        $notifyIcon.Icon = $iconOff
        $notifyIcon.Text = "Antigravity Auto-Retry: OFF"
        $menuStatus.Text = "状态: 已暂停"
        $menuToggle.Text = "开启 Auto-Retry"
    }
}

$toggleAction = {
    $script:enabled = -not $script:enabled
    Update-TrayUI
    Write-Log "Auto-Retry toggled: $($script:enabled)"
}

$menuToggle.Add_Click($toggleAction)
$notifyIcon.Add_MouseClick({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        & $toggleAction
    }
})

$menuLog.Add_Click({
    if (Test-Path $LogFile) {
        Start-Process notepad.exe $LogFile
    } else {
        [System.Windows.Forms.MessageBox]::Show("暂无日志记录。", "运行日志")
    }
})

function Get-AntigravityWindows {
    $agPids = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    if ($agPids.Count -eq 0) { return @() }

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    $result = @()
    foreach ($w in $wins) {
        if ($w.Current.ProcessId -in $agPids -and $w.Current.Name) {
            $result += $w
        }
    }
    return $result
}

# Diagnostic test
$menuDiag.Add_Click({
    try {
        $wins = @(Get-AntigravityWindows)
        if ($wins.Count -eq 0) {
            [System.Windows.Forms.MessageBox]::Show("未检测到 Antigravity 窗口（请确认客户端已打开且未最小化）。", "UIA 诊断")
            return
        }

        $targetWin = $wins[0]
        Wake-ChromiumAccessibility -WinElem $targetWin
        Start-Sleep -Milliseconds 300

        $allElems = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        $btnCond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button
        )
        $btns = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
        $names = @()
        foreach ($b in $btns) {
            $n = $b.Current.Name
            if ($n -and $n.Trim().Length -gt 0) {
                $names += $n.Trim()
            }
        }
        $sample = ($names | Select-Object -Unique -First 15) -join ", "
        $msg = "窗口: $($targetWin.Current.Name)`n总控件节点数: $($allElems.Count)`n检测到按钮总数: $($btns.Count)`n部分按钮名称: $sample"
        Write-Log "Diag: totalNodes=$($allElems.Count), buttons=$($btns.Count), sample=$sample"

        if ($btns.Count -le 5) {
            $msg += "`n`n⚠️ 依然未能读取到网页内部按钮（总节点数 $($allElems.Count)）。`n说明 Antigravity 2.33.0 底层未暴露网页无障碍树，建议改用【方案二：屏幕图像识别点击】。"
        } else {
            $msg += "`n`n✅ UIA 控件树读取正常，Auto-Retry 可以正常识别按钮！"
        }
        [System.Windows.Forms.MessageBox]::Show($msg, "UIA 诊断结果")
    } catch {
        [System.Windows.Forms.MessageBox]::Show("诊断出错: $($_.Exception.Message)", "UIA 诊断")
    }
})

$menuExit.Add_Click({
    $timer.Stop()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    Write-Log "Auto-Retry exited."
    [System.Windows.Forms.Application]::Exit()
})

# Scanner Timer
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $ScanIntervalMs
$timer.Add_Tick({
    if (-not $script:enabled) { return }
    $now = Get-Date
    if (($now - $script:lastClickTime).TotalMilliseconds -lt $CooldownMs) { return }

    try {
        $wins = @(Get-AntigravityWindows)
        if ($wins.Count -eq 0) { return }

        $btnCond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Button
        )

        foreach ($winElem in $wins) {
            $hwnd = [IntPtr]$winElem.Current.NativeWindowHandle
            if ($hwnd -ne [IntPtr]::Zero -and [Win32Helper]::IsIconic($hwnd)) { continue }

            $btns = $winElem.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
            if ($btns.Count -eq 0) {
                Wake-ChromiumAccessibility -WinElem $winElem
                $btns = $winElem.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
            }

            if ($btns.Count -ne $script:lastBtnCount) {
                $script:lastBtnCount = $btns.Count
                Write-Log "Window '$($winElem.Current.Name)' buttons detected: $($btns.Count)"
            }

            foreach ($btn in $btns) {
                $rawName = $btn.Current.Name
                if (-not $rawName) { continue }
                $name = $rawName.Trim().ToLowerInvariant()
                if ($name.Length -eq 0 -or $name.Length -gt 30) { continue }

                if ($TargetLabels -contains $name) {
                    if ($btn.Current.IsEnabled -and -not $btn.Current.IsOffscreen) {
                        $clicked = $false
                        $patternObj = $null
                        if ($btn.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$patternObj)) {
                            $patternObj.Invoke()
                            $clicked = $true
                        }
                        if ($clicked) {
                            $script:lastClickTime = $now
                            $script:retryCount++
                            Update-TrayUI
                            Write-Log "Clicked '$rawName' (total: $($script:retryCount))"
                            $notifyIcon.ShowBalloonTip(2000, "Antigravity Auto-Retry", "已自动点击 $rawName (第 $($script:retryCount) 次)", [System.Windows.Forms.ToolTipIcon]::Info)
                            return
                        } else {
                            Write-Log "Found '$rawName' but InvokePattern not supported"
                        }
                    }
                }
            }
        }
    } catch {
        # Ignore transient UIA errors
    }
})

Write-Log "Auto-Retry started."
Update-TrayUI
$timer.Start()
[System.Windows.Forms.Application]::Run()
