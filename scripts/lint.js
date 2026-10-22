#!/usr/bin/env node
/**
 * Lint sem dependências externas.
 *
 * Não substitui ESLint: cobre as classes de erro que realmente derrubam este
 * app em runtime e que um verificador de sintaxe não pega —
 *
 *   1. sintaxe de todos os .js (src, test, scripts);
 *   2. caracteres CJK/ideogramas que vazam de modelos e quebram o pt-BR;
 *   3. contrato de IDs do renderer: todo `$('#id')` precisa existir no
 *      index.html ou ser criado dinamicamente por `el(..., { id: '...' })`;
 *   4. uso indevido de `window.$` (o helper vive em `window.U`);
 *   5. contrato de IPC: todo `IPC.X` referenciado precisa existir em
 *      src/common/ipc.js, sem valores duplicados, e todo canal que o preload
 *      invoca precisa ter alguém do lado main;
 *   6. resolução de `require` relativo e do `main` do package.json.
 *
 * Saída: lista de problemas e exit code 1 se houver erro.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

/** Percorre diretórios coletando arquivos .js (ignora node_modules e dist). */
function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'build', 'out'].includes(entry.name)) continue;
      walkJs(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

// ---------------------------------------------------------------- 1. sintaxe

const jsFiles = [
  ...walkJs(path.join(ROOT, 'src')),
  ...walkJs(path.join(ROOT, 'test')),
  ...walkJs(path.join(ROOT, 'scripts'))
];

for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: rel(file) });
  } catch (error) {
    errors.push(`sintaxe: ${rel(file)} → ${error.message}`);
  }
}

// ------------------------------------------------- 2. caracteres não-pt-BR (CJK)

// Ideogramas CJK, hiragana/katakana, hangul e símbolos CJK: nunca deveriam
// aparecer numa interface em português (vazam de respostas de modelo).
const CJK = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

for (const file of jsFiles) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const match = CJK.exec(line);
    if (match) {
      errors.push(`caractere CJK: ${rel(file)}:${index + 1} → "${match[0]}" em ${line.trim().slice(0, 60)}`);
    }
  });
}

for (const extra of ['src/renderer/index.html', 'src/renderer/styles.css', 'README.md']) {
  const file = path.join(ROOT, extra);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const match = CJK.exec(line);
    if (match) errors.push(`caractere CJK: ${extra}:${index + 1} → "${match[0]}"`);
  });
}

// --------------------------------------------------- 3/4. contrato do renderer

const rendererDir = path.join(ROOT, 'src', 'renderer');
const htmlPath = path.join(rendererDir, 'index.html');

