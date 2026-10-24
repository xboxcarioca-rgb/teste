const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dtflex", {
  activate: (email, code) => ipcRenderer.invoke("license:activate", { email, code }),
  status: () => ipcRenderer.invoke("license:status"),
  check: () => ipcRenderer.invoke("license:check"),
});
