import { createFileRoute } from "@tanstack/react-router";

function safeName(name: string) {
  return name.replace(/[\\/\r\n";]/g, "_").slice(0, 180) || "arte-dtflexpro";
}

export const Route = createFileRoute("/api/drive-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { assertAccessAuthenticated } = await import("@/lib/access-guard.server");
          await assertAccessAuthenticated();
          const { assertFileInFolderPath, driveFetch, findDriveFolderCover, readDriveFile } =
            await import("@/lib/drive-library.server");
          const url = new URL(request.url);
          const requestedId = url.searchParams.get("id");
          const coverFolderId = url.searchParams.get("coverFolder");
          const pathParam = url.searchParams.get("path");
          const path = pathParam?.split(",").filter(Boolean) ?? [];
          const download = url.searchParams.get("download") === "1";
          let fileId = requestedId;
          let validationPath = path;
          let thumbnailLink: string | undefined;

          if (coverFolderId) {
            const image = await findDriveFolderCover(path, coverFolderId);
            fileId = image?.id ?? null;
            thumbnailLink = image?.thumbnailLink;
            validationPath = [...path, coverFolderId];
            if (!fileId) return new Response(null, { status: 404 });
          }
          if (!fileId) return new Response("Arquivo não informado.", { status: 400 });

          await assertFileInFolderPath(fileId, validationPath);
          const metadata = await readDriveFile(fileId);
          const actualId = metadata.shortcutDetails?.targetId ?? fileId;
          const actualMime = metadata.shortcutDetails?.targetMimeType ?? metadata.mimeType;
          if (actualMime === "application/vnd.google-apps.folder") {
            return new Response("Pastas não podem ser baixadas.", { status: 400 });
          }

          const previewThumbnail = download ? undefined : (thumbnailLink ?? metadata.thumbnailLink);
          const response = previewThumbnail
            ? await fetch(previewThumbnail)
            : await driveFetch(
                `/files/${encodeURIComponent(actualId)}?alt=media&supportsAllDrives=true`,
              );
          if (!response.ok || !response.body) {
            const message = await response.text();
            return new Response(`Arquivo indisponível (${response.status}): ${message}`, {
              status: response.status,
            });
          }
          const headers = new Headers();
          headers.set(
            "Content-Type",
            response.headers.get("content-type") ?? actualMime ?? "application/octet-stream",
          );
          headers.set(
            "Cache-Control",
            download ? "private, no-store" : "private, max-age=300, stale-while-revalidate=600",
          );
          if (download)
            headers.set("Content-Disposition", `attachment; filename="${safeName(metadata.name)}"`);
          return new Response(response.body, { status: 200, headers });
        } catch (error) {
          console.error("Falha ao acessar arquivo da biblioteca:", error);
          return new Response("Não foi possível abrir este item da biblioteca.", { status: 400 });
        }
      },
    },
  },
});
