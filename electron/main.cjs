const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const license = require("./license.cjs");

// Usa a aceleração de hardware do Windows (GPU) para renderizar as retículas 1:1.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
// Funciona 100% offline: todo o conteúdo é servido do disco local.
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");


const ROOT = path.join(__dirname, "..", "app");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

let mainWindow = null;
let activationWindow = null;
let splashWindow = null;

const APP_ICON = path.join(__dirname, "assets", "icon.ico");

function showSplash() {
  splashWindow = new BrowserWindow({
    width: 760,
    height: 428,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: "#05070c",
    icon: APP_ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.once("ready-to-show", () => splashWindow && splashWindow.show());
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function closeSplash() {
  if (splashWindow) {
    const w = splashWindow;
    splashWindow = null;
    w.destroy();
  }
}


function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
      urlPath = urlPath.replace(/^\/dtflex-tool/, "");
      if (urlPath === "" || urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function openActivation(message) {
  if (activationWindow) return activationWindow.focus();
  activationWindow = new BrowserWindow({
    width: 460,
    height: 600,
    resizable: false,
    backgroundColor: "#0e1116",
    autoHideMenuBar: true,
    icon: APP_ICON,
    title: "Ativação — DTFLEXPRO Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  const query = message ? `?msg=${encodeURIComponent(message)}` : "";
  activationWindow.loadURL(
    `file://${path.join(__dirname, "activation.html").replace(/\\/g, "/")}${query}`,
  );
  activationWindow.once("ready-to-show", closeSplash);
  activationWindow.on("closed", () => {
    activationWindow = null;
    if (!mainWindow) app.quit();
  });
}

// Barra de licença dentro do software: validade + botão "Verificar atualização".
function injectLicenseBar(win) {
  const lic = license.load(app);
  const info = {
    email: (lic && lic.email) || "",
    plan: (lic && lic.plan) || "",
    expiresAt: (lic && lic.expiresAt) || null,
    daysLeft: license.daysLeft(lic),
    daysToRecheck: license.daysToRecheck(lic),
  };
  const js = `(() => {
    const info = ${JSON.stringify(info)};
    const old = document.getElementById("dtflex-license-bar");
    if (old) old.remove();
    const bar = document.createElement("div");
    bar.id = "dtflex-license-bar";
    bar.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:10px;background:#151a22;border:1px solid #253044;border-radius:12px;padding:8px 12px;font:12px system-ui,sans-serif;color:#cbd5e1;box-shadow:0 10px 30px rgba(0,0,0,.45)";
    const txt = document.createElement("span");
    const d = new Date(info.expiresAt || Date.now());
    txt.textContent = "Plano " + (info.plan || "ativo") + " · expira " + d.toLocaleDateString("pt-BR") + " (" + info.daysLeft + " dias)";
    const btn = document.createElement("button");
    btn.textContent = "Verificar atualização";
    btn.style.cssText = "border:0;border-radius:8px;padding:6px 10px;background:#22c55e;color:#04240f;font-weight:800;cursor:pointer";
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "Verificando...";
      const r = await window.dtflex.check();
      btn.disabled = false; btn.textContent = "Verificar atualização";
      if (r && r.ok) {
        const nd = new Date(r.expiresAt);
        txt.textContent = "Plano " + (r.plan || info.plan || "ativo") + " · expira " + nd.toLocaleDateString("pt-BR") + " (" + r.daysLeft + " dias)";
        alert(r.online ? "Licença revalidada com o servidor." : "Sem internet: usando a licença salva neste computador.");
      } else if (r) {
        alert(r.error || "Não foi possível verificar a licença.");
      }
    };
    bar.appendChild(txt); bar.appendChild(btn);
    document.body.appendChild(bar);
  })();`;
  win.webContents.executeJavaScript(js).catch(() => {});
}

async function openStudio() {
  if (mainWindow) return mainWindow.focus();
  const port = await startServer();
  // Adapta-se automaticamente a qualquer tela/resolução do Windows.
  const { screen } = require("electron");
  const work = screen.getPrimaryDisplay().workAreaSize;
  const winW = Math.max(1024, Math.min(1440, Math.round(work.width * 0.92)));
  const winH = Math.max(680, Math.min(950, Math.round(work.height * 0.92)));
  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: Math.min(1024, work.width),
    minHeight: Math.min(660, work.height),
    center: true,
    backgroundColor: "#0e1116",
    autoHideMenuBar: true,
    icon: APP_ICON,
    title: "DTFLEXPRO — Halftone Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => {
    closeSplash();
    if (work.width <= 1400 || work.height <= 800) mainWindow.maximize();
  });
  mainWindow.webContents.on("did-finish-load", () => {
    injectLicenseBar(mainWindow);
    enableWindowsZoom(mainWindow);
    // Escala inicial 75% — melhor leitura das retículas no monitor.
    mainWindow.webContents.setZoomFactor(0.75);

  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
}

// Zoom nativo estilo Windows (Ctrl + roda, Ctrl +/-, Ctrl+0) — só no software desktop.
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

function showZoomBadge(win, factor) {
  const pct = Math.round(factor * 100);
  win.webContents
    .executeJavaScript(
      `(() => {
        let el = document.getElementById("dtflex-zoom-badge");
        if (!el) {
          el = document.createElement("div");
          el.id = "dtflex-zoom-badge";
          el.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#facc15;border:1px solid #374151;border-radius:10px;padding:6px 14px;font:800 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none";
          document.body.appendChild(el);
        }
        el.textContent = "Zoom ${pct}%";
        el.style.opacity = "1";
        clearTimeout(window.__dtflexZoomT);
        window.__dtflexZoomT = setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; }, 900);
      })();`,
    )
    .catch(() => {});
}

function setZoom(win, factor) {
  const f = Math.min(5, Math.max(0.25, factor));
  win.webContents.setZoomFactor(f);
  showZoomBadge(win, f);
}

function stepZoom(win, dir) {
  const cur = win.webContents.getZoomFactor();
  let idx = 0;
  let best = Infinity;
  ZOOM_STEPS.forEach((s, i) => {
    const d = Math.abs(s - cur);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + dir))];
  setZoom(win, next);
}

function enableWindowsZoom(win) {
  if (!win || win.__dtflexZoom) return;
  win.__dtflexZoom = true;
  const wc = win.webContents;
  wc.setVisualZoomLevelLimits(1, 5).catch(() => {});
  wc.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !input.control) return;
    const k = (input.key || "").toLowerCase();
    if (k === "+" || k === "=" || k === "add") {
      event.preventDefault();
      stepZoom(win, 1);
    } else if (k === "-" || k === "_" || k === "subtract") {
      event.preventDefault();
      stepZoom(win, -1);
    } else if (k === "0") {
      event.preventDefault();
      setZoom(win, 1);
    }
  });
  wc.on("zoom-changed", (event, direction) => {
    event.preventDefault();
    stepZoom(win, direction === "in" ? 1 : -1);
  });
}



// Checagem periódica: expiração do plano ou revalidação online vencida fecham o estúdio.
function watchLicense() {
  setInterval(async () => {
    const lic = license.load(app);
    if (!license.isValid(lic)) return lockOut("Plano expirado. Ative novamente para continuar.");
    if (license.needsOnlineCheck(lic)) {
      const res = await license.revalidate(app, lic);
      if (!res.ok) lockOut(res.error);
      else if (mainWindow) injectLicenseBar(mainWindow);
    }
  }, 30 * 60 * 1000);
}

function lockOut(message) {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  openActivation(message);
}

ipcMain.handle("license:activate", async (_e, { email, code }) => {
  try {
    const data = await license.activate(email, code);
    license.save(app, { ...data, code });
    if (activationWindow) {
      const w = activationWindow;
      activationWindow = null;
      w.destroy();
    }
    await openStudio();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("license:status", async () => {
  const lic = license.load(app);
  if (!lic) return { ok: false };
  return {
    ok: license.isValid(lic),
    email: lic.email,
    plan: lic.plan,
    expiresAt: lic.expiresAt,
    daysLeft: license.daysLeft(lic),
    daysToRecheck: license.daysToRecheck(lic),
  };
});

ipcMain.handle("license:check", async () => {
  const lic = license.load(app);
  if (!lic) return { ok: false, error: "Software não ativado neste computador." };
  const res = await license.revalidate(app, lic);
  if (!res.ok) {
    lockOut(res.error);
    return { ok: false, error: res.error };
  }
  const fresh = license.load(app);
  if (!license.isValid(fresh)) {
    lockOut("Plano expirado. Ative novamente para continuar.");
    return { ok: false, error: "Plano expirado." };
  }
  return {
    ok: true,
    online: !res.offline,
    plan: fresh.plan,
    expiresAt: fresh.expiresAt,
    daysLeft: license.daysLeft(fresh),
  };
});

async function boot() {
  showSplash();
  await new Promise((r) => setTimeout(r, 2200));
  const lic = license.load(app);
  if (license.isValid(lic)) {
    // Já ativado: usa offline; só exige internet quando a janela de revalidação vence.
    if (!license.needsOnlineCheck(lic)) {
      license.save(app, { ...lic, lastSeen: Date.now() });
      await openStudio();
      watchLicense();
      return;
    }
    const res = await license.revalidate(app, lic);
    if (res.ok) {
      await openStudio();
      watchLicense();
      return;
    }
    closeSplash();
    dialog.showErrorBox("Licença", res.error || "Renove seu plano para continuar.");
    openActivation(res.error);
    watchLicense();
    return;
  }
  openActivation(
    lic ? "Seu plano expirou. Informe um código de ativação válido para continuar." : null,
  );
  watchLicense();
}

// Instância única: evita múltiplas cópias burlando a checagem de licença.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) mainWindow.focus();
    else if (activationWindow) activationWindow.focus();
  });
  app.whenReady().then(boot);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});
