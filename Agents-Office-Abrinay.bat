@echo off
TITLE Agents Office - Iniciador
cd /d "%~dp0"
echo ============================================
echo  Agents Office - Iniciando tu oficina 3D
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instalalo desde https://nodejs.org ^(version 20 o mayor^).
  pause
  exit /b 1
)
echo [1/3] Construyendo la oficina con los ultimos cambios...
call node build.mjs >nul 2>nul
if errorlevel 1 (
  if not exist "dist\command-centre-v2.html" (
    echo [ERROR] Fallo la construccion. Corre "node build.mjs" para ver el detalle.
    pause
    exit /b 1
  )
  echo [AVISO] La construccion fallo; se usa la version anterior de la oficina.
) else (
  echo Oficina construida. OK.
)
rem Siempre se reinicia el servidor: si quedo uno prendido de antes, no carga los cambios de configuracion, agentes ni codigo.
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 4520 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if ($p -and $p.Name -eq 'node.exe') { Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 1; exit 2 } }; exit 0" >nul 2>nul
if errorlevel 2 (
  echo [2/3] Habia un servidor de antes: se apago para cargar los ultimos cambios.
)
echo [2/3] Prendiendo el servidor en segundo plano...
start "Agents Office Server" /min cmd /c "node serve.mjs ^>^> server.log 2^>^> server.err.log"
echo Esperando respuesta del servidor ^(hasta 40 segundos^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for ($i=0; $i -lt 20; $i++) { try { $r=Invoke-RestMethod -Uri 'http://localhost:4520/api/health' -TimeoutSec 3; if ($r.ok -eq $true) { $ok=$true; break } } catch {}; Start-Sleep -Seconds 2 }; if ($ok) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] El servidor no respondio. Revisa server.log y server.err.log
  pause
  exit /b 1
)
echo Servidor listo. OK.
:ABRIR
echo [3/3] Abriendo la oficina en tu navegador...
start "" "http://localhost:4520/"
echo.
echo Listo! Tu oficina esta en http://localhost:4520/
echo Puedes cerrar esta ventana. El servidor sigue corriendo en segundo plano.
timeout /t 5 >nul
exit /b 0
