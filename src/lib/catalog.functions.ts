import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const settingsSchema = z.object({
  productType: z.string().max(80),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
  fabric: z.string().max(80),
  modeling: z.string().max(80),
  sizes: z.array(z.string().max(12)).min(1).max(12),
  models: z.array(z.string().max(40)).min(1).max(8),
  position: z.string().max(30),
  printSize: z.number().min(5).max(80),
  brandName: z.string().max(80),
  watermarkText: z.string().max(80),
  logoName: z.string().max(160).optional(),
  watermark: z.boolean(),
  watermarkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  watermarkOpacity: z.number().min(0).max(100),
  price: z.number().min(0).max(1_000_000),
  salePrice: z.number().min(0).max(1_000_000),
  wholesalePrice: z.number().min(0).max(1_000_000),
  category: z.string().min(1).max(100),
  prefix: z.string().trim().min(1).max(16).regex(/^[A-Za-z0-9]+$/),
  sortBy: z.enum(["upload", "code", "name", "category", "price"]),
});

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 90);
}

function professionalName(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b\d+\b/g, "").trim();
  const title = base.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return title ? `Estampa ${title}` : "Estampa Premium";
}

async function context() {
  const [{ supabaseAdmin }, { getAuthenticatedAccess }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("./access-guard.server"),
  ]);
  return { db: supabaseAdmin as any, access: await getAuthenticatedAccess() };
}

export const createCatalogBatch = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ name: z.string().min(2).max(100), total: z.number().int().min(20).max(100), settings: settingsSchema }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const prefix = data.settings.prefix.toUpperCase();
    const { data: existing } = await db.from("catalog_products").select("code").eq("user_access_id", access.accessId).like("code", `${prefix}-%`);
    const start = Math.max(0, ...(existing ?? []).map((row: { code: string }) => Number(row.code.split("-").pop()) || 0)) + 1;
    const { data: batch, error } = await db.from("catalog_batches").insert({
      user_access_id: access.accessId,
      name: data.name,
      category: data.settings.category,
      prefix,
      status: "processing",
      settings: data.settings,
      total_items: data.total,
    }).select("id, public_token").single();
    if (error || !batch) throw new Error("Não foi possível iniciar o catálogo.");
    return { id: batch.id as string, publicToken: batch.public_token as string, start };
  });

export const prepareCatalogProductUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    batchId: z.string().uuid(),
    code: z.string().min(3).max(30),
    originalName: z.string().min(1).max(180),
    mockupCount: z.number().int().min(1).max(24),
  }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { data: batch } = await db.from("catalog_batches").select("id").eq("id", data.batchId).eq("user_access_id", access.accessId).maybeSingle();
    if (!batch) throw new Error("Catálogo não encontrado.");
    const basePath = `${access.accessId}/${data.batchId}/${data.code}`;
    const { data: previous } = await db.storage.from("catalog-assets").list(basePath);
    if (previous?.length) {
      await db.storage.from("catalog-assets").remove(previous.map((item: { name: string }) => `${basePath}/${item.name}`));
    }
    const paths = [
      `${basePath}/original-${safeName(data.originalName)}`,
      ...Array.from({ length: data.mockupCount }, (_, index) => `${basePath}/mockup-${String(index + 1).padStart(2, "0")}.jpg`),
    ];
    const signed = await Promise.all(paths.map(async (path) => {
      const { data: upload, error } = await db.storage.from("catalog-assets").createSignedUploadUrl(path);
      if (error || !upload?.token) throw new Error("Não foi possível preparar o envio da imagem.");
      return { path, token: upload.token };
    }));
    return { original: signed[0], mockups: signed.slice(1) };
  });

