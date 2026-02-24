export type ProviderName = "aws" | "google" | "azurerm";

export type HclFileSeed = {
  path: string;
  content: string;
};

export type ArchitectureSeed = {
  slug: string;
  name: string;
  description?: string;
  sourceType: "scratch" | "provider" | "local" | "template" | "git";
  provider: ProviderName;
  files: HclFileSeed[];
};
