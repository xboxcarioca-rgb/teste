const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
export const DRIVE_ROOT_FOLDER_ID = "171iAy67NlkfiofSZ4c1JuIZZMxj3kFCa";

export type DriveLibraryItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  isFolder: boolean;
  isShortcut: boolean;
  targetId?: string;
  targetMimeType?: string;
  thumbnailLink?: string;
  imageMediaMetadata?: { width?: number; height?: number };
};

type DriveFileMetadata = DriveLibraryItem & {
  parents?: string[];
  thumbnailLink?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
};

const LIST_CACHE_TTL_MS = 30_000;
const listCache = new Map<string, { expiresAt: number; files: DriveLibraryItem[] }>();
const inFlightLists = new Map<string, Promise<DriveLibraryItem[]>>();

function driveHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) throw new Error("Google Drive não está conectado.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

export async function driveFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const auth = driveHeaders();
  headers.set("Authorization", auth.Authorization);
  headers.set("X-Connection-Api-Key", auth["X-Connection-Api-Key"]);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, headers });
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  if (!response) throw new Error("Google Drive indisponível.");
  return response;
}

export async function readDriveFile(fileId: string) {
  const fields =
    "id,name,mimeType,modifiedTime,size,parents,thumbnailLink,imageMediaMetadata(width,height),shortcutDetails(targetId,targetMimeType)";
  const response = await driveFetch(
    `/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Falha ao ler arquivo do Drive (${response.status}): ${text}`);
  return JSON.parse(text) as DriveFileMetadata;
}

export async function assertInsideLibrary(fileId: string) {
  if (fileId === DRIVE_ROOT_FOLDER_ID) return;
  let current = fileId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 20; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);
    const file = await readDriveFile(current);
    const parents = file.parents ?? [];
    if (parents.includes(DRIVE_ROOT_FOLDER_ID)) return;
    const parent = parents[0];
    if (!parent) break;
    current = parent;
  }
  throw new Error("Arquivo fora da biblioteca permitida.");
}

async function resolveFolderId(fileId: string) {
  if (fileId === DRIVE_ROOT_FOLDER_ID) return fileId;
  let current = fileId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 10; depth += 1) {
    if (visited.has(current)) throw new Error("Atalho circular na biblioteca.");
    visited.add(current);
    const file = await readDriveFile(current);
    const targetId = file.shortcutDetails?.targetId;
    if (!targetId) return current;
    current = targetId;
  }
  throw new Error("Caminho de atalhos muito profundo.");
}

async function fetchChildren(parentId: string): Promise<DriveLibraryItem[]> {
  const resolvedParentId = await resolveFolderId(parentId);
  const params = new URLSearchParams({
    q: `'${resolvedParentId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    fields:
      "files(id,name,mimeType,modifiedTime,size,thumbnailLink,imageMediaMetadata(width,height),shortcutDetails(targetId,targetMimeType))",
    pageSize: "1000",
    orderBy: "folder,name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await driveFetch(`/files?${params.toString()}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`Falha ao listar o Drive (${response.status}): ${text}`);
  const parsed = JSON.parse(text) as {
    files?: Array<
      DriveLibraryItem & { shortcutDetails?: { targetId?: string; targetMimeType?: string } }
    >;
  };
  return (parsed.files ?? []).map((file) => {
    const targetId = file.shortcutDetails?.targetId;
    const targetMimeType = file.shortcutDetails?.targetMimeType;
    const effectiveMime = targetMimeType ?? file.mimeType;
    return {
      id: file.id,
      name: file.name,
      mimeType: effectiveMime,
      modifiedTime: file.modifiedTime,
      size: file.size,
      isFolder: effectiveMime === "application/vnd.google-apps.folder",
      isShortcut: file.mimeType === "application/vnd.google-apps.shortcut",
      targetId,
      targetMimeType,
      thumbnailLink: file.thumbnailLink,
      imageMediaMetadata: file.imageMediaMetadata,
    };
  });
}

async function listChildrenUnchecked(parentId: string, force = false): Promise<DriveLibraryItem[]> {
  if (!force) {
    const cached = listCache.get(parentId);
    if (cached && cached.expiresAt > Date.now()) return cached.files;
    const pending = inFlightLists.get(parentId);
    if (pending) return pending;
  }

  const request = fetchChildren(parentId)
    .then((files) => {
      listCache.set(parentId, { files, expiresAt: Date.now() + LIST_CACHE_TTL_MS });
      return files;
    })
    .finally(() => inFlightLists.delete(parentId));
  inFlightLists.set(parentId, request);
  return request;
}

export async function validateLibraryPath(path: string[], force = false) {
  if (!path.length || path[0] !== DRIVE_ROOT_FOLDER_ID || path.length > 20) {
    throw new Error("Caminho inválido na biblioteca.");
  }
  for (let index = 1; index < path.length; index += 1) {
    const children = await listChildrenUnchecked(path[index - 1], force);
    const child = children.find((item) => item.id === path[index] || item.targetId === path[index]);
    if (!child?.isFolder) throw new Error("Pasta fora da biblioteca permitida.");
  }
}

function normalizeLibraryPath(path: string[]) {
  return path.filter((folderId, index) => index === 0 || folderId !== path[index - 1]);
}

export async function listDriveChildren(
  path: string[],
  force = false,
): Promise<DriveLibraryItem[]> {
  const normalizedPath = normalizeLibraryPath(path);
  await validateLibraryPath(normalizedPath, force);
  return listChildrenUnchecked(normalizedPath[normalizedPath.length - 1], force);
}

export async function findDriveFolderCover(
  path: string[],
  folderId: string,
): Promise<DriveLibraryItem | null> {
  const normalizedPath = normalizeLibraryPath(path);
  await validateLibraryPath(normalizedPath);
  const siblings = await listChildrenUnchecked(normalizedPath[normalizedPath.length - 1]);
  const folder = siblings.find((item) => item.id === folderId || item.targetId === folderId);
  if (!folder?.isFolder) throw new Error("Pasta fora da biblioteca permitida.");

  const resolvedFolderId = await resolveFolderId(folder.id);
  const params = new URLSearchParams({
    q: `'${resolvedFolderId.replaceAll("'", "\\'")}' in parents and trashed = false and mimeType contains 'image/'`,
    fields:
      "files(id,name,mimeType,modifiedTime,size,thumbnailLink,shortcutDetails(targetId,targetMimeType))",
    pageSize: "1",
    orderBy: "name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await driveFetch(`/files?${params.toString()}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`Falha ao buscar capa no Drive (${response.status}): ${text}`);
  const parsed = JSON.parse(text) as { files?: DriveFileMetadata[] };
  const image = parsed.files?.[0];
  if (!image) return null;
  return {
    id: image.id,
    name: image.name,
    mimeType: image.mimeType,
    modifiedTime: image.modifiedTime,
    size: image.size,
    isFolder: false,
    isShortcut: false,
    thumbnailLink: image.thumbnailLink,
  };
}

export async function assertFileInFolderPath(fileId: string, path: string[]) {
  const normalizedPath = normalizeLibraryPath(path);
  await validateLibraryPath(normalizedPath);
  const children = await listChildrenUnchecked(normalizedPath[normalizedPath.length - 1]);
  if (!children.some((item) => item.id === fileId)) {
    throw new Error("Arquivo fora da biblioteca permitida.");
  }
}
