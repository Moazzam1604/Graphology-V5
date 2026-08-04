@echo off
where python >nul 2>nul
if %errorlevel% neq 0 (
 echo Python is not installed. Upload these files to GitHub Pages instead.
 pause
 exit /b 1
)
start http://localhost:8000
python -m http.server 8000
