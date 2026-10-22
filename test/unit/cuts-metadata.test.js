/**
 * Testes do algoritmo de cortes virais e da remoção de metadados.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cutPointsFromSpeech,
  energyInRange,
  speechDensity,
  sceneDensity,
  scoreSegment,
  proposeCuts,
  buildFilename,
  overlaps
} = require('../../src/engine/cuts');
const { metadataArgs, inspectMetadata, describeMetadata, sanitizeTagValue } = require('../../src/engine/metadata');

/** Fala sintética: blocos de 4s separados por 0.6s de silêncio. */
function fakeSpeech(duration, blockSeconds = 4, gapSeconds = 0.6) {
  const speech = [];
  let cursor = 0.2;
  while (cursor + blockSeconds < duration) {
    speech.push({ start: cursor, end: cursor + blockSeconds });
    cursor += blockSeconds + gapSeconds;
  }
  return speech;
}

/** Energia sintética em dB com picos periódicos. */
function fakeEnergy(duration, interval = 0.5) {
  const energy = [];
  for (let t = 0; t < duration; t += interval) {
    const peak = Math.floor(t / 10) % 2 === 0;
    energy.push({ time: t, rms: peak ? -22 + Math.sin(t) * 4 : -44 + Math.sin(t) * 2, peak: 0.4 });
  }
  return energy;
}

test('cutPointsFromSpeech coloca os cortes no meio dos silêncios', () => {
  const speech = [
    { start: 0, end: 5 },
    { start: 6, end: 11 },
    { start: 11.2, end: 16 }
  ];
  const points = cutPointsFromSpeech(speech, 20, { minGap: 0.45 });
  assert.equal(points[0], 0);
  assert.equal(points[points.length - 1], 20);
  assert.ok(points.includes(5.5)); // meio do silêncio 5..6
  // Gap de 0.2s é ignorado (menor que o mínimo).
  assert.ok(!points.includes(11.1));
});

test('cutPointsFromSpeech remove duplicatas e mantém ordem', () => {
  const points = cutPointsFromSpeech([{ start: 0, end: 1 }, { start: 5, end: 6 }, { start: 9, end: 10 }], 12);
  assert.deepEqual(points, [...points].sort((a, b) => a - b));
  assert.equal(new Set(points).size, points.length);
});

test('speechDensity mede a fração do trecho com fala', () => {
  assert.equal(speechDensity([{ start: 0, end: 5 }], 0, 10), 0.5);
  assert.equal(speechDensity([{ start: 0, end: 10 }], 0, 10), 1);
  assert.equal(speechDensity([], 0, 10), 0);
  // Fala parcial nas bordas conta só o que está dentro.
  assert.equal(speechDensity([{ start: -5, end: 15 }], 0, 10), 1);
});

test('energyInRange devolve média, pico e variância', () => {
  const energy = [
    { time: 0, rms: -20 },
    { time: 0.5, rms: -30 },
    { time: 1, rms: -40 },
    { time: 5, rms: -90 }
  ];
  const result = energyInRange(energy, 0, 1);
  assert.equal(result.count, 3);
  assert.equal(result.mean, -30);
  assert.equal(result.peak, -20);
  assert.ok(result.variance > 0);
});

test('sceneDensity normaliza para cortes por minuto', () => {
  assert.equal(sceneDensity([1, 2, 3], 0, 60), 3);
  assert.equal(sceneDensity([1, 2, 3], 0, 30), 6);
  assert.equal(sceneDensity([], 0, 60), 0);
});

test('scoreSegment dá nota maior para trecho denso e com gancho', () => {
  const good = scoreSegment({
    start: 0,
    end: 30,
    speech: [{ start: 0, end: 30 }],
    energy: fakeEnergy(30),
    scenes: [5, 12, 20],
    settings: { targetMinSeconds: 15, targetMaxSeconds: 60 }
  });
  const bad = scoreSegment({
    start: 0,
    end: 30,
    speech: [{ start: 0, end: 3 }],
    energy: [{ time: 5, rms: -80 }],
    scenes: [],
    settings: { targetMinSeconds: 15, targetMaxSeconds: 60 }
  });
  assert.ok(good.score > bad.score, `esperado ${good.score} > ${bad.score}`);
  assert.ok(good.score > 0 && good.score <= 100);
  assert.ok(good.reasons.length > 0);
});

test('scoreSegment penaliza duração fora da janela', () => {
  const inside = scoreSegment({ start: 0, end: 30, speech: fakeSpeech(30), energy: fakeEnergy(30), settings: { targetMinSeconds: 15, targetMaxSeconds: 60 } });
  const tooLong = scoreSegment({ start: 0, end: 180, speech: fakeSpeech(180), energy: fakeEnergy(180), settings: { targetMinSeconds: 15, targetMaxSeconds: 60 } });
  assert.ok(inside.metrics.duration === 30);
  assert.ok(tooLong.reasons.some((reason) => /duração/i.test(reason)));
  assert.ok(inside.score >= tooLong.score);
});

