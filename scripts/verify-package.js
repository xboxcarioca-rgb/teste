#!/usr/bin/env node
/**
 * Verifica se o app está pronto para empacotar — e, se o build já existir,
 * confere que ele veio completo.
 *
 * Uso:
 *   node scripts/verify-package.js            # checa pré-requisitos + dist/win-unpacked (se existir)
 *   node scripts/verify-package.js --strict   # falha também se o build ainda não existir
 *
 * Checa:
 *   • package.json (main existe, deps de runtime declaradas, sem cross-env fantasma);
 *   • electron-builder.yml (ícone existe, targets win presentes, asarUnpack cobre os binários);
 *   • binários do FFmpeg/FFprobe disponíveis para a plataforma atual (para testes);
 *   • build já produzido (dist/win-unpacked): launcher .exe, app.asar e, fora do asar,
 *     ffmpeg.exe/ffprobe.exe win32-x64 — sem isso o instalador nasce quebrado.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');

const problems = [];
const notes = [];

function check(ok, message) {
  if (ok) {
    notes.push(`  ✓ ${message}`);
  } else {
    problems.push(message);
  }
  return ok;
}

// ------------------------------------------------------------- package.json

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

check(typeof pkg.main === 'string' && fs.existsSync(path.join(ROOT, pkg.main)), `package.json: "main" resolve (${pkg.main})`);
check(Boolean(pkg.version), 'package.json: tem version');
check(pkg.dependencies && pkg.dependencies['@ffmpeg-installer/ffmpeg'], 'package.json: @ffmpeg-installer/ffmpeg declarado (o FFmpeg vem por npm, não por download)');
check(pkg.dependencies && pkg.dependencies['@ffprobe-installer/ffprobe'], 'package.json: @ffprobe-installer/ffprobe declarado');
check(pkg.devDependencies && pkg.devDependencies.electron, 'package.json: electron em devDependencies');
check(pkg.devDependencies && pkg.devDependencies['electron-builder'], 'package.json: electron-builder em devDependencies');

// Scripts não podem depender de pacotes que não estão declarados.
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  for (const m of String(command).matchAll(/([a-z@][\w@/.-]*)\s/g)) {
    const bin = m[1];
    if (['electron', 'node', 'npm', 'npx'].includes(bin)) continue;
    if (!bin.includes('-')) continue; // só binários de pacotes com hífen (electron-builder)
    const owner = bin.startsWith('@') ? bin.split('/').slice(0, 2).join('/') : bin;
    const declared = (pkg.dependencies && pkg.dependencies[owner]) || (pkg.devDependencies && pkg.devDependencies[owner]);
    check(Boolean(declared), `package.json: script "${name}" usa "${bin}", que precisa estar declarado`);
  }
}

// -------------------------------------------------------- electron-builder.yml

const builderPath = path.join(ROOT, 'electron-builder.yml');
check(fs.existsSync(builderPath), 'electron-builder.yml existe');

if (fs.existsSync(builderPath)) {
  const yml = fs.readFileSync(builderPath, 'utf8');

  const iconMatch = /icon:\s*(\S+)/.exec(yml);
  check(iconMatch && fs.existsSync(path.join(ROOT, iconMatch[1])), `electron-builder.yml: ícone existe (${iconMatch ? iconMatch[1] : 'não declarado'})`);
  check(/target:\s*\n?\s*-\s*target:\s*nsis/.test(yml) || /nsis/.test(yml), 'electron-builder.yml: target nsis (instalador .exe) configurado');
  check(/portable/.test(yml), 'electron-builder.yml: target portable configurado');
  check(/asarUnpack:/.test(yml) && /@ffmpeg-installer/.test(yml), 'electron-builder.yml: @ffmpeg-installer fora do asar (binário precisa ser executável)');
  check(/@ffprobe-installer/.test(yml), 'electron-builder.yml: @ffprobe-installer fora do asar');
  // publish: null evita upload automático acidental para o GitHub Releases.
  check(/publish:\s*null/.test(yml), 'electron-builder.yml: publish desligado (o CI faz o upload de forma explícita)');
}

// Ícones precisam existir (o electron-builder falha tarde e com mensagem ruim).
check(fs.existsSync(path.join(ROOT, 'build', 'icon.ico')), 'build/icon.ico existe (obrigatório no Windows)');
check(fs.existsSync(path.join(ROOT, 'assets', 'icon.png')), 'assets/icon.png existe');

// ------------------------------------------------------- binários da plataforma

/** Resolve o binário de FFmpeg que os testes usariam nesta plataforma. */
function platformBinary(pkgName) {
  try {
    const installer = require(path.join(ROOT, 'node_modules', pkgName));
    return installer.path || null;
  } catch {
    return null;
  }
}

const ffmpegPath = platformBinary('@ffmpeg-installer/ffmpeg');
const ffprobePath = platformBinary('@ffprobe-installer/ffprobe');
check(ffmpegPath && fs.existsSync(ffmpegPath), `binário de FFmpeg da plataforma atual disponível (${ffmpegPath || 'não instalado — rode npm ci'})`);
check(ffprobePath && fs.existsSync(ffprobePath), `binário de FFprobe da plataforma atual disponível (${ffprobePath || 'não instalado'})`);

// ------------------------------------------------------------------ o build

const unpackedDir = path.join(ROOT, 'dist', 'win-unpacked');
const hasBuild = fs.existsSync(unpackedDir);

if (hasBuild) {
  const contents = fs.readdirSync(unpackedDir);
  const launcher = contents.find((name) => name.endsWith('.exe'));
  check(Boolean(launcher), `dist/win-unpacked: launcher .exe presente (${launcher || 'não encontrado'})`);
  check(fs.existsSync(path.join(unpackedDir, 'resources', 'app.asar')), 'dist/win-unpacked: resources/app.asar presente');

  const unpacked = path.join(unpackedDir, 'resources', 'app.asar.unpacked', 'node_modules');
  const ffmpegExe = path.join(unpacked, '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
  const ffprobeExe = path.join(unpacked, '@ffprobe-installer', 'win32-x64', 'ffprobe.exe');
  check(fs.existsSync(ffmpegExe), 'dist/win-unpacked: ffmpeg.exe win32-x64 fora do asar (sem isso o render não roda no Windows)');
  check(fs.existsSync(ffprobeExe), 'dist/win-unpacked: ffprobe.exe win32-x64 fora do asar');

  const installers = fs.existsSync(path.join(ROOT, 'dist'))
    ? fs.readdirSync(path.join(ROOT, 'dist')).filter((name) => name.endsWith('.exe'))
    : [];
  if (installers.length) notes.push(`  ✓ dist/: instalador(es) ${installers.join(', ')}`);
} else if (strict) {
  problems.push('dist/win-unpacked não existe (rode npm run dist:win ou o workflow do CI)');
} else {
  notes.push('  · dist/win-unpacked ainda não existe — verificando apenas pré-requisitos');
}

// -------------------------------------------------------------------- saída

console.log('Verificação do pacote\n');
for (const note of notes) console.log(note);

if (problems.length) {
  console.log(`\n${problems.length} problema(s):`);
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  process.exit(1);
}

console.log('\n✓ tudo certo para empacotar');
