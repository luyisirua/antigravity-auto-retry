Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\KT\Documents\antigravity-auto-retry\AntigravityAutoRetry.ps1""", "", "runas", 0