test('proposeCuts devolve cortes ordenados, sem sobreposição e dentro do limite', () => {
  const duration = 300;
  const cuts = proposeCuts({
    duration,
    speech: fakeSpeech(duration),
    energy: fakeEnergy(duration),
    scenes: [12, 45, 88, 130, 175, 220, 260],
    settings: { targetMinSeconds: 15, targetMaxSeconds: 60, maxCuts: 6 }
  });
  assert.ok(cuts.length > 0 && cuts.length <= 6);
  for (let index = 1; index < cuts.length; index += 1) {
    assert.ok(cuts[index].start >= cuts[index - 1].end - 0.5, 'cortes não podem se sobrepor');
  }
  for (const cut of cuts) {
    assert.ok(cut.end <= duration + 0.001);
    assert.ok(cut.end > cut.start);
    assert.ok(cut.score >= 0 && cut.score <= 100);
    assert.match(cut.label, /^Corte \d+$/);
    assert.ok(cut.id);
  }
});

test('proposeCuts no modo fixed gera blocos de duração fixa', () => {
  const cuts = proposeCuts({
    duration: 100,
    settings: { mode: 'fixed', targetMaxSeconds: 25, targetMinSeconds: 10, maxCuts: 10 }
  });
  assert.equal(cuts.length, 4);
  assert.equal(cuts[0].start, 0);
  assert.equal(cuts[0].end, 25);
  assert.equal(cuts[3].end, 100);
});

test('proposeCuts no modo scenes usa as mudanças de cena como fronteira', () => {
  const cuts = proposeCuts({
    duration: 120,
    scenes: [30, 70],
    settings: { mode: 'scenes', targetMinSeconds: 15, targetMaxSeconds: 60, maxCuts: 10 }
  });
  assert.ok(cuts.length >= 2);
  const starts = cuts.map((cut) => cut.start);
  assert.ok(starts.includes(0));
  assert.ok(starts.includes(30) || starts.includes(70));
});

test('proposeCuts funciona sem análise nenhuma (grade fixa)', () => {
  const cuts = proposeCuts({ duration: 90, speech: [], energy: [], scenes: [], settings: { targetMinSeconds: 20, targetMaxSeconds: 40 } });
  assert.ok(cuts.length > 0);
  assert.ok(cuts.every((cut) => cut.end <= 90.001));
});

test('proposeCuts respeita minScore', () => {
  const all = proposeCuts({ duration: 200, speech: fakeSpeech(200), energy: fakeEnergy(200), settings: { minScore: 0, maxCuts: 20 } });
  const filtered = proposeCuts({ duration: 200, speech: fakeSpeech(200), energy: fakeEnergy(200), settings: { minScore: 99, maxCuts: 20 } });
  assert.ok(filtered.length <= all.length);
  assert.ok(filtered.every((cut) => cut.score >= 99));
});

test('overlaps detecta interseção com margem', () => {
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 5, end: 15 }), true);
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 }), false);
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 9.8, end: 20 }, 0.5), false);
});

test('buildFilename aplica variáveis e remove caracteres inválidos', () => {
  const name = buildFilename('{title}-{format}-{index}', { title: 'Meu Corte: top!', format: 'vertical', index: 3 });
  assert.equal(name, 'Meu Corte top!-vertical-03');
  assert.equal(buildFilename('{score}', { score: 87.4 }), '87');
  // Padrão vazio cai no default (nunca gera nome em branco).
  assert.equal(buildFilename('', {}), 'corte-vertical-01');
  assert.equal(buildFilename('{desconhecida}-{index}', { index: 1 }), '{desconhecida}-01');
});

test('metadataArgs remove tudo por padrão (global, streams, capítulos e encoder)', () => {
  const args = metadataArgs({});
  assert.deepEqual(args.slice(0, 2), ['-map_metadata', '-1']);
  assert.ok(args.includes('-map_metadata:s:v'));
  assert.ok(args.includes('-map_metadata:s:a'));
  assert.ok(args.includes('-map_chapters'));
  assert.ok(args.includes('+bitexact'));
  assert.ok(args.includes('-flags:v'));
  assert.ok(args.includes('-flags:a'));
  assert.ok(!args.includes('-metadata'));
});

test('metadataArgs pode manter só o título limpo', () => {
  const args = metadataArgs({ keepOnlyCleanTitle: true, title: 'Corte 01 — meu vídeo' });
  const index = args.indexOf('-metadata');
  assert.ok(index !== -1);
  assert.equal(args[index + 1], 'title=Corte 01 — meu vídeo');
});

