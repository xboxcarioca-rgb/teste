# 🎬 Viral Cut Studio

Ferramenta desktop (Windows) para criar **cortes virais** prontos para publicar:
baixe o vídeo por link, deixe o app achar os melhores trechos, escolha o formato,
adicione legenda e banner — e exporte **sem nenhum metadado** do arquivo original.

Tudo roda localmente na sua máquina. Nenhum vídeo, legenda ou metadado é enviado
para servidor algum.

---

## O que ele faz

| Recurso | Como |
| --- | --- |
| 📥 **Download por link** | Cola o link (YouTube, TikTok, Instagram, Twitch, X…) e o app baixa via yt-dlp, com opção de qualidade e de baixar também o áudio/legendas originais. |
| ✂️ **Cortes automáticos** | Análise de silêncio, fala, gancho nos primeiros segundos, dinâmica de cena e nível de áudio gera candidatos pontuados de 0 a 100, com o motivo de cada sugestão em português. |
| 📐 **Todos os formatos** | 9:16 vertical (Reels/TikTok/Shorts), 1:1 quadrado, 4:5 retrato (feed), 16:9 horizontal e 2.35:1 letterbox — sempre com dimensões pares, prontas para H.264/H.265. |
| 🌫️ **Fundo desfocado** | Vídeo centralizado com o próprio vídeo desfocado e escurecido atrás (o visual clássico de corte vertical). |
| 🪟 **Tela dividida** | Dois vídeos lado a lado ou empilhados (e o modo triplo), com gap, borda e escolha de qual áudio usar (ou mixar os dois). |
| 💬 **Legendas automáticas** | Transcrição offline com Whisper (PT-BR por padrão), animações de palavra (karaoke), caixa, cores e posição configuráveis. |
| 📝 **Legendas manuais** | Importe `.srt`/`.ass`/`.vtt` ou edite cue por cue na linha do tempo, com quebra automática de linha. |
| 🏷️ **Banner** | Texto e/ou imagem/logo, com faixa colorida, caixa ao redor do texto, animações de entrada, fade e templates prontos reutilizáveis em 1 clique. |
| 🧹 **Remoção de metadados** | `-map_metadata -1` + flags *bitexact*: somem autor, data, GPS, software, capítulos e até a tag `encoder` que o próprio FFmpeg gravaria. |
| 🔊 **Áudio de plataforma** | Normalização para -14 LUFS (padrão de redes sociais), fades de entrada/saída e estéreo 48 kHz. |
| 🎞️ **Codecs** | H.264 (libx264) ou H.265 (libx265), com aceleração de hardware NVENC/Quick Sync/VideoToolbox quando disponível. |

---

## Instalando no Windows

### Opção A — instalador pronto (recomendado)

1. Abra a aba **Actions** deste repositório no GitHub.
2. Entre na execução **Build Windows** mais recente (ou dispare uma pelo botão
   *Run workflow*).
3. Baixe o artefato `viral-cut-studio-windows` e extraia.
4. Execute **`Viral Cut Studio-Setup-1.0.0.exe`** e siga o assistente
   (você pode escolher a pasta de instalação).
   - Também há **`Viral Cut Studio-Portable-1.0.0.exe`**, que roda sem instalar.

> Sem assinatura de código, o SmartScreen mostra o aviso padrão do Windows.
> Clique em **“Mais informações” → “Executar assim mesmo”**.

### Opção B — compilar na sua máquina

Requisitos: Windows 10/11 x64 e [Node.js ≥ 20.11](https://nodejs.org/).

```bat
git clone <url-deste-repositorio>
cd teste
scripts\build-windows.bat
```

O script instala as dependências, roda os testes e gera em `dist\`:

- `Viral Cut Studio-Setup-1.0.0.exe` — instalador NSIS (com desinstalador);
- `Viral Cut Studio-Portable-1.0.0.exe` — versão portátil.

Para desenvolvimento, com DevTools aberto:

```bat
npm ci
npm run dev
```

### Binários externos (baixados pelo próprio app, no primeiro uso)

O app baixa e cacheia sozinho, em `%APPDATA%\viral-cut-studio\bin` e `\models`:

- **yt-dlp** — para baixar vídeos por link;
- **whisper.cpp** + modelo **GGML** (tiny→medium) — para transcrever offline.

O FFmpeg/FFprobe **não** são baixados: vêm embutidos pelo npm
(`@ffmpeg-installer/win32-x64`), então a renderização funciona até sem internet.
Se o download de yt-dlp/Whisper falhar (ex.: sem internet), o app continua
funcionando para cortes manuais, legenda manual e renderização.

---

## Usando

O fluxo é uma esteira de 6 passos, na lateral esquerda:

1. **Fonte** — abra um arquivo de vídeo ou cole um link. Dá para adicionar
   vídeos extras (para tela dividida) e ver a forma de onda com os silêncios.
2. **Cortes** — rode a análise automática ou marque os trechos manualmente na
   linha do tempo. Cada candidato mostra nota, duração e o porquê.
3. **Formato** — proporção, layout (preencher / fundo desfocado / barras /
   tela dividida), ponto de foco do recorte e fps.
4. **Legendas** — transcreva com Whisper, importe um `.srt` ou edite as cues.
5. **Banner** — texto, imagem/logo, animações e templates salvos.
6. **Saída** — codec, qualidade, normalização de áudio, **remoção de
   metadados**, padrão de nome de arquivo e a fila de renderização.

Na saída você ainda pode:

- **Prévia rápida** (6 s, baixa resolução) antes de renderizar de verdade;
- ver o **comando FFmpeg completo** que será executado (transparência total);
- inspecionar os **metadados do arquivo final** e confirmar que está limpo.

Os projetos são salvos em `.json` (Arquivo → Salvar projeto), então dá para
reabrir e ajustar um corte depois.

---

## Desenvolvimento

```
src/
├── common/     formatos, tempo, padrões, canais IPC, leitura de links
├── engine/     o coração: geometria, filtros, legendas ASS, metadados,
│               argumentos do FFmpeg, cortes, análise, PNG, progresso, render
├── tools/      wrappers: probe, ffmpeg, yt-dlp, whisper, fontes, binários
├── main/       processo principal: janelas, jobs, templates, settings, IPC
├── preload/    ponte segura (contextIsolation) entre main e renderer
└── renderer/   interface: HTML + CSS + painéis em JS puro (sem bundler)

test/
├── unit/       175 testes de geometria, escapes, ASS, filtros, args, PNG…
├── integration renderização REAL com FFmpeg de cada formato × layout
└── helpers/    geração de mídias de teste
```

Comandos úteis:

```bash
npm run lint        # checagens próprias (sintaxe, contrato de IPC e de IDs, requires)
npm test            # testes unitários (Node test runner, sem dependências)
npm run test:render # renderiza de verdade cada combinação de formato/layout
npm run test:all    # os dois
npm run icons       # regenera assets/icon.png e build/icon.ico (JS puro)
npm run pack:check  # verifica pré-requisitos de empacotamento
```

O motor é testado contra o binário FFmpeg real: os testes de integração
renderizam cada combinação de formato × layout e verificam resolução, duração,
áudio, metadados removidos, `moov` antes de `mdat` (faststart) e limpeza de
arquivos temporários.

### Por que Electron?

Porque o requisito era um `.exe` instalável no Windows com UI rica, e o FFmpeg
já resolve todo o processamento de vídeo — o Electron entra só como casca de
aplicativo desktop, com o render rodando em processos filhos do FFmpeg
(canceláveis, com progresso em tempo real).

---

## Licença

MIT
