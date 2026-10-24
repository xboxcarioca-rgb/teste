; DTFLEXPRO Studio — Assistente de Instalação (NSIS / Modern UI 2)
Unicode true
ManifestDPIAware true
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "DTFLEXPRO Studio"
!define COMPANY "DTFLEXPRO"
!define VERSION "1.2.0"
!define EXE "DTFLEXPRO Studio.exe"
!define SRC "electron-release\DTFLEXPRO Studio-win32-x64"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\DTFLEXPROStudio"

Name "${APPNAME} ${VERSION}"
OutFile "dist-installer\DTFLEXPRO-Studio-Setup.exe"
InstallDir "$LOCALAPPDATA\DTFLEXPRO Studio"
InstallDirRegKey HKCU "Software\DTFLEXPRO Studio" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "DTFLEXPRO — Halftone Studio"

; ---------- Aparência ----------
!define MUI_ICON "electron\assets\icon.ico"
!define MUI_UNICON "electron\assets\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEFINISHPAGE_BITMAP "electron\assets\wizard-side.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "electron\assets\wizard-side.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "electron\assets\wizard-header.bmp"

; ---------- Páginas do assistente ----------
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Este assistente irá guiá-lo na instalação do ${APPNAME} no seu computador.$\r$\n$\r$\nO software funciona offline, mas exige um código de ativação válido do seu plano (mensal ou anual).$\r$\n$\r$\nFeche outros programas antes de continuar e clique em Avançar."
!insertmacro MUI_PAGE_WELCOME

!define MUI_LICENSEPAGE_TEXT_TOP "Leia o contrato de licença antes de instalar."
!define MUI_LICENSEPAGE_BUTTON "Eu Concordo"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Se você aceita os termos, clique em Eu Concordo para continuar."
!insertmacro MUI_PAGE_LICENSE "electron\LICENSE.txt"

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "Instalação concluída"
!define MUI_FINISHPAGE_TEXT "O ${APPNAME} foi instalado com sucesso.$\r$\n$\r$\nNa primeira execução, informe o seu e-mail e o código de ativação do plano."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Executar o ${APPNAME} agora"
!define MUI_FINISHPAGE_LINK "Acessar dtflexpro.com"
!define MUI_FINISHPAGE_LINK_LOCATION "https://dtflexpro.com"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

; ---------- Seções (componentes) ----------
Section "Programa principal (obrigatório)" SEC_CORE
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"

  ; Move arquivos jurídicos para uma pasta oculta
  CreateDirectory "$INSTDIR\resources\legal"
  Rename "$INSTDIR\LICENSE" "$INSTDIR\resources\legal\LICENSE"
  Rename "$INSTDIR\LICENSES.chromium.html" "$INSTDIR\resources\legal\LICENSES.chromium.html"
  Rename "$INSTDIR\version" "$INSTDIR\resources\legal\version"
  SetFileAttributes "$INSTDIR\resources\legal" HIDDEN
  SetFileAttributes "$INSTDIR\resources\legal\LICENSE" HIDDEN
  SetFileAttributes "$INSTDIR\resources\legal\LICENSES.chromium.html" HIDDEN
  SetFileAttributes "$INSTDIR\resources\legal\version" HIDDEN

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\DTFLEXPRO Studio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "${COMPANY}"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${REGKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Atalho na Área de Trabalho" SEC_DESKTOP
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
SectionEnd

Section "Atalho no Menu Iniciar" SEC_START
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CORE} "Arquivos do programa DTFLEXPRO Studio (necessário)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_DESKTOP} "Cria um ícone na Área de Trabalho."
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_START} "Cria atalhos no Menu Iniciar."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ---------- Desinstalação ----------
Section "Uninstall"
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk"
  RMDir "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${REGKEY}"
  DeleteRegKey HKCU "Software\DTFLEXPRO Studio"
SectionEnd
