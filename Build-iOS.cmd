@echo off
REM ===================================================================
REM  GrowTime - iOS build launcher
REM  Double-click this file to run the interactive iOS build.
REM  It opens Git Bash and starts the credential setup + build.
REM ===================================================================
title GrowTime iOS Build

set "GITBASH=D:\Program Files\Git\git-bash.exe"

if not exist "%GITBASH%" (
  echo.
  echo  ERROR: Git Bash not found at:
  echo    %GITBASH%
  echo.
  echo  Please open Git Bash manually and run:
  echo    cd /c/Users/Administrator/WorkBuddy/APP/GrowTime
  echo    bash scripts/setup-ios-credentials.sh
  echo.
  pause
  exit /b 1
)

echo.
echo  Starting Git Bash and running the iOS build script...
echo  Please enter your Apple ID and password when prompted.
echo.

"%GITBASH%" -c "cd /c/Users/Administrator/WorkBuddy/APP/GrowTime && bash scripts/setup-ios-credentials.sh; echo; echo '--- Script finished. Press Enter to close ---'; read"

exit /b 0
