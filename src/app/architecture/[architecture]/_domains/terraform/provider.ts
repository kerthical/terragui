import { type HclBlockNode, type HclDocument, hclToAst } from "~/lib/hcl";

export type CloudProvider = "aws" | "gcp" | "azure";

export type ProviderBlock = {
  provider: CloudProvider;
  alias: string | null;
  code: string;
};

const providerMapping: Record<string, CloudProvider | undefined> = {
  aws: "aws",
  google: "gcp",
  azurerm: "azure",
};

export const extractProviderBlocks = (hclCode: string): ProviderBlock[] => {
  let document: HclDocument;
  try {
    document = hclToAst(hclCode);
  } catch {
    return [];
  }

  const providers: ProviderBlock[] = [];

  for (const node of document.nodes) {
    if (node.kind !== "Block" || node.type !== "provider") {
      continue;
    }

    const block = node as HclBlockNode;
    const firstLabel = block.labels[0];
    if (!firstLabel) {
      continue;
    }

    const providerName = firstLabel.kind === "string" ? firstLabel.value : firstLabel.name;
    const cloudProvider = providerMapping[providerName];
    if (!cloudProvider) {
      continue;
    }

    let alias: string | null = null;
    for (const bodyNode of block.body) {
      if (bodyNode.kind === "Attribute" && bodyNode.name === "alias") {
        if (bodyNode.expression.kind === "Literal" && bodyNode.expression.literalKind === "string") {
          alias = String(bodyNode.expression.value);
        }
        break;
      }
    }

    const startToken = document.tokens[block.range.start];
    const endToken = document.tokens[block.range.end - 1];
    if (!startToken || !endToken) {
      continue;
    }

    const startIndex = startToken.position.index;
    const endIndex = endToken.position.index + endToken.text.length;
    const code = document.source.slice(startIndex, endIndex);

    providers.push({ provider: cloudProvider, alias, code });
  }

  return providers;
};

export const getUniqueProviders = (blocks: ProviderBlock[]): CloudProvider[] => {
  const seen = new Set<CloudProvider>();
  const result: CloudProvider[] = [];
  for (const block of blocks) {
    if (!seen.has(block.provider)) {
      seen.add(block.provider);
      result.push(block.provider);
    }
  }
  return result;
};
