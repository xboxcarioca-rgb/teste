/**
 * Testes do construtor de filtergraph (sem executar FFmpeg).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVideoGraph, buildAudioGraph, blurFilter, alphaExpression } = require('../../src/engine/filters');
const { computeGeometry } = require('../../src/engine/geometry');

const CAPS = {
  hasDrawtext: true,
  hasSubtitles: true,
  hasAss: true,
  hasGblur: true,
  hasBoxblur: true,
  hasLoudnorm: true,
  hasFade: true,
  hasColorChannelMixer: true,
  hasAmix: true,
  hasOverlay: true
};

const SOURCE = [{ width: 1920, height: 1080, hasAudio: true, duration: 60 }];

/** Monta o spec padrão para os testes de vídeo. */
function videoSpec(overrides = {}) {
  const output = { formatId: 'vertical', layout: 'fill', focusX: 0.5, focusY: 0.45, ...(overrides.output || {}) };
  return {
    geometry: computeGeometry({ output, sources: overrides.sources || SOURCE }),
    fps: 30,
    clipDuration: 10,
    roles: { panes: [0], background: null, logo: null, ...(overrides.roles || {}) },
    caps: overrides.caps ?? CAPS,
    focus: { x: output.focusX, y: output.focusY },
    background: output.background || {},
    split: output.split || {},
    subtitles: overrides.subtitles || null,
    bannerText: overrides.bannerText || null,
    logo: overrides.logo || null,
    progressBar: overrides.progressBar || null
  };
}

