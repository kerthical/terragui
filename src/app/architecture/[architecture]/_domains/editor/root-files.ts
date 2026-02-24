import { type ArchitectureFile, isRootTerraformFilePath } from "~/app/architecture/[architecture]/_domains/architecture/files";

type RootFileOffset = {
  path: string;
  start: number;
  end: number;
};

const FILE_JOINER = "\n\n";

export const getRootFiles = (files: ArchitectureFile[]): ArchitectureFile[] => files.filter((file) => isRootTerraformFilePath(file.path));

export const buildCombinedRootSource = (files: ArchitectureFile[]): { source: string; offsets: RootFileOffset[] } => {
  const offsets: RootFileOffset[] = [];
  let cursor = 0;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file) {
      continue;
    }
    const start = cursor;
    const end = start + file.content.length;
    offsets.push({ path: file.path, start, end });
    cursor = end;
    if (index < files.length - 1) {
      cursor += FILE_JOINER.length;
    }
  }
  const source = files.map((file) => file.content).join(FILE_JOINER);
  return { source, offsets };
};

export const serializeRootFiles = (files: ArchitectureFile[]): string =>
  JSON.stringify([...files].map((file) => ({ path: file.path, content: file.content })).sort((left, right) => left.path.localeCompare(right.path)));

export const stripTerraformExtension = (path: string): string => path.replace(/\.tf$/i, "");

export const sanitizeBaseName = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const withoutExt = trimmed.replace(/\.tf$/i, "");
  const sanitized = withoutExt.replace(/[\\/]/g, "").trim();
  return sanitized.length === 0 ? null : sanitized;
};

export const makeUniqueBaseName = (base: string, existing: Set<string>): string => {
  let candidate = base;
  let index = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
};

export const findOffsetFile = (offset: number, offsets: RootFileOffset[]): RootFileOffset | null =>
  offsets.find((entry) => offset >= entry.start && offset < entry.end) ?? null;
