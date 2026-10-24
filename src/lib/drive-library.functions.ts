import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const folderSchema = z.object({
  path: z.array(z.string().min(10).max(256)).min(1).max(20).optional(),
  refresh: z.boolean().optional(),
});

export const listArtLibrary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => folderSchema.parse(input))
  .handler(async ({ data }) => {
    const { assertAccessAuthenticated } = await import("@/lib/access-guard.server");
    const { DRIVE_ROOT_FOLDER_ID, listDriveChildren } = await import("@/lib/drive-library.server");
    await assertAccessAuthenticated();
    const path = data.path ?? [DRIVE_ROOT_FOLDER_ID];
    const files = await listDriveChildren(path, data.refresh === true);
    return { path, rootId: DRIVE_ROOT_FOLDER_ID, files };
  });