test('grafo "fill" escala cobrindo o alvo e usa corte com ponto de foco', () => {
  const result = buildVideoGraph(videoSpec());
  const graph = result.chains.join(';');
  assert.match(graph, /\[0:v\]fps=30/);
  assert.match(graph, /scale=1080:1920:force_original_aspect_ratio=increase/);
  assert.match(graph, /crop=1080:1920:'/);
  assert.match(graph, /\[base0\]/);
  assert.equal(result.label, 'vout');
  assert.match(graph, /format=yuv420p/);
  assert.deepEqual(result.warnings, []);
});

test('grafo "fill" respeita o pixel format pedido', () => {
  const spec = videoSpec();
  spec.pixelFormat = 'yuv420p10le';
  assert.match(buildVideoGraph(spec).chains.join(';'), /format=yuv420p10le/);
});

test('grafo "fit-blur" faz split, desfoque, escurecimento e overlay centralizado', () => {
  const result = buildVideoGraph(videoSpec({ output: { layout: 'fit-blur', background: { blurRatio: 0.02, dim: 0.4 } } }));
  const graph = result.chains.join(';');
  assert.match(graph, /split=2\[blurbg\]\[blurfg\]/);
  assert.match(graph, /gblur=sigma=\d+/);
  assert.match(graph, /drawbox=x=0:y=0:w=1080:h=1920:color=black@0\.40:t=fill/);
  assert.match(graph, /force_original_aspect_ratio=decrease/);
  assert.match(graph, /overlay=\(W-w\)\/2:\(H-h\)\/2/);
});

test('grafo "fit-blur" limita o sigma do desfoque', () => {
  const spec = videoSpec({ output: { layout: 'fit-blur', background: { blurRatio: 5 } } });
  const graph = buildVideoGraph(spec).chains.join(';');
  const sigma = Number(/gblur=sigma=(\d+)/.exec(graph)[1]);
  assert.ok(sigma <= 80, `sigma deveria ser limitado a 80, veio ${sigma}`);
});

test('grafo "fit-blur" usa boxblur quando gblur não existe no build', () => {
  const spec = videoSpec({ output: { layout: 'fit-blur' }, caps: { ...CAPS, hasGblur: false } });
  const graph = buildVideoGraph(spec).chains.join(';');
  assert.match(graph, /boxblur=luma_radius=\d+:luma_power=2/);
  assert.ok(!graph.includes('gblur'));
});

test('grafo "fit-solid" usa pad com a cor escolhida', () => {
  const result = buildVideoGraph(videoSpec({ output: { layout: 'fit-solid', background: { color: '#1A0033' } } }));
  const graph = result.chains.join(';');
  assert.match(graph, /pad=1080:1920:\(ow-iw\)\/2:\(oh-ih\)\/2:0x1a0033/);
});

test('grafo "fit-solid" com gradiente usa a imagem de fundo como input', () => {
  const result = buildVideoGraph(videoSpec({ output: { layout: 'fit-solid', background: { gradient: true } }, roles: { panes: [0], background: 1 } }));
  const graph = result.chains.join(';');
  assert.match(graph, /\[1:v\]fps=30/);
  assert.match(graph, /\[solidcanvas\]\[solidfg\]overlay=/);
});

test('grafo "split-v" cria canvas colorido e sobrepõe os painéis', () => {
  const sources = [
    { width: 1920, height: 1080, hasAudio: true, duration: 60 },
    { width: 1280, height: 720, hasAudio: true, duration: 60 }
  ];
  const result = buildVideoGraph(
    videoSpec({ output: { layout: 'split-v', split: { gapRatio: 0.01 } }, sources, roles: { panes: [0, 1] } })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /^color=c=0x0b0b0f:s=1080x1920:r=30:d=10/);
  assert.match(graph, /\[pane0\]/);
  assert.match(graph, /\[pane1\]/);
  assert.match(graph, /overlay=0:0:format=auto\[splitmix0\]/);
  // gap de 1% de 1920 = 19.2 -> 20 (par); painel 1 = 950 de altura; y = 950+20.
  assert.match(graph, /overlay=0:970:format=auto\[base0\]/);
});

test('grafo "split-h" divide a largura', () => {
  const sources = [
    { width: 1920, height: 1080, hasAudio: true, duration: 60 },
    { width: 1920, height: 1080, hasAudio: true, duration: 60 }
  ];
  const result = buildVideoGraph(videoSpec({ output: { formatId: 'horizontal', layout: 'split-h' }, sources, roles: { panes: [0, 1] } }));
  const graph = result.chains.join(';');
  assert.match(graph, /s=1920x1080/);
  assert.match(graph, /overlay=960:0:format=auto\[base0\]/);
});

test('grafo "split-v-triple" gera três painéis', () => {
  const sources = [
    { width: 1920, height: 1080, hasAudio: true, duration: 60 },
    { width: 1920, height: 1080, hasAudio: true, duration: 60 },
    { width: 1920, height: 1080, hasAudio: true, duration: 60 }
  ];
  const result = buildVideoGraph(videoSpec({ output: { layout: 'split-v-triple' }, sources, roles: { panes: [0, 1, 2] } }));
  const graph = result.chains.join(';');
  assert.match(graph, /\[pane2\]/);
  assert.match(graph, /\[2:v\]/);
});

test('legendas entram com caminhos escapados para Windows', () => {
  const result = buildVideoGraph(
    videoSpec({ subtitles: { assPath: 'C:\\Users\\João\\temp\\legenda.ass', fontsDir: 'C:\\Windows\\Fonts' } })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /subtitles='C\\:\/Users\/João\/temp\/legenda\.ass'/);
  assert.match(graph, /fontsdir='C\\:\/Windows\/Fonts'/);
});

test('legendas são ignoradas com aviso quando o FFmpeg não tem libass', () => {
  const result = buildVideoGraph(
    videoSpec({ subtitles: { assPath: '/tmp/a.ass' }, caps: { ...CAPS, hasSubtitles: false, hasAss: false } })
  );
  assert.ok(!result.chains.join(';').includes('subtitles='));
  assert.ok(result.warnings.some((warning) => /libass/i.test(warning)));
});

test('banner de texto gera drawbox (faixa) + drawtext centralizado', () => {
  const result = buildVideoGraph(
    videoSpec({
      bannerText: {
        enabled: true,
        content: 'TITULO',
        textFilePath: 'C:\\temp\\banner.txt',
        position: 'top',
        sizeRatio: 0.05,
        barHeightRatio: 0.085,
        background: true,
        barWidthMode: 'full',
        backgroundColor: '#FF2D55',
        animation: 'none',
        visibleSeconds: 0
      }
    })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /drawbox=x=0:y=0:w=1080:h=\d+:color=0xff2d55:t=fill/);
  assert.match(graph, /drawtext=textfile='C\\:\/temp\/banner\.txt'/);
  assert.match(graph, /x='\(w-text_w\)\/2'/);
});

test('banner em modo "hug" usa box do próprio drawtext', () => {
  const result = buildVideoGraph(
    videoSpec({
      bannerText: {
        enabled: true,
        content: 'TITULO',
        textFilePath: '/tmp/banner.txt',
        barWidthMode: 'hug',
        background: true,
        backgroundColor: '#111111',
        backgroundOpacity: 0.7,
        position: 'bottom',
        animation: 'none'
      }
    })
  );
  const graph = result.chains.join(';');
  assert.ok(!graph.includes('drawbox'));
  assert.match(graph, /box=1:boxcolor=0x111111@0\.700/);
});

test('banner fade usa alpha animado e respeita visibleSeconds', () => {
  const result = buildVideoGraph(
    videoSpec({
      bannerText: {
        enabled: true,
        content: 'OI',
        textFilePath: '/tmp/b.txt',
        animation: 'fade',
        animationDuration: 0.5,
        visibleSeconds: 4,
        background: false
      }
    })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /alpha='if\(lt\(t,4\),min\(t\/0\.5,1\),0\)'/);
  assert.match(graph, /enable='lte\(t,4\)'/);
});

test('banner slide anima a posição da faixa', () => {
  const result = buildVideoGraph(
    videoSpec({
      bannerText: { enabled: true, content: 'OI', textFilePath: '/tmp/b.txt', animation: 'slide', animationDuration: 0.4, barHeightRatio: 0.1, background: true, barWidthMode: 'full' }
    })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /drawbox=x=0:y='0-\(1-min\(t\/0\.4,1\)\)\*\d+'/);
});

test('banner é ignorado com aviso quando falta drawtext ou arquivo de texto', () => {
  const noFreetype = buildVideoGraph(
    videoSpec({ bannerText: { enabled: true, content: 'X', textFilePath: '/tmp/x.txt' }, caps: { ...CAPS, hasDrawtext: false } })
  );
  assert.ok(noFreetype.warnings.some((warning) => /libfreetype|drawtext/i.test(warning)));

  const noFile = buildVideoGraph(videoSpec({ bannerText: { enabled: true, content: 'X' } }));
  assert.ok(noFile.warnings.some((warning) => /caminho do arquivo de texto/i.test(noFile.warnings.join(' '))));
});

test('banner sem conteúdo não gera filtro nenhum', () => {
  const result = buildVideoGraph(videoSpec({ bannerText: { enabled: true, content: '   ', textFilePath: '/tmp/x.txt' } }));
  assert.ok(!result.chains.join(';').includes('drawtext'));
});

test('logo entra como overlay com escala, opacidade e fade', () => {
  const result = buildVideoGraph(
    videoSpec({
      roles: { panes: [0], background: null, logo: 1 },
      logo: { enabled: true, path: '/tmp/logo.png', anchor: 'top-right', widthRatio: 0.2, marginRatio: 0.04, opacity: 0.8, animation: 'fade', animationDuration: 0.5, visibleSeconds: 0, aspect: 0.5 }
    })
  );
  const graph = result.chains.join(';');
  assert.match(graph, /\[1:v\]scale=216:-1:flags=lanczos/);
  assert.match(graph, /colorchannelmixer=aa=0\.80/);
  assert.match(graph, /fade=t=in:st=0:d=0\.5:alpha=1/);
  assert.match(graph, /overlay=\d+:\d+:format=auto/);
});

test('logo visível por tempo limitado ganha enable', () => {
  const result = buildVideoGraph(
    videoSpec({
      roles: { panes: [0], background: null, logo: 1 },
      logo: { enabled: true, path: '/tmp/logo.png', anchor: 'bottom-left', widthRatio: 0.15, visibleSeconds: 3, animation: 'none', aspect: 0.5 }
    })
  );
  assert.match(result.chains.join(';'), /enable='lte\(t,3\)'/);
});

test('logo sem input disponível gera aviso em vez de quebrar', () => {
  const result = buildVideoGraph(videoSpec({ roles: { panes: [0], background: null, logo: null }, logo: { enabled: true, path: '/tmp/logo.png' } }));
  assert.ok(result.warnings.some((warning) => /Logo ignorado/i.test(warning)));
  assert.ok(!result.chains.join(';').includes('logoimg'));
});

test('barra de progresso anima a largura conforme o tempo do clipe', () => {
  const result = buildVideoGraph(videoSpec({ progressBar: { enabled: true, color: '#FFFFFF', heightRatio: 0.006, position: 'top', opacity: 0.9 } }));
  const graph = result.chains.join(';');
  assert.match(graph, /drawbox=x=0:y=0:w='min\(iw,iw\*t\/10\)'/);
  assert.match(graph, /color=0xffffff@0\.900/);
});

test('barra de progresso no rodapé fica na borda inferior', () => {
  const result = buildVideoGraph(videoSpec({ progressBar: { enabled: true, heightRatio: 0.01, position: 'bottom' } }));
  assert.match(result.chains.join(';'), /drawbox=x=0:y=190\d:/);
});

test('ordem das camadas: banner -> legendas -> logo -> progresso', () => {
  const result = buildVideoGraph(
    videoSpec({
      roles: { panes: [0], background: null, logo: 1 },
      subtitles: { assPath: '/tmp/a.ass' },
      bannerText: { enabled: true, content: 'T', textFilePath: '/tmp/b.txt', animation: 'none', background: false },
      logo: { enabled: true, path: '/tmp/l.png', animation: 'none', aspect: 0.5 },
      progressBar: { enabled: true }
    })
  );
  const graph = result.chains.join(';');
  const indexOf = (needle) => graph.indexOf(needle);
  assert.ok(indexOf('drawtext') < indexOf('subtitles='), 'banner vem antes das legendas');
  assert.ok(indexOf('subtitles=') < indexOf('logoimg'), 'legendas vêm antes do logo');
  assert.ok(indexOf('logoimg') < indexOf("w='min(iw,iw*t"), 'logo vem antes da barra de progresso');
});

test('todo grafo termina em [vout] e tem rótulos únicos', () => {
  const result = buildVideoGraph(videoSpec());
  const graph = result.chains.join(';');
  assert.match(graph, /\[vout\]\s*$/);
  const outputs = [...graph.matchAll(/\[([a-z0-9_]+)\](?=;|$)/g)].map((match) => match[1]);
  const duplicated = outputs.filter((name, index) => outputs.indexOf(name) !== index);
  assert.deepEqual(duplicated, [], `rótulos duplicados: ${duplicated.join(', ')}`);
});

test('blurFilter escolhe gblur ou boxblur conforme o build', () => {
  assert.equal(blurFilter({ hasGblur: true }, 20), 'gblur=sigma=20');
  assert.match(blurFilter({ hasGblur: false }, 20), /^boxblur=luma_radius=\d+/);
});

test('alphaExpression devolve null quando não há animação nem limite', () => {
  assert.equal(alphaExpression({ animation: 'none', clipDuration: 10, visibleSeconds: 0 }), null);
  assert.match(alphaExpression({ animation: 'fade', animationDuration: 0.5, clipDuration: 10 }), /min\(t\/0\.5,1\)/);
  assert.match(alphaExpression({ animation: 'none', clipDuration: 10, visibleSeconds: 4 }), /if\(lt\(t,4\),1,0\)/);
});

// ------------------------------------------------------------------ áudio ---
test('áudio: uma fonte -> aresample antes do loudnorm (sem aresample depois)', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'primary', clipDuration: 10, audio: { normalize: true, sampleRate: 48000 }, caps: CAPS });
  const graph = result.chains.join(';');
  assert.match(graph, /\[0:a\]aresample=48000/);
  assert.match(graph, /loudnorm=I=-14:TP=-1:LRA=11/);
  assert.equal(result.label, 'aout');
  assert.equal(result.silent, false);
  // O aresample precisa vir ANTES (bug de "reinitializing filters" em builds antigos).
  assert.ok(graph.indexOf('aresample') < graph.indexOf('loudnorm'));
  assert.equal(graph.split('loudnorm').length - 1, 1);
  assert.ok(!/loudnorm[^;]*,aresample/.test(graph));
});

