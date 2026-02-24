import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { eq } from "drizzle-orm";
import db from "~/db";
import { architectureFiles } from "~/db/schema";

export type TerraformFileEntry = {
  path: string;
  content: string;
};

const BINARY_PREFIX = "__TERRAGUI_BINARY__:";
const MAX_PERSIST_BYTES = 402_653_166;
const EXCLUDED_DIRS = new Set<string>([".terraform"]);

const encodeFileContent = (buffer: Buffer): string => {
  const text = buffer.toString("utf8");
  if (Buffer.from(text, "utf8").equals(buffer)) {
    return text;
  }
  return `${BINARY_PREFIX}${buffer.toString("base64")}`;
};

const decodeFileContent = (content: string): Buffer => {
  if (content.startsWith(BINARY_PREFIX)) {
    return Buffer.from(content.slice(BINARY_PREFIX.length), "base64");
  }
  return Buffer.from(content, "utf8");
};

const normalizeDbPath = (pathValue: string): string => pathValue.replace(/\\/g, "/").replace(/^\/+/, "");

const ensureSafePath = (root: string, pathValue: string): string => {
  const normalized = normalizeDbPath(pathValue);
  const target = resolve(root, normalized);
  const safeRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(safeRoot)) {
    throw new Error(`Invalid path: ${pathValue}`);
  }
  return target;
};

const readWorkdirFiles = async (root: string, current: string): Promise<TerraformFileEntry[]> => {
  const entries = await readdir(current, { withFileTypes: true });
  const results: TerraformFileEntry[] = [];
  for (const entry of entries) {
    const fullPath = resolve(current, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await readWorkdirFiles(root, fullPath);
      results.push(...nested);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const stats = await stat(fullPath);
    if (stats.size > MAX_PERSIST_BYTES) {
      continue;
    }
    const buffer = await readFile(fullPath);
    const relativePath = relative(root, fullPath).split(sep).join("/");
    results.push({ path: relativePath, content: encodeFileContent(buffer) });
  }
  return results;
};

export const loadArchitectureFiles = async (architectureId: string): Promise<TerraformFileEntry[]> => {
  const rows = await db.query.architectureFiles.findMany({
    where: eq(architectureFiles.architectureId, architectureId),
  });
  return rows.map((row) => ({ path: row.path, content: row.content }));
};

export const restoreWorkdirFiles = async (workdir: string, files: TerraformFileEntry[]): Promise<void> => {
  const root = resolve(workdir);
  for (const file of files) {
    if (!file.path) {
      continue;
    }
    const target = ensureSafePath(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, decodeFileContent(file.content));
  }
};

export const persistWorkdirFiles = async (architectureId: string, workdir: string): Promise<void> => {
  const root = resolve(workdir);
  const files = await readWorkdirFiles(root, root);
  await db.transaction(async (tx) => {
    await tx.delete(architectureFiles).where(eq(architectureFiles.architectureId, architectureId));
    if (files.length > 0) {
      await tx.insert(architectureFiles).values(files.map((file) => ({ architectureId, path: file.path, content: file.content })));
    }
  });
};
