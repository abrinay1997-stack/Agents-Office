@echo off
setlocal
TITLE Agents Office - Volver a la version anterior
cd /d "%~dp0"
echo ============================================
echo  Agents Office - Volver a la version anterior
echo ============================================
echo.
rem V4.4 (B10): si una actualizacion rompio algo, esto deja el codigo como estaba ANTES del ultimo Actualizar-Oficina.bat.
rem No toca lo privado de esta maquina: data\, office.config.local.json, las entregas ni las keys.
rem Tus cambios propios siguen guardados en su commit local; nada se borra.
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encontre Git.
  pause
  exit /b 1
)
if not exist "data\version-anterior.txt" (
  echo No hay una version anterior anotada: esto funciona despues de usar Actualizar-Oficina.bat al menos una vez.
  pause
  exit /b 1
)
set /p PREV=<"data\version-anterior.txt"
echo Version actual:
git log -1 --pretty=format:"  %%h  %%ad  %%s" --date=format:"%%d/%%m %%H:%%M"
echo.
echo Volver a:
git log -1 --pretty=format:"  %%h  %%ad  %%s" --date=format:"%%d/%%m %%H:%%M" %PREV%
echo.
echo.
choice /C SN /M "Volver a esa version"
if errorlevel 2 exit /b 0
git checkout -- "dist/command-centre-v2.html" "src/braingraph.js" >nul 2>nul
git branch -f antes-de-volver HEAD >nul 2>nul
git reset --keep %PREV%
if errorlevel 1 (
  echo [ATENCION] No pude volver: tienes cambios sin guardar en archivos que la version anterior tambien cambia.
  echo Abre Claude Code en esta carpeta y dile: vuelve a la version anterior de la oficina.
  pause
  exit /b 1
)
call npm install --no-audit --no-fund >nul 2>nul
echo.
echo Listo: la oficina esta como antes de la ultima actualizacion.
echo La version que fallo queda guardada en la rama "antes-de-volver". Avisa al equipo que algo se rompio.
echo La proxima vez que uses Actualizar-Oficina.bat volveras a traer lo ultimo (con el arreglo, si ya lo subieron).
echo.
if defined AO_NO_LAUNCH exit /b 0
call "%~dp0Agents-Office-Abrinay.bat"
