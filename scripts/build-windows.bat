@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
rem ============================================================================
rem  Build local do instalador .exe do Viral Cut Studio (Windows)
rem
rem  Uso:  scripts\build-windows.bat          (build completo: instala + testa + empacota)
rem        scripts\build-windows.bat --fast   (só empacota, sem npm ci/testes)
rem
rem  Requisitos: Node.js >= 20.11 (https://nodejs.org) e npm.
rem  Saída:      dist\Viral Cut Studio-Setup-1.0.0.exe  e  ...-Portable-1.0.0.exe
rem ============================================================================

cd /d "%~dp0.."

set FAST=0
if /i "%~1"=="--fast" set FAST=1

echo.
echo  Viral Cut Studio - build Windows
echo  =================================
echo.

rem ---- 1. Node.js presente? --------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado no PATH.
    echo        Instale em https://nodejs.org/ e abra um novo terminal.
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo [1/5] Node.js %NODEVER%

rem ---- 2. Dependencias -------------------------------------------------------
if %FAST%==1 (
    echo [2/5] Modo --fast: pulando npm ci
) else (
    echo [2/5] Instalando dependencias (npm ci)...
    call npm ci
    if errorlevel 1 (
        echo [ERRO] npm ci falhou. Verifique a conexao e o package-lock.json.
        exit /b 1
    )
)

rem ---- 3. Verificacoes previas ----------------------------------------------
echo [3/5] Verificando prerequisitos do pacote...
node scripts\verify-package.js
if errorlevel 1 (
    echo [ERRO] Verificacao falhou. Corrija os itens acima antes de empacotar.
    exit /b 1
)

rem ---- 4. Testes ------------------------------------------------------------
if %FAST%==1 (
    echo [4/5] Modo --fast: pulando testes
) else (
    echo [4/5] Rodando testes (unitarios + renderizacao real com FFmpeg)...
    call npm test
    if errorlevel 1 (
        echo [ERRO] Testes unitarios falharam.
        exit /b 1
    )
)

rem ---- 5. Empacotar ---------------------------------------------------------
echo [5/5] Gerando instalador NSIS + portable (pode levar alguns minutos)...
call npx electron-builder --win nsis portable --x64
if errorlevel 1 (
    echo [ERRO] electron-builder falhou. Veja a saida acima.
    exit /b 1
)

echo.
echo  Build concluido. Arquivos em dist\:
for %%f in (dist\*.exe) do echo    %%~nxf  (%%~zf bytes)
echo.
echo  Instale com:  dist\"Viral Cut Studio-Setup-1.0.0.exe"
echo  (Sem assinatura de codigo o SmartScreen mostra o aviso padrao;
echo   clique em "Mais informacoes" ^> "Executar assim mesmo".)
echo.
endlocal
exit /b 0
