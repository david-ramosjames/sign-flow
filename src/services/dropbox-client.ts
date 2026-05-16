/**
 * Dropbox content API — uploads signed PDFs and audit certificates (binary never stored in Firestore).
 */

function token(): string {
  const t = process.env.DROPBOX_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("DROPBOX_ACCESS_TOKEN is not configured.");
  return t;
}

async function rpc<TBody extends object, TRes>(path: string, body: TBody): Promise<TRes> {
  const res = await fetch(`https://api.dropboxapi.com/2/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox ${path} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  return (await res.json()) as TRes;
}

export async function ensureDropboxFolder(folderPath: string): Promise<void> {
  const normalized = folderPath.startsWith("/") ? folderPath : `/${folderPath}`;
  const parts = normalized.split("/").filter(Boolean);
  let acc = "";
  for (const p of parts) {
    acc = `${acc}/${p}`;
    try {
      await rpc("files/create_folder_v2", { path: acc, autorename: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.includes("conflict")) throw e;
    }
  }
}

export async function uploadDropboxFile(input: {
  dropboxPath: string;
  bytes: Buffer;
  mode?: "add" | "overwrite";
}): Promise<{ path_display: string; id: string }> {
  const normalized = input.dropboxPath.startsWith("/") ? input.dropboxPath : `/${input.dropboxPath}`;
  const folder = normalized.slice(0, normalized.lastIndexOf("/")) || "/";
  if (folder !== "/") await ensureDropboxFolder(folder);

  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token()}`,
      "content-type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: normalized,
        mode: input.mode ?? "overwrite",
        autorename: false,
        mute: false,
      }),
    },
    body: new Uint8Array(input.bytes),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox upload failed: ${res.status} ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { path_display: string; id: string };
  return { path_display: json.path_display, id: json.id };
}

export async function getDropboxTemporaryLink(path: string): Promise<string> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const out = await rpc<{ path: string }, { link: string }>("files/get_temporary_link", { path: normalized });
  return out.link;
}
