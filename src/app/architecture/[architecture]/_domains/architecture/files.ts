export type ArchitectureFile = {
  path: string;
  content: string;
};

export const isRootTerraformFilePath = (path: string): boolean => /^[^/\\]+\.tf$/i.test(path);
