@echo off
setlocal
rem Determine port (default 5000)
if "%~1"=="" (
  set "PORT=5101"
) else (
  set "PORT=%~1"
)
echo Starting local server on port %PORT% ...
rem Use npx to run serve without installing globally
npx -y serve -l %PORT% .

