# Antigravity 2.0 Auto-Retry (Windows Built-in OCR Visual Engine + SendInput)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Runtime.WindowsRuntime

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Win32Helper {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public MOUSEINPUT mi;
    }

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr handle);

    public static uint SendMouseMoveAbs(int x, int y) {
        int vx = GetSystemMetrics(76); // SM_XVIRTUALSCREEN
        int vy = GetSystemMetrics(77); // SM_YVIRTUALSCREEN
        int vw = GetSystemMetrics(78); // SM_CXVIRTUALSCREEN
        int vh = GetSystemMetrics(79); // SM_CYVIRTUALSCREEN
        if (vw <= 0) vw = GetSystemMetrics(0);
        if (vh <= 0) vh = GetSystemMetrics(1);

        int normX = (int)Math.Round((double)(x - vx) * 65535.0 / Math.Max(1, vw - 1));
        int normY = (int)Math.Round((double)(y - vy) * 65535.0 / Math.Max(1, vh - 1));

        INPUT[] inp = new INPUT[1];
        inp[0].type = 0; // INPUT_MOUSE
        inp[0].mi.dx = normX;
        inp[0].mi.dy = normY;
        inp[0].mi.dwFlags = 0x0001 | 0x8000 | 0x4000; // MOVE | ABSOLUTE | VIRTUALDESK
        return SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
    }

    public static uint SendMouseClickFlag(uint flag) {
        INPUT[] inp = new INPUT[1];
        inp[0].type = 0; // INPUT_MOUSE
        inp[0].mi.dwFlags = flag;
        return SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@

[Win32Helper]::SetProcessDPIAware() | Out-Null

# WinRT Async Helper for Windows.Media.Ocr
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRt {
    param($WinRtTask, [Type]$ResultType)
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

$script:ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

# Configuration
$ScanIntervalMs = 3000
$CooldownMs = 6000
$LogFile = "C:\Users\KT\Documents\antigravity-auto-retry\retry.log"

$script:enabled = $true
$script:retryCount = 0
$script:lastClickTime = [DateTime]::MinValue

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] $Message" -Encoding UTF8
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
$menuDiagOcr = New-Object System.Windows.Forms.ToolStripMenuItem("测试视觉识别 (OCR)")
$menuLog = New-Object System.Windows.Forms.ToolStripMenuItem("打开运行日志")
$menuExit = New-Object System.Windows.Forms.ToolStripMenuItem("退出")

$contextMenu.Items.Add($menuStatus) | Out-Null
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$contextMenu.Items.Add($menuToggle) | Out-Null
$contextMenu.Items.Add($menuDiagOcr) | Out-Null
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

function Get-AntigravityWindowHandles {
    $agPids = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    if ($agPids.Count -eq 0) { return @() }

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    $result = @()
    foreach ($w in $wins) {
        if ($w.Current.ProcessId -in $agPids -and $w.Current.Name) {
            $hwnd = [IntPtr]$w.Current.NativeWindowHandle
            if ($hwnd -ne [IntPtr]::Zero -and [Win32Helper]::IsWindowVisible($hwnd) -and -not [Win32Helper]::IsIconic($hwnd)) {
                $result += [PSCustomObject]@{
                    Handle = $hwnd
                    Title  = $w.Current.Name
                    Elem   = $w
                }
            }
        }
    }
    return $result
}

function Is-BlueButtonPixel {
    param([System.Drawing.Bitmap]$Bmp, [double]$X, [double]$Y, [double]$W, [double]$H)
    $cx = [int]($X + $W / 2)
    $cy = [int]($Y + $H / 2)
    $points = @(
        @([Math]::Max(0, [int]($X - 5)), $cy),
        @([Math]::Min($Bmp.Width - 1, [int]($X + $W + 5)), $cy),
        @($cx, [Math]::Max(0, [int]($Y - 3))),
        @($cx, [Math]::Min($Bmp.Height - 1, [int]($Y + $H + 3)))
    )
    $blueCount = 0
    foreach ($pt in $points) {
        if ($pt[0] -ge 0 -and $pt[0] -lt $Bmp.Width -and $pt[1] -ge 0 -and $pt[1] -lt $Bmp.Height) {
            $c = $Bmp.GetPixel($pt[0], $pt[1])
            if ($c.R -lt 90 -and $c.B -gt 120 -and ($c.B - $c.R) -gt 50) {
                $blueCount++
            }
        }
    }
    return ($blueCount -ge 3)
}

function Find-RetryByOcr {
    param([IntPtr]$Hwnd, [switch]$DiagMode)
    if (-not $script:ocrEngine) { return $null }

    $rect = New-Object Win32Helper+RECT
    if (-not [Win32Helper]::GetWindowRect($Hwnd, [ref]$rect)) { return $null }

    $winW = $rect.Right - $rect.Left
    $winH = $rect.Bottom - $rect.Top
    if ($winW -lt 200 -or $winH -lt 200) { return $null }

    # Capture bottom 45% of the window where error banners appear
    $scanTop = $rect.Top + [int]($winH * 0.55)
    $scanH = $rect.Bottom - $scanTop
    $scanLeft = $rect.Left

    $bmp = New-Object System.Drawing.Bitmap($winW, $scanH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($scanLeft, $scanTop, 0, 0, $bmp.Size)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bytes = $ms.ToArray()
    $ms.Dispose()

    $ras = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $writer = New-Object Windows.Storage.Streams.DataWriter($ras.GetOutputStreamAt(0))
    $writer.WriteBytes($bytes)
    Await-WinRt ($writer.StoreAsync()) ([uint32]) | Out-Null
    $writer.DetachStream() | Out-Null
    $writer.Dispose()

    $ras.Seek(0)
    $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $softBmp = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

    $ocrResult = Await-WinRt ($script:ocrEngine.RecognizeAsync($softBmp)) ([Windows.Media.Ocr.OcrResult])

    $found = $null
    $allLines = @()

    foreach ($line in $ocrResult.Lines) {
        if ($DiagMode) { $allLines += $line.Text }
        $words = @($line.Words)
        for ($i = 0; $i -lt $words.Count; $i++) {
            $w1 = $words[$i].Text.Trim().ToLowerInvariant()
            $r1 = $words[$i].BoundingRect

            $matchedLabel = $null
            $boxX = $r1.X; $boxY = $r1.Y; $boxW = $r1.Width; $boxH = $r1.Height

            if ($w1 -in @("retry", "resume", "重试")) {
                $matchedLabel = $words[$i].Text
            } elseif ($w1 -eq "try" -and ($i + 1) -lt $words.Count -and $words[$i + 1].Text.Trim().ToLowerInvariant() -eq "again") {
                $r2 = $words[$i + 1].BoundingRect
                $matchedLabel = "Try again"
                $boxW = ($r2.X + $r2.Width) - $r1.X
            }

            if ($matchedLabel) {
                if (Is-BlueButtonPixel -Bmp $bmp -X $boxX -Y $boxY -W $boxW -H $boxH) {
                    $found = [PSCustomObject]@{
                        Label   = $matchedLabel
                        ScreenX = $scanLeft + [int]($boxX + $boxW / 2)
                        ScreenY = $scanTop + [int]($boxY + $boxH / 2)
                    }
                    break
                }
            }
        }
        if ($found) { break }
    }

    $softBmp.Dispose()
    $ras.Dispose()
    $bmp.Dispose()

    if ($DiagMode) {
        return [PSCustomObject]@{
            Found = $found
            Lines = $allLines
            WinSize = "${winW}x${winH}"
        }
    }
    return $found
}

function Invoke-MouseClickAt {
    param([IntPtr]$Hwnd, [int]$X, [int]$Y)
    $origPt = New-Object Win32Helper+POINT
    [Win32Helper]::GetCursorPos([ref]$origPt) | Out-Null

    if ([Win32Helper]::GetForegroundWindow() -ne $Hwnd) {
        [Win32Helper]::SetForegroundWindow($Hwnd) | Out-Null
        Start-Sleep -Milliseconds 100
    }

    $mSent = [Win32Helper]::SetCursorPos($X, $Y)
    Start-Sleep -Milliseconds 120
    $curPt = New-Object Win32Helper+POINT
    [Win32Helper]::GetCursorPos([ref]$curPt) | Out-Null

    $dSent = [Win32Helper]::SendMouseClickFlag(0x0002) # LEFTDOWN
    Start-Sleep -Milliseconds 80
    $uSent = [Win32Helper]::SendMouseClickFlag(0x0004) # LEFTUP
    Start-Sleep -Milliseconds 300

    [Win32Helper]::SetCursorPos($origPt.X, $origPt.Y) | Out-Null
    return "move=$mSent,down=$dSent,up=$uSent,actual=($($curPt.X),$($curPt.Y))"
}

# Diagnostic test
$menuDiagOcr.Add_Click({
    try {
        $wins = @(Get-AntigravityWindowHandles)
        if ($wins.Count -eq 0) {
            [System.Windows.Forms.MessageBox]::Show("未检测到可见的 Antigravity 窗口。", "OCR 视觉诊断")
            return
        }

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $res = Find-RetryByOcr -Hwnd $wins[0].Handle -DiagMode
        $sw.Stop()

        $linePreview = ($res.Lines | Select-Object -First 8) -join " | "
        $msg = "窗口: $($wins[0].Title) ($($res.WinSize))`n识别耗时: $($sw.ElapsedMilliseconds) ms`n底部识别到的文字: $linePreview`n"
        if ($res.Found) {
            $msg += "`n✅ 成功锁定蓝色按钮 '$($res.Found.Label)' 坐标: ($($res.Found.ScreenX), $($res.Found.ScreenY))"
        } else {
            $msg += "`nℹ️ 当前画面未出现蓝色 Retry 按钮（如已有文字输出说明视觉引擎工作正常）。"
        }
        [System.Windows.Forms.MessageBox]::Show($msg, "OCR 视觉诊断")
    } catch {
        [System.Windows.Forms.MessageBox]::Show("诊断出错: $($_.Exception.Message)", "OCR 视觉诊断")
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
        $wins = @(Get-AntigravityWindowHandles)
        if ($wins.Count -eq 0) { return }

        foreach ($w in $wins) {
            $hit = Find-RetryByOcr -Hwnd $w.Handle
            if ($hit) {
                $sendStat = Invoke-MouseClickAt -Hwnd $w.Handle -X $hit.ScreenX -Y $hit.ScreenY
                $script:lastClickTime = $now
                $script:retryCount++
                Update-TrayUI
                Write-Log "Visual OCR clicked '$($hit.Label)' at ($($hit.ScreenX), $($hit.ScreenY)) [$sendStat] (total: $($script:retryCount))"
                $notifyIcon.ShowBalloonTip(2000, "Antigravity Auto-Retry", "已自动点击 $($hit.Label) (第 $($script:retryCount) 次)", [System.Windows.Forms.ToolTipIcon]::Info)
                return
            }
        }
    } catch {
        if ($_.Exception.Message -notmatch "句柄无效|handle is invalid") { Write-Log "Scan error: $($_.Exception.Message)" }
    }
})

Write-Log "Auto-Retry (Visual OCR Engine) started."
Update-TrayUI
$timer.Start()
[System.Windows.Forms.Application]::Run()
