/**
 * URLs do protocolo interno `vcs-media://`.
 *
 * O renderer roda com `contextIsolation` e `webSecurity` ligados, então não
 * recebe acesso direto ao disco. Em vez de liberar `file://` (que exporia o
 * sistema inteiro), registramos um protocolo próprio que só serve arquivos
 * dentro dos diretórios permitidos pelo processo principal.
 *
 * Formato: vcs-media://file/<base64url do caminho absoluto>
 */

const PROTOCOL = 'vcs-media';

/** Codifica um caminho absoluto em URL do protocolo interno. */
function toMediaUrl(absolutePath) {
  if (!absolutePath) return '';
  const encoded = Buffer.from(String(absolutePath), 'utf8').toString('base64url');
  return `${PROTOCOL}://file/${encoded}`;
}

/** Decodifica uma URL do protocolo interno de volta para o caminho. */
function fromMediaUrl(url) {
  const text = String(url || '');
  const prefix = `${PROTOCOL}://file/`;
  if (!text.startsWith(prefix)) return null;
  try {
    return Buffer.from(text.slice(prefix.length), 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { PROTOCOL, toMediaUrl, fromMediaUrl };
