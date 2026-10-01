import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { accountsEnabled } from "./config";

/**
 * Tiny JSON document store. In production it uses a private Vercel Blob store
 * (connected to the project, which provides its credentials); in local
 * development without Blob credentials it falls back to files in ./.data.
 */
export interface Storage {
  read<T>(key: string): Promise<T | null>;
  /** Writes only if `key` doesn't exist yet; false if it already did. */
  create(key: string, data: unknown): Promise<boolean>;
  write(key: string, data: unknown): Promise<void>;
}

const blobStorage: Storage = {
  async read<T>(key: string) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  },
  async create(key, data) {
    try {
      await put(key, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
      return true;
    } catch (error) {
      // The SDK reports "already exists" as a generic error, so check directly.
      if (await blobStorage.read(key)) return false;
      throw error;
    }
  },
  async write(key, data) {
    await put(key, JSON.stringify(data), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  },
};

const DATA_DIR = path.join(process.cwd(), ".data");
const fileFor = (key: string) => path.join(DATA_DIR, ...key.split("/"));

const fileStorage: Storage = {
  async read<T>(key: string) {
    try {
      return JSON.parse(await readFile(fileFor(key), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async create(key, data) {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(file, JSON.stringify(data), { flag: "wx" });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  },
  async write(key, data) {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    // A unique temp name per write, so simultaneous saves of one file can't collide.
    const temp = `${file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(data));
    await rename(temp, file);
  },
};

/** null when accounts aren't configured (production without a Blob store). */
export function getStorage(): Storage | null {
  if (!accountsEnabled()) return null;
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? blobStorage : fileStorage;
}