test('áudio: mix usa volume=N para compensar a normalização do amix', () => {
  const result = buildAudioGraph({ audioInputs: [0, 1], mode: 'mix', clipDuration: 10, audio: { normalize: false }, caps: CAPS });
  const graph = result.chains.join(';');
  assert.match(graph, /amix=inputs=2:duration=first:dropout_transition=0,volume=2/);
  assert.ok(!graph.includes('normalize=0'), 'amix normalize=0 não existe em builds antigos');
});

test('áudio: modo secondary usa a segunda fonte', () => {
  const result = buildAudioGraph({ audioInputs: [0, 1], mode: 'secondary', clipDuration: 10, audio: {}, caps: CAPS });
  assert.match(result.chains.join(';'), /\[1:a\]aresample/);
});

test('áudio: sem entradas devolve silent e nenhum filtro', () => {
  const result = buildAudioGraph({ audioInputs: [], mode: 'primary', clipDuration: 10, audio: {}, caps: CAPS });
  assert.equal(result.label, null);
  assert.equal(result.silent, true);
  assert.deepEqual(result.chains, []);
});

test('áudio: modo none também devolve silent', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'none', clipDuration: 10, audio: {}, caps: CAPS });
  assert.equal(result.silent, true);
});

test('áudio: fades in/out com início correto', () => {
  const result = buildAudioGraph({
    audioInputs: [0],
    mode: 'primary',
    clipDuration: 20,
    audio: { normalize: false, fadeIn: 0.5, fadeOut: 1.5 },
    caps: CAPS
  });
  const graph = result.chains.join(';');
  assert.match(graph, /afade=t=in:st=0:d=0\.5/);
  assert.match(graph, /afade=t=out:st=18\.5:d=1\.5/);
});

test('áudio: normalização desligada não emite loudnorm', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'primary', clipDuration: 10, audio: { normalize: false }, caps: CAPS });
  assert.ok(!result.chains.join(';').includes('loudnorm'));
});

test('áudio: loudnorm ausente no build gera aviso', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'primary', clipDuration: 10, audio: { normalize: true, targetLoudness: -16, truePeak: -2 }, caps: { ...CAPS, hasLoudnorm: false } });
  assert.ok(result.warnings.some((warning) => /loudnorm/i.test(warning)));
});

test('áudio: alvo de loudness personalizado é respeitado', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'primary', clipDuration: 10, audio: { normalize: true, targetLoudness: -16, truePeak: -2 }, caps: CAPS });
  assert.match(result.chains.join(';'), /loudnorm=I=-16:TP=-2:LRA=11/);
});

test('áudio: grafo termina em [aout] com aformat estéreo', () => {
  const result = buildAudioGraph({ audioInputs: [0], mode: 'primary', clipDuration: 10, audio: { normalize: false }, caps: CAPS });
  const graph = result.chains.join(';');
  assert.match(graph, /aformat=sample_fmts=fltp:channel_layouts=stereo\[aout\]$/);
});
