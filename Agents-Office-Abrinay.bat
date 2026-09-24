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
rem Cerebro de los agentes: Claude (tu login de Claude Code) o Meta Muse Spark (API compatible con Anthropic).
rem La key de Meta NUNCA va en este archivo: se guarda una vez con  setx MODEL_API_KEY "tu-key"
echo Con que cerebro trabajan los agentes hoy?
echo   [1] Claude  ^(tu login de Claude Code^)
echo   [2] Meta    ^(Muse Spark 1.3 Contributor^)
choice /c 12 /t 10 /d 1 /n /m "Elige 1 o 2 (en 10 segundos arranca con Claude): "
if errorlevel 2 (
  if not defined MODEL_API_KEY (
    echo [ERROR] No encontre tu key de Meta. Guardala una vez con:  setx MODEL_API_KEY "tu-key"
    echo Luego cierra esta ventana y vuelve a abrir el iniciador.
    pause
    exit /b 1
  )
  set "ANTHROPIC_BASE_URL=https://api.meta.ai"
  set "ANTHROPIC_AUTH_TOKEN=%MODEL_API_KEY%"
  set "ANTHROPIC_MODEL=muse-spark-1.3-contributor"
  set "ANTHROPIC_DEFAULT_OPUS_MODEL=muse-spark-1.3-contributor"
  set "ANTHROPIC_DEFAULT_SONNET_MODEL=muse-spark-1.3-contributor"
  set "ANTHROPIC_DEFAULT_HAIKU_MODEL=muse-spark-1.3-contributor"
  set "ANTHROPIC_API_KEY="
  echo Cerebro: META Muse Spark 1.3 Contributor
) else (
  set "ANTHROPIC_BASE_URL="
  set "ANTHROPIC_AUTH_TOKEN="
  set "ANTHROPIC_MODEL="
  set "ANTHROPIC_DEFAULT_OPUS_MODEL="
  set "ANTHROPIC_DEFAULT_SONNET_MODEL="
  set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
  set "ANTHROPIC_API_KEY="
  echo Cerebro: CLAUDE
)
echo.
rem Librerias del proyecto: se instalan si faltan (una copia recien bajada) o si el equipo agrego alguna
powershell -NoProfile -Command "if (!(Test-Path 'node_modules\.package-lock.json') -or ((Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item 'node_modules\.package-lock.json').LastWriteTime)) { exit 2 } else { exit 0 }" >nul 2>nul
if errorlevel 2 (
  echo [0/3] Instalando las librerias del proyecto, solo esta vez...
  call npm install --no-audit --no-fund
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
rem Los logs se rotan al pasar 5 MB: guardan titulos de tareas y crecerian sin fin.
for %%F in (server.log server.err.log) do if exist %%F for %%S in (%%F) do if %%~zS GTR 5000000 move /y %%F %%F.1 >nul
start "Agents Office Server" /min cmd /c "node serve.mjs >> server.log 2>> server.err.log"
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
