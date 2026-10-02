@echo off
chcp 65001 >nul
:: =========================================================================
::  קובץ הפעלה ייעודי לעמדות סייפר (Safer Kiosk) - תורה דיליה
::  תמיכה מלאה בהפעלה עצמאית מובנית (~130MB) - ללא צורך בדפדפן Edge!
:: =========================================================================

setlocal enabledelayedexpansion
title תורה דיליה - עמדת קיוסק סייפר עצמאית

cd /d "%~dp0"

:: 1. בדיקה אם קיימת אפליקציה עצמאית מובנית (Electron Standalone ~130MB)
set "STANDALONE_EXE="
if exist "TorahKiosk-Standalone-130MB.exe" set "STANDALONE_EXE=%~dp0TorahKiosk-Standalone-130MB.exe"
if not defined STANDALONE_EXE if exist "..\TorahKiosk-Standalone-130MB.exe" set "STANDALONE_EXE=%~dp0..\TorahKiosk-Standalone-130MB.exe"
if not defined STANDALONE_EXE if exist "dist-electron\TorahKiosk-Standalone-130MB.exe" set "STANDALONE_EXE=%~dp0dist-electron\TorahKiosk-Standalone-130MB.exe"
if not defined STANDALONE_EXE if exist "..\dist-electron\TorahKiosk-Standalone-130MB.exe" set "STANDALONE_EXE=%~dp0..\dist-electron\TorahKiosk-Standalone-130MB.exe"
if not defined STANDALONE_EXE if exist "dist-electron\win-unpacked\תורה דיליה - עמדת קיוסק.exe" set "STANDALONE_EXE=%~dp0dist-electron\win-unpacked\תורה דיליה - עמדת קיוסק.exe"
if not defined STANDALONE_EXE if exist "..\dist-electron\win-unpacked\תורה דיליה - עמדת קיוסק.exe" set "STANDALONE_EXE=%~dp0..\dist-electron\win-unpacked\תורה דיליה - עמדת קיוסק.exe"

:: אם נמצאה האפליקציה העצמאית (130MB) - מפעיל אותה ישירות ללא שום תלות ב-Edge!
if defined STANDALONE_EXE (
    echo [+] מפעיל אפליקציה עצמאית מובנית (ללא תלות ב-Edge): !STANDALONE_EXE!
    start "" "!STANDALONE_EXE!"
    exit
)

:: 2. אם מופעל בסביבת פיתוח עם Electron מותקן
if exist "node_modules\electron" (
    echo [+] מפעיל מנוע חלון עצמאי דרך Electron...
    start "" npm run electron
    exit
)

:: 3. הפעלת שרת העמדה ברקע אם עובדים עם TorahKiosk.exe הבסיסי
if exist "TorahKiosk.exe" (
    start "" /b "TorahKiosk.exe" --safer
) else if exist "..\TorahKiosk.exe" (
    start "" /b "..\TorahKiosk.exe" --safer
) else if exist "node_modules" (
    start "" /b npm start -- --safer
)

:: 4. המתנה של 2 שניות לעליית השרת המקומי
timeout /t 2 /nobreak >nul

:: 5. נתיב גיבוי ל-Microsoft Edge רק אם לא נבנתה גרסת ה-130MB העצמאית
set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramW6432%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramW6432%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

set "PROFILE_DIR=%LOCALAPPDATA%\TorahKioskEdgeProfile"
if not defined LOCALAPPDATA set "PROFILE_DIR=%TEMP%\TorahKioskEdgeProfile"

reg add "HKCU\Software\Policies\Microsoft\Edge\URLBlocklist" /v 1 /t REG_SZ /d "*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge\URLAllowlist" /v 1 /t REG_SZ /d "http://127.0.0.1:3000/*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge" /v "DeveloperToolsAvailability" /t REG_DWORD /d 2 /f >nul 2>&1

if defined EDGE_EXE (
    start "" "%EDGE_EXE%" ^
      --app=http://127.0.0.1:3000 ^
      --user-data-dir="%PROFILE_DIR%" ^
      --new-window ^
      --disable-extensions ^
      --no-first-run ^
      --no-default-browser-check ^
      --disable-features=Translate,msEdgeSidebarV2,msHub,msEdgeShare ^
      --disable-default-apps ^
      --kiosk-printing
) else (
    start "" http://127.0.0.1:3000
)

exit
