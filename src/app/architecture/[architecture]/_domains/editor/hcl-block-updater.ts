import { type HclAttributeNode, type HclBlockNode, type HclToken, HclTokenKind } from "~/lib/hcl";

export type AttributeUpdateMap = Record<string, string>;

const findAttributeNode = (block: HclBlockNode, name: string): HclAttributeNode | null => {
  for (const node of block.body) {
    if (node.kind === "Attribute" && node.name === name) {
      return node;
    }
  }
  return null;
};

export const buildBlockTextWithUpdates = (block: HclBlockNode, tokens: HclToken[], updates: AttributeUpdateMap): string | null => {
  if (Object.keys(updates).length === 0) {
    return null;
  }
  const blockTokens = tokens.slice(block.range.start, block.range.end).map((token) => ({ ...token }));
  let applied = false;
  const pendingInsertions: string[] = [];
  for (const [name, value] of Object.entries(updates)) {
    const attribute = findAttributeNode(block, name);
    if (!attribute) {
      pendingInsertions.push(`${name} = ${value}`);
      continue;
    }
    const start = attribute.valueRange.start - block.range.start;
    const end = attribute.valueRange.end - block.range.start;
    if (start < 0 || end > blockTokens.length) {
      continue;
    }
    let firstValueIndex = start;
    for (let index = start; index < end; index += 1) {
      const token = blockTokens[index];
      if (!token) {
        continue;
      }
      if (token.kind !== HclTokenKind.Whitespace && token.text.trim().length > 0) {
        firstValueIndex = index;
        break;
      }
    }
    const firstToken = blockTokens[firstValueIndex];
    if (!firstToken) {
      continue;
    }
    firstToken.text = value;
    for (let index = firstValueIndex + 1; index < end; index += 1) {
      const token = blockTokens[index];
      if (!token) {
        continue;
      }
      token.text = "";
    }
    applied = true;
  }
  let blockText = blockTokens.map((token) => token.text).join("");
  if (pendingInsertions.length > 0) {
    const closeIndex = blockText.lastIndexOf("}");
    if (closeIndex !== -1) {
      const beforeClose = blockText.slice(0, closeIndex);
      const lastLineBreak = beforeClose.lastIndexOf("\n");
      const indentStart = lastLineBreak === -1 ? 0 : lastLineBreak + 1;
      const indentMatch = beforeClose.slice(indentStart).match(/^[ \t]*/);
      const indent = indentMatch && indentMatch[0].length > 0 ? indentMatch[0] : "  ";
      const insertion = `\n${indent}${pendingInsertions.join(`\n${indent}`)}\n`;
      blockText = `${beforeClose}${insertion}${blockText.slice(closeIndex)}`;
      applied = true;
    }
  }
  if (!applied) {
    return null;
  }
  return blockText;
};