test('metadataArgs não remove nada quando desligado', () => {
  assert.deepEqual(metadataArgs({ stripMetadata: false }), []);
});

test('sanitizeTagValue corta caracteres de controle e limita tamanho', () => {
  assert.equal(sanitizeTagValue('linha1\nlinha2\ttab'), 'linha1 linha2 tab');
  assert.equal(sanitizeTagValue('x'.repeat(300)).length, 120);
});

test('inspectMetadata detecta arquivo limpo', () => {
  const report = inspectMetadata({ format: { tags: {} }, streams: [{ index: 0, codec_type: 'video', tags: {} }], chapters: [] });
  assert.equal(report.clean, true);
  assert.equal(report.totalTags, 0);
  assert.match(describeMetadata(report), /Limpo/);
});

test('inspectMetadata aponta tags sensíveis (encoder, GPS, autor)', () => {
  const report = inspectMetadata({
    format: { tags: { encoder: 'Lavf58', creation_time: '2019-01-02', comment: 'baixado de tal site' } },
    streams: [{ index: 0, codec_type: 'video', tags: { handler_name: 'VideoHandle' } }],
    chapters: [{ id: 0 }, { id: 1 }]
  });
  assert.equal(report.clean, false);
  assert.equal(report.totalTags, 4);
  // handler_name "VideoHandle" é default do muxer -> estrutural, não conta.
  assert.equal(report.metadataTags, 3);
  assert.equal(report.chapters, 2);
  assert.ok(report.riskItems.some((item) => /encoder/.test(item)));
  assert.ok(report.riskItems.some((item) => /creation_time/.test(item)));
  assert.ok(report.riskItems.some((item) => /comment/.test(item)));
  assert.match(describeMetadata(report), /3 tag\(s\) de metadados/);
  assert.match(describeMetadata(report), /2 capítulo\(s\)/);
});

test('inspectMetadata considera limpo o arquivo que só tem tags estruturais do MP4', () => {
  // É exatamente o que sobra depois de -map_metadata -1 + bitexact: campos de
  // box obrigatórios e defaults do muxer. Nada disso identifica o vídeo original.
  const report = inspectMetadata({
    format: { tags: { major_brand: 'isom', minor_version: '512', compatible_brands: 'isomiso2avc1mp41' } },
    streams: [
      { index: 0, codec_type: 'video', tags: { language: 'und', handler_name: 'VideoHandler', vendor_id: '[0][0][0][0]' } },
      { index: 1, codec_type: 'audio', tags: { language: 'und', handler_name: 'SoundHandler', vendor_id: '[0][0][0][0]' } }
    ],
    chapters: []
  });
  assert.equal(report.totalTags, 9);
  assert.equal(report.metadataTags, 0);
  assert.equal(report.riskItems.length, 0);
  assert.equal(report.clean, true, 'arquivo reencodado sem metadados deve ser reportado como limpo');
  assert.equal(report.structuralTags.length, 9);
  assert.match(describeMetadata(report), /Limpo/);
  assert.match(describeMetadata(report), /campos técnicos obrigatórios/);
});

test('inspectMetadata continua sinalizando handler_name e vendor_id fora do padrão', () => {
  const report = inspectMetadata({
    format: { tags: { 'com.apple.quicktime.make': 'Apple', 'com.apple.quicktime.model': 'iPhone 15' } },
    streams: [
      { index: 0, codec_type: 'video', tags: { handler_name: 'Core Media Data Handler', language: 'eng' } }
    ],
    chapters: []
  });
  assert.equal(report.clean, false);
  // language é propriedade do stream (ISO-639), não metadado de autor: não conta.
  assert.equal(report.metadataTags, 3, 'duas tags Apple + handler_name customizado');
  assert.ok(report.riskItems.some((item) => /quicktime\.make/.test(item)), 'marca do dispositivo é rastreável');
  assert.ok(report.riskItems.some((item) => /handler_name/.test(item)));
});

test('inspectMetadata trata vendor_id real como risco, mas ignora o vazio', () => {
  const riscado = inspectMetadata({
    format: { tags: {} },
    streams: [{ index: 0, codec_type: 'video', tags: { vendor_id: 'appl' } }],
    chapters: []
  });
  assert.equal(riscado.clean, false);
  assert.equal(riscado.metadataTags, 1);
  assert.ok(riscado.riskItems.some((item) => /vendor_id="appl"/.test(item)));

  const neutro = inspectMetadata({
    format: { tags: {} },
    streams: [{ index: 0, codec_type: 'video', tags: { vendor_id: '[0][0][0][0]' } }],
    chapters: []
  });
  assert.equal(neutro.clean, true);
  assert.equal(neutro.metadataTags, 0);
});
