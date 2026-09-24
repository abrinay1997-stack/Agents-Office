@echo off
setlocal
TITLE Agents Office - Traer lo ultimo del equipo
cd /d "%~dp0"
echo ============================================
echo  Agents Office - Traer lo ultimo del equipo
echo ============================================
echo.
rem Trae de GitHub lo que el equipo subio (el codigo, las skills, las notas del cerebro) y abre la oficina.
rem Tus cambios propios (rutinas, agentes, notas) nunca se pierden: se guardan antes en un commit local.
rem Lo privado de esta maquina no se toca: data\, office.config.local.json, las entregas y las keys de Windows.
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encontre Git. Instalalo desde https://git-scm.com y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist ".git" (
  echo [ERROR] Esta carpeta no es una copia de GitHub: no hay nada que actualizar.
  pause
  exit /b 1
)
rem 1. Lo que la oficina genera sola al arrancar se descarta: se vuelve a construir y asi no choca con lo nuevo
git checkout -- "dist/command-centre-v2.html" "src/braingraph.js" >nul 2>nul
rem 2. Tus cambios propios se guardan en un commit local antes de traer nada
git diff --quiet HEAD >nul 2>nul
if errorlevel 1 (
  echo Tienes cambios propios: rutinas, agentes, skills o notas. Los guardo primero para no perderlos...
  git add -u
  git commit -q -m "Cambios locales guardados antes de actualizar"
  echo Guardados.
)
rem 3. Traer lo del equipo
echo Trayendo lo ultimo de GitHub...
git pull --no-rebase --no-edit
if errorlevel 1 goto FALLO
rem 4. Si el equipo agrego librerias nuevas, se instalan
powershell -NoProfile -Command "if (!(Test-Path 'node_modules\.package-lock.json') -or ((Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item 'node_modules\.package-lock.json').LastWriteTime)) { exit 2 } else { exit 0 }" >nul 2>nul
if errorlevel 2 (
  echo Instalando las librerias nuevas del proyecto...
  call npm install --no-audit --no-fund
)
echo.
echo Listo. Lo ultimo que entro:
git log -6 --pretty=format:"  - %%ad  %%an: %%s" --date=format:"%%d/%%m %%H:%%M"
echo.
echo.
goto ABRIR

:FALLO
echo.
if exist ".git\MERGE_HEAD" (
  echo [ATENCION] Tus cambios y los del equipo tocan el mismo archivo:
  git diff --name-only --diff-filter=U
  git merge --abort >nul 2>nul
  echo No cambie nada: tu oficina queda como estaba.
  echo Para juntarlos, abre Claude Code en esta carpeta y dile: combina mis cambios con los del equipo.
) else (
  echo [ATENCION] No pude traer lo nuevo: revisa el mensaje de arriba, tu internet o el acceso a GitHub.
  echo Tu oficina queda como estaba.
)
echo.
pause

:ABRIR
if defined AO_NO_LAUNCH exit /b 0
echo Abriendo la oficina...
call "%~dp0Agents-Office-Abrinay.bat"