if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const staticIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  const rendererFiles = walkJs(path.join(rendererDir, 'js'));
  const dynamicIds = new Set();

  for (const file of rendererFiles) {
    const code = fs.readFileSync(file, 'utf8');
    // IDs criados em runtime: el('tag', { id: 'x' }) / { id: 'x' } / .id = 'x'
    for (const m of code.matchAll(/\bid:\s*['"`]([\w-]+)['"`]/g)) dynamicIds.add(m[1]);
    for (const m of code.matchAll(/\.id\s*=\s*['"`]([\w-]+)['"`]/g)) dynamicIds.add(m[1]);
    for (const m of code.matchAll(/id=["']([\w-]+)["']/g)) dynamicIds.add(m[1]);
  }

  for (const file of rendererFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');

    // 4. window.$ / window.$$ não existem — os helpers estão em window.U.
    lines.forEach((line, index) => {
      if (/window\.\$\$?\s*\(/.test(line)) {
        errors.push(`renderer: ${rel(file)}:${index + 1} usa window.$ (o helper é window.U.$)`);
      }
    });

    // 3. todo seletor #id precisa existir.
    for (const m of code.matchAll(/\$\$?\(\s*['"`]#([\w-]+)/g)) {
      const id = m[1];
      if (!staticIds.has(id) && !dynamicIds.has(id)) {
        errors.push(`renderer: ${rel(file)} referencia #${id}, que não existe no index.html nem é criado em runtime`);
      }
    }
  }

  // Helpers de window.U usados pelos painéis precisam existir em util.js.
  const utilPath = path.join(rendererDir, 'js', 'util.js');
  if (fs.existsSync(utilPath)) {
    const utilCode = fs.readFileSync(utilPath, 'utf8');
    const exportBlock = /window\.U\s*=\s*\{([\s\S]*?)\};/.exec(utilCode);
    const exported = new Set((exportBlock ? exportBlock[1] : '').split(',').map((s) => s.trim()).filter(Boolean));

    for (const file of rendererFiles) {
      if (path.basename(file) === 'util.js') continue;
      const code = fs.readFileSync(file, 'utf8');
      const m = /const\s*\{([^}]+)\}\s*=\s*window\.U/.exec(code);
      if (!m) continue;
      for (const raw of m[1].split(',')) {
        const name = raw.split(':').shift().trim();
        if (name && !exported.has(name)) {
          errors.push(`renderer: ${rel(file)} desestrutura "${name}" de window.U, mas util.js não o exporta`);
        }
      }
    }
  }
}

// -------------------------------------------------------- 5. contrato de IPC

const ipcModulePath = path.join(ROOT, 'src', 'common', 'ipc.js');
if (fs.existsSync(ipcModulePath)) {
  const { IPC } = require(ipcModulePath);
  const keys = Object.keys(IPC);
  const keySet = new Set(keys);

  // Valores duplicados fariam dois recursos diferentes colidirem no mesmo canal.
  const byValue = new Map();
  for (const key of keys) {
    const value = IPC[key];
    if (byValue.has(value)) {
      errors.push(`IPC: ${key} e ${byValue.get(value)} usam o mesmo canal "${value}"`);
    }
    byValue.set(value, key);
  }

  // Toda referência IPC.<CANAL> precisa existir.
  // (Este próprio arquivo é pulado: o docstring dele cita o padrão em texto.)
  for (const file of jsFiles) {
    if (path.resolve(file) === path.resolve(ipcModulePath)) continue;
    if (path.resolve(file) === path.resolve(__filename)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      for (const m of line.matchAll(/\bIPC\.([A-Z0-9_]+)/g)) {
        if (!keySet.has(m[1])) {
          errors.push(`IPC: ${rel(file)}:${index + 1} referencia IPC.${m[1]}, que não existe em src/common/ipc.js`);
        }
      }
    });
  }

  // Todo canal que o preload expõe precisa ter implementação no main.
  const preloadPath = path.join(ROOT, 'src', 'preload', 'index.js');
  const mainDir = path.join(ROOT, 'src', 'main');
  if (fs.existsSync(preloadPath) && fs.existsSync(mainDir)) {
    const preloadKeys = new Set([...fs.readFileSync(preloadPath, 'utf8').matchAll(/\bIPC\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    const mainCode = walkJs(mainDir).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const mainKeys = new Set([...mainCode.matchAll(/\bIPC\.([A-Z0-9_]+)/g)].map((m) => m[1]));

    for (const key of preloadKeys) {
      if (!mainKeys.has(key)) {
        warnings.push(`IPC: preload expõe ${key}, mas nenhum arquivo de src/main/ o usa (canal pode ficar sem handler)`);
      }
    }
  }
}

// -------------------------------------------------- 6. resolução de requires

for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    for (const m of line.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const target = path.resolve(path.dirname(file), m[1]);
      const candidates = [target, `${target}.js`, `${target}.json`, path.join(target, 'index.js')];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        errors.push(`require: ${rel(file)}:${index + 1} → "${m[1]}" não resolve`);
      }
    }
  });
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (!fs.existsSync(path.join(ROOT, pkg.main))) {
  errors.push(`package.json: "main" aponta para ${pkg.main}, que não existe`);
}

// Scripts declarados precisam existir no disco.
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  for (const m of String(command).matchAll(/node\s+(scripts\/[\w.-]+)/g)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) {
      errors.push(`package.json: script "${name}" chama ${m[1]}, que não existe`);
    }
  }
}

// -------------------------------------------------------------------- saída

console.log(`Lint: ${jsFiles.length} arquivos .js verificados`);

if (warnings.length) {
  console.log(`\n${warnings.length} aviso(s):`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (errors.length) {
  console.log(`\n${errors.length} erro(s):`);
  for (const error of errors) console.log(`  ✗ ${error}`);
  process.exit(1);
}

console.log('✓ nenhum problema encontrado');
