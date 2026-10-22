/**
 * Templates de identidade visual (banner + legenda + formato).
 *
 * Os built-in vêm do código; os criados pelo usuário ficam em
 * <userData>/templates/<id>.json. Assim uma atualização do app não apaga
 * os templates personalizados.
 */

const fs = require('fs');
const path = require('path');
const { BUILTIN_TEMPLATES, deepMerge } = require('../common/defaults');
const { getLogger } = require('./logger');

class TemplateStore {
  constructor(templatesDir) {
    this.dir = templatesDir;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch {
      /* sem disco => só built-ins */
    }
  }

  /** Todos os templates (built-in primeiro, depois os do usuário). */
  list() {
    const userTemplates = [];
    try {
      for (const name of fs.readdirSync(this.dir)) {
        if (!name.endsWith('.json')) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(this.dir, name), 'utf8'));
          if (parsed?.id && parsed?.patch) userTemplates.push({ ...parsed, builtin: false });
        } catch (error) {
          getLogger().warn(`Template inválido ignorado: ${name}`, { error: String(error.message || error) });
        }
      }
    } catch {
      /* diretório indisponível */
    }
    return [...BUILTIN_TEMPLATES, ...userTemplates.sort((a, b) => (a.name || '').localeCompare(b.name || ''))];
  }

  get(id) {
    return this.list().find((template) => template.id === id) || null;
  }

  /**
   * Salva um template do usuário.
   * @param {{id?:string,name:string,description?:string,patch:object}} template
   */
  save(template) {
    if (!template?.name || !template?.patch) throw new Error('Template precisa de nome e conteúdo (patch).');
    const id = String(template.id || slugify(template.name)).replace(/[^\w.-]/g, '_');
    if (BUILTIN_TEMPLATES.some((builtin) => builtin.id === id)) {
      throw new Error('Esse nome é reservado para um template pronto. Escolha outro nome.');
    }
    const record = {
      id,
      name: String(template.name).slice(0, 60),
      description: String(template.description || '').slice(0, 240),
      builtin: false,
      createdAt: template.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patch: sanitizePatch(template.patch)
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, `${id}.json`), JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  /**
   * Cria um template a partir de um projeto real (botão "Salvar como template").
   * @param {object} project
   * @param {{name:string,description?:string}} meta
   */
  saveFromProject(project, meta) {
    const patch = {
      output: {
        formatId: project.output?.formatId,
        layout: project.output?.layout,
        fps: project.output?.fps,
        videoCodec: project.output?.videoCodec,
        crf: project.output?.crf,
        background: project.output?.background,
        split: { gapRatio: project.output?.split?.gapRatio, borderRatio: project.output?.split?.borderRatio, borderColor: project.output?.split?.borderColor, audioFrom: project.output?.split?.audioFrom }
      },
      subtitles: { enabled: project.subtitles?.enabled, style: project.subtitles?.style },
      banner: project.banner
    };
    return this.save({ name: meta.name, description: meta.description, patch });
  }

  delete(id) {
    if (BUILTIN_TEMPLATES.some((template) => template.id === id)) {
      throw new Error('Templates prontos não podem ser apagados (mas você pode duplicar e editar).');
    }
    const file = path.join(this.dir, `${String(id).replace(/[^\w.-]/g, '_')}.json`);
    if (!fs.existsSync(file)) return false;
    fs.rmSync(file, { force: true });
    return true;
  }

  /** Aplica um template a um projeto, preservando fontes e cortes. */
  applyToProject(project, templateId) {
    const template = this.get(templateId);
    if (!template) return project;
    const merged = deepMerge(project, template.patch);
    merged.templateId = template.id;
    return merged;
  }
}

/** Mantém apenas chaves seguras do patch (evita caminho absoluto de usuário). */
function sanitizePatch(patch) {
  const copy = JSON.parse(JSON.stringify(patch || {}));
  if (copy.banner?.logo?.path) copy.banner.logo.path = ''; // imagem é específica de cada máquina
  if (copy.subtitles?.cues) delete copy.subtitles.cues;
  return copy;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'template';
}

module.exports = { TemplateStore, slugify, sanitizePatch };
