const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Salt embutido (ofuscado) — dificulta edição manual do arquivo de licença.
const SALT = Buffer.from("ZHRmbGV4cHJvLWRlc2t0b3AtbGljZW5zZS12MQ==", "base64").toString();
const API_BASE = "https://dtflexpro.com";

const DAY = 24 * 3600 * 1000;
// Planos anuais: exige revalidação online a cada 2 meses. Mensais: a cada 15 dias.
const RECHECK_DAYS = { anual: 60, mensal: 15, teste: 3 };

function recheckWindow(plan) {
  return (RECHECK_DAYS[String(plan || "").toLowerCase()] || 30) * DAY;
}

function deviceId() {
  const nets = os.networkInterfaces();
  let mac = "";
  Object.keys(nets).forEach((k) => {
    (nets[k] || []).forEach((n) => {
      if (!n.internal && n.mac && n.mac !== "00:00:00:00:00:00" && !mac) mac = n.mac;
    });
  });
  const raw = [os.hostname(), os.platform(), os.arch(), os.userInfo().username, mac].join("|");
  return crypto.createHash("sha256").update(SALT + raw).digest("hex").slice(0, 64);
}

function key() {
  return crypto.createHash("sha256").update(SALT + deviceId()).digest();
}

function licensePath(app) {
  return path.join(app.getPath("userData"), "license.bin");
}

function save(app, data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), enc]);
  fs.mkdirSync(path.dirname(licensePath(app)), { recursive: true });
  fs.writeFileSync(licensePath(app), payload);
}

function load(app) {
  try {
    const buf = fs.readFileSync(licensePath(app));
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
  } catch (_) {
    return null;
  }
}

function clear(app) {
  try {
    fs.unlinkSync(licensePath(app));
  } catch (_) {}
}

// Relógio anti-retrocesso: se a data do sistema voltar no tempo, invalida.
function isValid(lic) {
  if (!lic || !lic.expiresAt || !lic.signature) return false;
  if (lic.deviceId !== deviceId()) return false;
  const now = Date.now();
  if (lic.lastSeen && now < lic.lastSeen - 6 * 3600 * 1000) return false;
  return new Date(lic.expiresAt).getTime() > now;
}

/** Dias restantes até a expiração do plano. */
function daysLeft(lic) {
  if (!lic || !lic.expiresAt) return 0;
  return Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / DAY);
}

/** Verdadeiro quando o software já pode rodar offline sem nova checagem online. */
function needsOnlineCheck(lic) {
  if (!lic) return true;
  const last = lic.lastCheck || lic.activatedAt || 0;
  return Date.now() - last > recheckWindow(lic.plan);
}

/** Dias até a próxima verificação online obrigatória. */
function daysToRecheck(lic) {
  if (!lic) return 0;
  const last = lic.lastCheck || lic.activatedAt || 0;
  return Math.ceil((last + recheckWindow(lic.plan) - Date.now()) / DAY);
}

async function activate(email, code) {
  const res = await fetch(`${API_BASE}/api/public/desktop-activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, deviceId: deviceId() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Não foi possível ativar. Verifique o código.");
  }
  const now = Date.now();
  return { ...data, lastSeen: now, lastCheck: now, activatedAt: now };
}

/**
 * Revalidação online. Se o servidor responder, atualiza a validade salva.
 * Sem internet: mantém a licença apenas se ainda estiver dentro da janela offline.
 */
async function revalidate(app, lic) {
  try {
    const fresh = await activate(lic.email, lic.code);
    save(app, { ...fresh, code: lic.code, activatedAt: lic.activatedAt || fresh.activatedAt });
    return { ok: true, online: true, expiresAt: fresh.expiresAt };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg.match(/expirad|bloquead|inválid/i)) {
      clear(app);
      return { ok: false, error: msg };
    }
    // Offline: só continua dentro da validade e da janela de revalidação.
    if (needsOnlineCheck(lic)) {
      return {
        ok: false,
        offline: true,
        error:
          "Verificação de licença pendente. Conecte-se à internet para revalidar seu plano e continuar usando o software.",
      };
    }
    save(app, { ...lic, lastSeen: Date.now() });
    return { ok: true, offline: true, expiresAt: lic.expiresAt };
  }
}

module.exports = {
  deviceId,
  save,
  load,
  clear,
  isValid,
  activate,
  revalidate,
  needsOnlineCheck,
  daysLeft,
  daysToRecheck,
};
