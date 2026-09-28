@echo off
chcp 65001 >nul
:: =========================================================================
::  קובץ הפעלה ייעודי לעמדות סייפר (Safer Kiosk) - תורה דיליה
::  נעילה הרמטית: מונע כל גישה לאינטרנט החיצוני ומאפשר אך ורק את המערכת המקומית
:: =========================================================================

setlocal enabledelayedexpansion
title תורה דיליה - עמדת קיוסק סייפר (נעולה הרמטית)

cd /d "%~dp0"

:: 1. הפעלת שרת העמדה ברקע עם דגל --safer (מונע סגירה מוקדמת ע"י סייפר)
if exist "TorahKiosk.exe" (
    start "" /b "TorahKiosk.exe" --safer
) else if exist "..\TorahKiosk.exe" (
    start "" /b "..\TorahKiosk.exe" --safer
) else if exist "node_modules" (
    start "" /b npm start -- --safer
)

:: 2. המתנה של 2 שניות לעליית השרת המקומי
timeout /t 2 /nobreak >nul

:: 3. איתור דפדפן Microsoft Edge
set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramW6432%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramW6432%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

:: 4. תיקיית פרופיל ייעודית ומבודדת לחלוטין (מונע גישה לפרופיל המשתמש האישי)
set "PROFILE_DIR=%LOCALAPPDATA%\TorahKioskEdgeProfile"
if not defined LOCALAPPDATA set "PROFILE_DIR=%TEMP%\TorahKioskEdgeProfile"

:: 5. הגדרת מדיניות נעילת גלישה ברמת הפרופיל המבודד (Registry Policy)
:: חוסם את כל כתובות האינטרנט בעולם (*) ומאפשר אך ורק את השרת המקומי (127.0.0.1:3000)
reg add "HKCU\Software\Policies\Microsoft\Edge\URLBlocklist" /v 1 /t REG_SZ /d "*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge\URLAllowlist" /v 1 /t REG_SZ /d "http://127.0.0.1:3000/*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge" /v "DeveloperToolsAvailability" /t REG_DWORD /d 2 /f >nul 2>&1

:: 6. הפעלת החלון במצב אפליקציה נעול הרמטית
:: --app: חלון תוכנה נקי ללא סרגל כתובות, ללא טאבים וללא שורת סימניות
:: --disable-features: חוסם סרגלי צד של בינג/AI (Copilot/msEdgeSidebarV2)
:: --kiosk-printing: הדפסה מהירה ללא תפריטי מערכת
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
