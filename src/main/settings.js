/**
 * Configurações persistidas (JSON em <userData>/settings.json).
 * Escritas com debounce e arquivo temporário para não corromper em queda de energia.
 */

const fs = require('fs');
const path = require('path');
const { createDefaultSettings, deepMerge } = require('../common/defaults');
const { getLogger } = require('./logger');

class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = createDefaultSettings();
    this.saveTimer = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.data = deepMerge(createDefaultSettings(), parsed);
      } else {
        this.saveNow();
      }
    } catch (error) {
      getLogger().warn('Configurações inválidas, recriando padrão.', { error: String(error.message || error) });
      this.data = createDefaultSettings();
    }
    return this.data;
  }

  all() {
    return JSON.parse(JSON.stringify(this.data));
  }

  get(keyPath, fallback) {
    const value = keyPath.split('.').reduce((current, key) => (current == null ? current : current[key]), this.data);
    return value === undefined ? fallback : value;
  }

  /**
   * Atualiza configurações (merge profundo).
   * @param {object} patch
   */
  update(patch) {
    this.data = deepMerge(this.data, patch || {});
    this.scheduleSave();
    return this.all();
  }

  set(keyPath, value) {
    const keys = keyPath.split('.');
    let cursor = this.data;
    for (let index = 0; index < keys.length - 1; index += 1) {
      const key = keys[index];
      if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[keys[keys.length - 1]] = value;
    this.scheduleSave();
    return this.all();
  }

  scheduleSave(delayMs = 250) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), delayMs);
    this.saveTimer.unref?.();
  }

  saveNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(temp, this.filePath);
      return true;
    } catch (error) {
      getLogger().error('Falha ao gravar configurações.', { error: String(error.message || error) });
      return false;
    }
  }

  /** Adiciona um projeto à lista de recentes (máximo 12). */
  addRecentProject(entry) {
    const recent = Array.isArray(this.data.recentProjects) ? this.data.recentProjects : [];
    const filtered = recent.filter((item) => item.path !== entry.path);
    filtered.unshift({ ...entry, openedAt: new Date().toISOString() });
    this.data.recentProjects = filtered.slice(0, 12);
    this.scheduleSave();
    return this.data.recentProjects;
  }
}

module.exports = { SettingsStore };