export const completeCatalogProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    batchId: z.string().uuid(),
    code: z.string().min(3).max(30),
    order: z.number().int().min(0).max(99),
    originalName: z.string().min(1).max(180),
    originalPath: z.string().min(10).max(500),
    mockupPaths: z.array(z.string().min(10).max(500)).min(1).max(24),
    settings: settingsSchema,
  }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { data: batch } = await db.from("catalog_batches").select("id").eq("id", data.batchId).eq("user_access_id", access.accessId).maybeSingle();
    if (!batch) throw new Error("Catálogo não encontrado.");
    const ownedPrefix = `${access.accessId}/${data.batchId}/${data.code}/`;
    if (!data.originalPath.startsWith(ownedPrefix) || data.mockupPaths.some((path) => !path.startsWith(ownedPrefix))) {
      throw new Error("Arquivos do catálogo inválidos.");
    }
    const { data: stored } = await db.storage.from("catalog-assets").list(`${access.accessId}/${data.batchId}/${data.code}`);
    const storedNames = new Set((stored ?? []).map((item: { name: string }) => item.name));
    const expectedNames = [data.originalPath, ...data.mockupPaths].map((path) => path.split("/").pop() ?? "");
    if (expectedNames.some((name) => !storedNames.has(name))) throw new Error("O envio das imagens não foi concluído.");
    try {
      const name = professionalName(data.originalName);
      const description = `${name} em ${data.settings.productType}, tecido ${data.settings.fabric}, modelagem ${data.settings.modeling}. Tamanhos ${data.settings.sizes.join(", ")}. Impressão DTF com arte original preservada.`;
      const { error } = await db.from("catalog_products").upsert({
        batch_id: data.batchId,
        user_access_id: access.accessId,
        code: data.code,
        name,
        category: data.settings.category,
        description,
        original_path: data.originalPath,
        mockup_paths: data.mockupPaths,
        source_filename: data.originalName,
        sort_order: data.order,
        status: "ready",
        product_data: data.settings,
      }, { onConflict: "user_access_id,code" });
      if (error) throw error;
      return { code: data.code, name, mockups: data.mockupPaths.length };
    } catch (error) {
      await db.storage.from("catalog-assets").remove([data.originalPath, ...data.mockupPaths]);
      throw new Error(error instanceof Error ? error.message : "Não foi possível processar esta imagem.");
    }
  });

export const finishCatalogBatch = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), completed: z.number().int(), failed: z.number().int() }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { error } = await db.from("catalog_batches").update({ status: data.completed === 0 ? "failed" : "completed", completed_items: data.completed, failed_items: data.failed }).eq("id", data.id).eq("user_access_id", access.accessId);
    if (error) throw new Error("Não foi possível finalizar o catálogo.");
    return { ok: true };
  });

export const publishCatalogBatch = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { data: batch, error } = await db.from("catalog_batches").update({ status: "published", published_at: new Date().toISOString() }).eq("id", data.id).eq("user_access_id", access.accessId).select("public_token").single();
    if (error || !batch) throw new Error("Não foi possível publicar o catálogo.");
    return { token: batch.public_token as string };
  });

export const saveCatalogTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ name: z.string().min(2).max(80), settings: settingsSchema }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { error } = await db.from("catalog_templates").upsert({ user_access_id: access.accessId, name: data.name, settings: data.settings }, { onConflict: "user_access_id,name" });
    if (error) throw new Error("Não foi possível salvar o modelo.");
    return { ok: true };
  });

export const listCatalogTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const { db, access } = await context();
  const { data } = await db.from("catalog_templates").select("id,name,settings").eq("user_access_id", access.accessId).order("name");
  return { templates: data ?? [] };
});

export const getCatalogBatch = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, access } = await context();
    const { data: batch } = await db.from("catalog_batches").select("*").eq("id", data.id).eq("user_access_id", access.accessId).maybeSingle();
    if (!batch) throw new Error("Catálogo não encontrado.");
    const { data: products } = await db.from("catalog_products").select("*").eq("batch_id", data.id).order("sort_order");
    const paths = (products ?? []).flatMap((product: any) => [product.original_path, ...(product.mockup_paths ?? [])]);
    const { data: signed } = await db.storage.from("catalog-assets").createSignedUrls(paths, 7 * 24 * 60 * 60);
    const urls = new Map((signed ?? []).map((item: any) => [item.path, item.signedUrl]));
    return { batch, products: (products ?? []).map((product: any) => ({ ...product, original_url: urls.get(product.original_path), mockup_urls: (product.mockup_paths ?? []).map((path: string) => urls.get(path)).filter(Boolean) })) };
  });

export const getPublishedCatalog = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: batch } = await db.from("catalog_batches").select("id,name,category,settings,published_at").eq("public_token", data.token).eq("status", "published").maybeSingle();
    if (!batch) throw new Error("Catálogo não encontrado.");
    const { data: products } = await db.from("catalog_products").select("code,name,category,description,mockup_paths,product_data,sort_order").eq("batch_id", batch.id).eq("status", "ready").order("sort_order");
    const paths = (products ?? []).flatMap((product: any) => product.mockup_paths ?? []);
    const { data: signed } = await db.storage.from("catalog-assets").createSignedUrls(paths, 60 * 60);
    const urls = new Map((signed ?? []).map((item: any) => [item.path, item.signedUrl]));
    return { batch, products: (products ?? []).map((product: any) => ({ ...product, mockup_url: urls.get(product.mockup_paths?.[0]) })) };
  });