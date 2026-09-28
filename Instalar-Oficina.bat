@echo off
rem Agents Office V4.4 (25 Sep 2026, auditoria J3): instalar la oficina en una computadora nueva con un doble clic.
rem Instala lo que falte (Node 20+, Git, Claude Code), trae la oficina de GitHub, instala sus librerias y deja un acceso
rem directo en el escritorio. No guarda ninguna key: las keys van en las variables de entorno de Windows (docs/instalar.md).
TITLE Agents Office - Instalador
setlocal
echo ============================================
echo  Agents Office - Instalar la oficina
echo ============================================
echo.
where winget >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Esta Windows no tiene winget. Instala "App Installer" desde la Microsoft Store y vuelve a abrir este archivo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [1/5] Instalando Node.js ^(LTS^)...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
) else (
  echo [1/5] Node.js ya esta.
)
where git >nul 2>nul
if errorlevel 1 (
  echo [2/5] Instalando Git...
  winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
) else (
  echo [2/5] Git ya esta.
)
rem lo recien instalado aun no esta en el PATH de esta ventana
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd;%APPDATA%\npm"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node se instalo pero esta ventana no lo ve. Cierrala y abre este archivo otra vez.
  pause
  exit /b 1
)
where claude >nul 2>nul
if errorlevel 1 (
  echo [3/5] Instalando Claude Code...
  call npm install -g @anthropic-ai/claude-code
) else (
  echo [3/5] Claude Code ya esta.
)
rem si este archivo ya esta dentro de la oficina, se instala ahi; si no, se clona en Documentos\Agents-Office
if exist "%~dp0package.json" (
  set "DEST=%~dp0"
) else (
  set "DEST=%USERPROFILE%\Documents\Agents-Office"
  if not exist "%USERPROFILE%\Documents\Agents-Office\package.json" (
    echo [4/5] Trayendo la oficina de GitHub...
    git clone https://github.com/abrinay1997-stack/Agents-Office.git "%USERPROFILE%\Documents\Agents-Office"
    if errorlevel 1 (
      echo [ERROR] No pude clonar. Pide al dueno acceso de colaborador en GitHub y vuelve a intentar.
      pause
      exit /b 1
    )
  )
)
cd /d "%DEST%"
echo [4/5] Instalando las librerias de la oficina...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] npm install fallo. Revisa tu conexion y vuelve a abrir este archivo.
  pause
  exit /b 1
)
echo [5/5] Creando el acceso directo en el escritorio...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Agents Office.lnk');$s.TargetPath='%CD%\Agents-Office-Abrinay.bat';$s.WorkingDirectory='%CD%';$s.Save()"
echo.
echo Listo. Falta un paso que solo tu puedes hacer: entrar a Claude Code con tu cuenta.
echo Se abre ahora; escribe /login, sigue los pasos y luego cierra esa ventana.
echo.
pause
start "Claude Code" cmd /k claude
echo Cuando hayas entrado, abre la oficina con el acceso directo "Agents Office" del escritorio.
pause
