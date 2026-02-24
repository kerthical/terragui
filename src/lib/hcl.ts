import {
  alt,
  apply,
  buildLexer,
  expectEOF,
  expectSingleResult,
  extractByTokenRange,
  kmid,
  lrec_sc,
  opt_sc,
  type Token as ParsecToken,
  type Parser,
  rep_sc,
  rule,
  seq,
  str,
  tok,
} from "typescript-parsec";

export enum HclTokenKind {
  Whitespace,
  LineComment,
  HashComment,
  BlockComment,
  Identifier,
  NumberLiteral,
  BooleanLiteral,
  NullLiteral,
  StringLiteral,
  HeredocLiteral,
  Equals,
  Colon,
  Arrow,
  DoubleEquals,
  NotEquals,
  QuestionQuestion,
  Question,
  Comma,
  Dot,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  AndAnd,
  OrOr,
  Bang,
  Less,
  LessEqual,
  Greater,
  GreaterEqual,
  LParen,
  RParen,
  LBrace,
  RBrace,
  LBracket,
  RBracket,
}

export type HclToken = {
  kind: HclTokenKind;
  text: string;
  position: {
    index: number;
    rowBegin: number;
    columnBegin: number;
    rowEnd: number;
    columnEnd: number;
  };
};

export type TokenRange = {
  start: number;
  end: number;
};

export type HclNode = HclWhitespaceNode | HclCommentNode | HclAttributeNode | HclBlockNode;

export type HclWhitespaceNode = {
  kind: "Whitespace";
  text: string;
  range: TokenRange;
};

export type HclCommentNode = {
  kind: "Comment";
  style: "line" | "hash" | "block";
  text: string;
  range: TokenRange;
};

export type HclAttributeNode = {
  kind: "Attribute";
  name: string;
  operator: "=" | ":";
  expression: HclExpression;
  valueText: string;
  range: TokenRange;
  valueRange: TokenRange;
};

export type HclBlockNode = {
  kind: "Block";
  type: string;
  labels: HclBlockLabel[];
  body: HclNode[];
  range: TokenRange;
  headerRange: TokenRange;
  closeRange: TokenRange;
};

export type HclBlockLabel = { kind: "identifier"; name: string } | { kind: "string"; value: string; raw: string };

export type HclExpression =
  | HclIdentifierExpression
  | HclLiteralExpression
  | HclTupleExpression
  | HclObjectExpression
  | HclUnaryExpression
  | HclBinaryExpression
  | HclConditionalExpression
  | HclFunctionCallExpression
  | HclAttributeAccessExpression
  | HclIndexExpression
  | HclSplatExpression
  | HclForTupleExpression
  | HclForObjectExpression;

export type HclIdentifierExpression = {
  kind: "Identifier";
  name: string;
};

export type HclLiteralExpression = {
  kind: "Literal";
  literalKind: "number" | "string" | "boolean" | "null" | "heredoc";
  value: string | number | boolean | null;
  raw: string;
};

export type HclTupleExpression = {
  kind: "Tuple";
  items: HclExpression[];
  hasTrailingComma: boolean;
};

export type HclObjectExpression = {
  kind: "Object";
  items: {
    key: HclExpression;
    operator: "=" | ":";
    value: HclExpression;
  }[];
  hasTrailingComma: boolean;
};

export type HclUnaryExpression = {
  kind: "Unary";
  operator: "!" | "-" | "+";
  expression: HclExpression;
};

export type HclBinaryExpression = {
  kind: "Binary";
  operator: "&&" | "||" | "??" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/" | "%";
  left: HclExpression;
  right: HclExpression;
};

export type HclConditionalExpression = {
  kind: "Conditional";
  condition: HclExpression;
  consequent: HclExpression;
  alternate: HclExpression;
};

export type HclFunctionCallExpression = {
  kind: "Call";
  target: HclExpression;
  arguments: HclExpression[];
};

export type HclAttributeAccessExpression = {
  kind: "GetAttr";
  target: HclExpression;
  attribute: string;
};

export type HclIndexExpression = {
  kind: "Index";
  target: HclExpression;
  index: HclExpression;
};

export type HclSplatExpression = {
  kind: "Splat";
  target: HclExpression;
  mode: "full" | "attr";
  attribute?: string;
};

export type HclForTupleExpression = {
  kind: "ForTuple";
  keyVar?: string;
  valueVar: string;
  collection: HclExpression;
  expression: HclExpression;
  condition?: HclExpression;
};

export type HclForObjectExpression = {
  kind: "ForObject";
  keyVar: string;
  valueVar: string;
  collection: HclExpression;
  keyExpression: HclExpression;
  valueExpression: HclExpression;
  condition?: HclExpression;
};

export type HclDocument = {
  type: "Document";
  nodes: HclNode[];
  tokens: HclToken[];
  source: string;
};

const BASE_TOKEN_RULES: Array<[RegExp, HclTokenKind]> = [
  [/^<<[-~]?([A-Za-z_][A-Za-z0-9_-]*)\r?\n[\s\S]*?\r?\n\1/gu, HclTokenKind.HeredocLiteral],
  [/^"(?:\\.|[^"\\])*"/gu, HclTokenKind.StringLiteral],
  [/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/gu, HclTokenKind.NumberLiteral],
  [/^(?:true|false)\b/gu, HclTokenKind.BooleanLiteral],
  [/^null\b/gu, HclTokenKind.NullLiteral],
  [/^==/gu, HclTokenKind.DoubleEquals],
  [/^!=/gu, HclTokenKind.NotEquals],
  [/^\?\?/gu, HclTokenKind.QuestionQuestion],
  [/^<=/gu, HclTokenKind.LessEqual],
  [/^>=/gu, HclTokenKind.GreaterEqual],
  [/^&&/gu, HclTokenKind.AndAnd],
  [/^\|\|/gu, HclTokenKind.OrOr],
  [/^=>/gu, HclTokenKind.Arrow],
  [/^\{/gu, HclTokenKind.LBrace],
  [/^\}/gu, HclTokenKind.RBrace],
  [/^\(/gu, HclTokenKind.LParen],
  [/^\)/gu, HclTokenKind.RParen],
  [/^\[/gu, HclTokenKind.LBracket],
  [/^\]/gu, HclTokenKind.RBracket],
  [/^,/gu, HclTokenKind.Comma],
  [/^\./gu, HclTokenKind.Dot],
  [/^:/gu, HclTokenKind.Colon],
  [/^=/gu, HclTokenKind.Equals],
  [/^\+/gu, HclTokenKind.Plus],
  [/^-/gu, HclTokenKind.Minus],
  [/^\*/gu, HclTokenKind.Star],
  [/^\//gu, HclTokenKind.Slash],
  [/^%/gu, HclTokenKind.Percent],
  [/^\?/gu, HclTokenKind.Question],
  [/^</gu, HclTokenKind.Less],
  [/^>/gu, HclTokenKind.Greater],
  [/^!/gu, HclTokenKind.Bang],
  [/^[A-Za-z_][A-Za-z0-9_-]*/gu, HclTokenKind.Identifier],
];

const DOCUMENT_LEXER = buildLexer([
  [true, /^[ \t\r\n]+/gu, HclTokenKind.Whitespace],
  [true, /^\/\/[^\r\n]*/gu, HclTokenKind.LineComment],
  [true, /^#[^\r\n]*/gu, HclTokenKind.HashComment],
  [true, /^\/\*[\s\S]*?\*\//gu, HclTokenKind.BlockComment],
  ...BASE_TOKEN_RULES.map(([pattern, kind]) => [true, pattern, kind] as [boolean, RegExp, HclTokenKind]),
]);

const EXPRESSION_LEXER = buildLexer([
  [false, /^[ \t\r\n]+/gu, HclTokenKind.Whitespace],
  [false, /^\/\/[^\r\n]*/gu, HclTokenKind.LineComment],
  [false, /^#[^\r\n]*/gu, HclTokenKind.HashComment],
  [false, /^\/\*[\s\S]*?\*\//gu, HclTokenKind.BlockComment],
  ...BASE_TOKEN_RULES.map(([pattern, kind]) => [true, pattern, kind] as [boolean, RegExp, HclTokenKind]),
]);

const EXPRESSION = rule<HclTokenKind, HclExpression>();
const CONDITIONAL = rule<HclTokenKind, HclExpression>();
const NULLISH = rule<HclTokenKind, HclExpression>();
const LOGICAL_OR = rule<HclTokenKind, HclExpression>();
const LOGICAL_AND = rule<HclTokenKind, HclExpression>();
const EQUALITY = rule<HclTokenKind, HclExpression>();
const COMPARISON = rule<HclTokenKind, HclExpression>();
const ADDITIVE = rule<HclTokenKind, HclExpression>();
const MULTIPLICATIVE = rule<HclTokenKind, HclExpression>();
const UNARY = rule<HclTokenKind, HclExpression>();
const POSTFIX = rule<HclTokenKind, HclExpression>();
const PRIMARY = rule<HclTokenKind, HclExpression>();
const ARGUMENT_LIST = rule<HclTokenKind, HclExpression[]>();
const SUFFIX = rule<HclTokenKind, (expr: HclExpression) => HclExpression>();
const TUPLE_BODY = rule<HclTokenKind, HclExpression>();
const OBJECT_BODY = rule<HclTokenKind, HclExpression>();

function decodeStringLiteral(raw: string): string {
  try {
    return JSON.parse(raw);
  } catch {
    const body = raw.slice(1, -1);
    return body.replace(/\\r/g, "\r").replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function makeBinaryParser(
  operand: Parser<HclTokenKind, HclExpression>,
  operatorKinds: HclTokenKind[],
  mapper?: (token: ParsecToken<HclTokenKind>) => HclBinaryExpression["operator"],
): Parser<HclTokenKind, HclExpression> {
  const operatorParser = operatorKinds.map((kind) => tok(kind)).reduce((prev, current) => (prev ? alt(prev, current) : current));

  return lrec_sc(operand, seq(operatorParser, operand), (left, [operatorToken, right]) => ({
    kind: "Binary",
    operator: mapper ? mapper(operatorToken) : (operatorToken.text as HclBinaryExpression["operator"]),
    left,
    right,
  }));
}

const NUMBER_LITERAL = apply(
  tok(HclTokenKind.NumberLiteral),
  (token) =>
    ({
      kind: "Literal",
      literalKind: "number",
      value: Number(token.text),
      raw: token.text,
    }) satisfies HclLiteralExpression,
);

const STRING_LITERAL = apply(
  tok(HclTokenKind.StringLiteral),
  (token) =>
    ({
      kind: "Literal",
      literalKind: "string",
      value: decodeStringLiteral(token.text),
      raw: token.text,
    }) satisfies HclLiteralExpression,
);

const HEREDOC_LITERAL = apply(
  tok(HclTokenKind.HeredocLiteral),
  (token) =>
    ({
      kind: "Literal",
      literalKind: "heredoc",
      value: token.text,
      raw: token.text,
    }) satisfies HclLiteralExpression,
);

const BOOLEAN_LITERAL = apply(
  tok(HclTokenKind.BooleanLiteral),
  (token) =>
    ({
      kind: "Literal",
      literalKind: "boolean",
      value: token.text === "true",
      raw: token.text,
    }) satisfies HclLiteralExpression,
);

const NULL_LITERAL = apply(
  tok(HclTokenKind.NullLiteral),
  (token) =>
    ({
      kind: "Literal",
      literalKind: "null",
      value: null,
      raw: token.text,
    }) satisfies HclLiteralExpression,
);

const IDENTIFIER = apply(
  tok(HclTokenKind.Identifier),
  (token) =>
    ({
      kind: "Identifier",
      name: token.text,
    }) satisfies HclIdentifierExpression,
);

const ARGUMENT_LIST_ITEMS = apply(seq(EXPRESSION, rep_sc(seq(tok(HclTokenKind.Comma), EXPRESSION)), opt_sc(tok(HclTokenKind.Comma))), ([first, rest]) => [
  first,
  ...rest.map(([, expr]) => expr),
]);

ARGUMENT_LIST.setPattern(apply(opt_sc(ARGUMENT_LIST_ITEMS), (args) => args ?? []));

SUFFIX.setPattern(
  alt(
    apply(
      seq(tok(HclTokenKind.Dot), tok(HclTokenKind.Star), tok(HclTokenKind.Dot), tok(HclTokenKind.Identifier)),
      ([, , , attrToken]) =>
        (expr: HclExpression): HclExpression => ({
          kind: "Splat",
          target: expr,
          mode: "attr",
          attribute: attrToken.text,
        }),
    ),
    apply(
      kmid(tok(HclTokenKind.LBracket), tok(HclTokenKind.Star), tok(HclTokenKind.RBracket)),
      () =>
        (expr: HclExpression): HclExpression => ({
          kind: "Splat",
          target: expr,
          mode: "full",
        }),
    ),
    apply(
      kmid(tok(HclTokenKind.LParen), opt_sc(ARGUMENT_LIST), tok(HclTokenKind.RParen)),
      (args) =>
        (expr: HclExpression): HclExpression => ({
          kind: "Call",
          target: expr,
          arguments: args ?? [],
        }),
    ),
    apply(
      kmid(tok(HclTokenKind.LBracket), EXPRESSION, tok(HclTokenKind.RBracket)),
      (index) =>
        (expr: HclExpression): HclExpression => ({
          kind: "Index",
          target: expr,
          index,
        }),
    ),
    apply(
      seq(tok(HclTokenKind.Dot), tok(HclTokenKind.Identifier)),
      ([, attrToken]) =>
        (expr: HclExpression): HclExpression => ({
          kind: "GetAttr",
          target: expr,
          attribute: attrToken.text,
        }),
    ),
  ),
);

POSTFIX.setPattern(apply(seq(PRIMARY, rep_sc(SUFFIX)), ([head, suffixes]) => suffixes.reduce((expr, transform) => transform(expr), head)));
UNARY.setPattern(
  alt(
    apply(seq(alt(tok(HclTokenKind.Bang), tok(HclTokenKind.Minus), tok(HclTokenKind.Plus)), UNARY), ([operatorToken, expression]) => ({
      kind: "Unary",
      operator: operatorToken.text as HclUnaryExpression["operator"],
      expression,
    })),
    POSTFIX,
  ),
);
MULTIPLICATIVE.setPattern(makeBinaryParser(UNARY, [HclTokenKind.Star, HclTokenKind.Slash, HclTokenKind.Percent]));
ADDITIVE.setPattern(makeBinaryParser(MULTIPLICATIVE, [HclTokenKind.Plus, HclTokenKind.Minus]));
COMPARISON.setPattern(makeBinaryParser(ADDITIVE, [HclTokenKind.Less, HclTokenKind.LessEqual, HclTokenKind.Greater, HclTokenKind.GreaterEqual]));
EQUALITY.setPattern(makeBinaryParser(COMPARISON, [HclTokenKind.DoubleEquals, HclTokenKind.NotEquals]));
LOGICAL_AND.setPattern(makeBinaryParser(EQUALITY, [HclTokenKind.AndAnd]));
LOGICAL_OR.setPattern(makeBinaryParser(LOGICAL_AND, [HclTokenKind.OrOr]));
NULLISH.setPattern(makeBinaryParser(LOGICAL_OR, [HclTokenKind.QuestionQuestion]));
CONDITIONAL.setPattern(
  alt(
    apply(seq(NULLISH, tok(HclTokenKind.Question), EXPRESSION, tok(HclTokenKind.Colon), EXPRESSION), ([condition, , consequent, , alternate]) => ({
      kind: "Conditional",
      condition,
      consequent,
      alternate,
    })),
    NULLISH,
  ),
);
EXPRESSION.setPattern(CONDITIONAL);

const TUPLE_EMPTY: HclTupleExpression = {
  kind: "Tuple",
  items: [],
  hasTrailingComma: false,
};

const TUPLE_ITEM = apply(seq(EXPRESSION, opt_sc(tok(HclTokenKind.Comma))), ([expression, trailing]) => ({
  expression,
  trailingComma: Boolean(trailing),
}));

const TUPLE_ITEMS = apply(seq(TUPLE_ITEM, rep_sc(TUPLE_ITEM)), ([first, rest]) => {
  const items = [first, ...rest];
  const trailingComma = items[items.length - 1]?.trailingComma ?? false;
  return {
    kind: "Tuple",
    items: items.map((item) => item.expression),
    hasTrailingComma: trailingComma,
  } satisfies HclTupleExpression;
});

TUPLE_BODY.setPattern(
  alt(
    apply(
      seq(
        str("for"),
        tok(HclTokenKind.Identifier),
        opt_sc(seq(tok(HclTokenKind.Comma), tok(HclTokenKind.Identifier))),
        str("in"),
        EXPRESSION,
        tok(HclTokenKind.Colon),
        EXPRESSION,
        opt_sc(seq(str("if"), EXPRESSION)),
      ),
      ([, firstVar, maybePair, , collection, , expression, maybeIf]) => {
        const condition = maybeIf?.[1];
        if (maybePair) {
          const result: HclForTupleExpression = {
            kind: "ForTuple",
            keyVar: firstVar.text,
            valueVar: maybePair[1].text,
            collection,
            expression,
          };
          if (condition) {
            result.condition = condition;
          }
          return result;
        }
        const result: HclForTupleExpression = {
          kind: "ForTuple",
          valueVar: firstVar.text,
          collection,
          expression,
        };
        if (condition) {
          result.condition = condition;
        }
        return result;
      },
    ),
    TUPLE_ITEMS,
  ),
);

const OBJECT_ITEM = apply(
  seq(EXPRESSION, alt(tok(HclTokenKind.Equals), tok(HclTokenKind.Colon)), EXPRESSION, opt_sc(tok(HclTokenKind.Comma))),
  ([key, opToken, value, trailing]) => {
    const operator: "=" | ":" = opToken.kind === HclTokenKind.Equals ? "=" : ":";
    return {
      key,
      operator,
      value,
      trailingComma: Boolean(trailing),
    };
  },
);

const OBJECT_ITEMS = apply(seq(OBJECT_ITEM, rep_sc(OBJECT_ITEM)), ([first, rest]) => {
  const items = [first, ...rest];
  const trailingComma = items[items.length - 1]?.trailingComma ?? false;
  return {
    kind: "Object",
    items: items.map((item) => ({ key: item.key, operator: item.operator, value: item.value })),
    hasTrailingComma: trailingComma,
  } satisfies HclObjectExpression;
});

OBJECT_BODY.setPattern(
  alt(
    apply(
      seq(
        str("for"),
        tok(HclTokenKind.Identifier),
        seq(tok(HclTokenKind.Comma), tok(HclTokenKind.Identifier)),
        str("in"),
        EXPRESSION,
        tok(HclTokenKind.Colon),
        EXPRESSION,
        tok(HclTokenKind.Arrow),
        EXPRESSION,
        opt_sc(seq(str("if"), EXPRESSION)),
      ),
      ([, keyVar, pair, , collection, , keyExpr, , valueExpr, maybeIf]) => {
        const result: HclForObjectExpression = {
          kind: "ForObject",
          keyVar: keyVar.text,
          valueVar: pair[1].text,
          collection,
          keyExpression: keyExpr,
          valueExpression: valueExpr,
        };
        if (maybeIf?.[1]) {
          result.condition = maybeIf[1];
        }
        return result;
      },
    ),
    OBJECT_ITEMS,
  ),
);

PRIMARY.setPattern(
  alt(
    NUMBER_LITERAL,
    STRING_LITERAL,
    HEREDOC_LITERAL,
    BOOLEAN_LITERAL,
    NULL_LITERAL,
    IDENTIFIER,
    apply(seq(tok(HclTokenKind.LBracket), opt_sc(TUPLE_BODY), tok(HclTokenKind.RBracket)), ([, body]) => body ?? TUPLE_EMPTY),
    apply(
      seq(tok(HclTokenKind.LBrace), opt_sc(OBJECT_BODY), tok(HclTokenKind.RBrace)),
      ([, body]) =>
        body ??
        ({
          kind: "Object",
          items: [],
          hasTrailingComma: false,
        } satisfies HclObjectExpression),
    ),
    kmid(tok(HclTokenKind.LParen), EXPRESSION, tok(HclTokenKind.RParen)),
  ),
);

function containsLineBreak(token: ParsecToken<HclTokenKind>): boolean {
  return token.text.includes("\n");
}

function parseBody(tokens: ParsecToken<HclTokenKind>[], source: string, start: number, stopKinds: Set<HclTokenKind>): { nodes: HclNode[]; index: number } {
  const nodes: HclNode[] = [];
  let index = start;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) {
      break;
    }

    if (stopKinds.has(token.kind)) {
      break;
    }

    if (token.kind === HclTokenKind.Whitespace) {
      let whitespaceEnd = index;
      while (whitespaceEnd < tokens.length) {
        const whitespaceToken = tokens[whitespaceEnd];
        if (!whitespaceToken || whitespaceToken.kind !== HclTokenKind.Whitespace) {
          break;
        }
        whitespaceEnd += 1;
      }
      const text = tokens
        .slice(index, whitespaceEnd)
        .map((item) => item.text)
        .join("");
      nodes.push({
        kind: "Whitespace",
        text,
        range: { start: index, end: whitespaceEnd },
      });
      index = whitespaceEnd;
      continue;
    }

    if (token.kind === HclTokenKind.LineComment || token.kind === HclTokenKind.HashComment || token.kind === HclTokenKind.BlockComment) {
      let style: HclCommentNode["style"];
      let text: string;
      if (token.kind === HclTokenKind.LineComment) {
        style = "line";
        text = token.text.slice(2);
      } else if (token.kind === HclTokenKind.HashComment) {
        style = "hash";
        text = token.text.slice(1);
      } else if (token.kind === HclTokenKind.BlockComment) {
        style = "block";
        text = token.text.slice(2, -2);
      } else {
        throw new Error("Unexpected token when parsing comment");
      }
      nodes.push({
        kind: "Comment",
        style,
        text,
        range: { start: index, end: index + 1 },
      });
      index += 1;
      continue;
    }

    if (token.kind === HclTokenKind.Identifier) {
      let lookaheadIndex = index + 1;
      let lookahead: ParsecToken<HclTokenKind> | undefined;
      while (lookaheadIndex < tokens.length) {
        const candidate = tokens[lookaheadIndex];
        if (!candidate) {
          break;
        }
        if (
          candidate.kind === HclTokenKind.Whitespace ||
          candidate.kind === HclTokenKind.LineComment ||
          candidate.kind === HclTokenKind.HashComment ||
          candidate.kind === HclTokenKind.BlockComment
        ) {
          lookaheadIndex += 1;
          continue;
        }
        lookahead = candidate;
        break;
      }
      if (!lookahead) {
        throw new Error(`Unexpected end after identifier "${token.text}"`);
      }

      if (lookahead.kind === HclTokenKind.Equals || lookahead.kind === HclTokenKind.Colon) {
        const nameToken = token;
        let operatorIndex = index + 1;
        while (operatorIndex < tokens.length) {
          const currentToken = tokens[operatorIndex];
          if (!currentToken) {
            break;
          }
          if (
            currentToken.kind !== HclTokenKind.Whitespace &&
            currentToken.kind !== HclTokenKind.LineComment &&
            currentToken.kind !== HclTokenKind.HashComment &&
            currentToken.kind !== HclTokenKind.BlockComment
          ) {
            break;
          }
          if (currentToken.kind !== HclTokenKind.Whitespace || !containsLineBreak(currentToken)) {
            operatorIndex += 1;
            continue;
          }
          break;
        }

        if (operatorIndex >= tokens.length) {
          throw new Error(`Unterminated attribute "${nameToken.text}"`);
        }

        const operatorToken = tokens[operatorIndex];
        if (!operatorToken) {
          throw new Error(`Attribute "${nameToken.text}" missing operator token`);
        }
        if (operatorToken.kind !== HclTokenKind.Equals && operatorToken.kind !== HclTokenKind.Colon) {
          throw new Error(`Attribute "${nameToken.text}" missing assignment operator`);
        }

        const operator: "=" | ":" = operatorToken.kind === HclTokenKind.Equals ? "=" : ":";

        const valueStart = operatorIndex + 1;
        if (valueStart >= tokens.length) {
          throw new Error(`Attribute "${nameToken.text}" missing value`);
        }

        let valueEnd = valueStart;
        let paren = 0;
        let bracket = 0;
        let brace = 0;
        while (valueEnd < tokens.length) {
          const valueToken = tokens[valueEnd];
          if (!valueToken) {
            break;
          }
          if (valueToken.kind === HclTokenKind.Whitespace) {
            if (paren === 0 && bracket === 0 && brace === 0 && containsLineBreak(valueToken)) {
              break;
            }
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.LineComment || valueToken.kind === HclTokenKind.HashComment) {
            if (paren === 0 && bracket === 0 && brace === 0) {
              break;
            }
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.BlockComment) {
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.LParen) {
            paren += 1;
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.RParen) {
            if (paren === 0) {
              break;
            }
            paren -= 1;
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.LBracket) {
            bracket += 1;
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.RBracket) {
            if (bracket === 0) {
              break;
            }
            bracket -= 1;
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.LBrace) {
            brace += 1;
            valueEnd += 1;
            continue;
          }
          if (valueToken.kind === HclTokenKind.RBrace) {
            if (brace === 0) {
              break;
            }
            brace -= 1;
            valueEnd += 1;
            continue;
          }
          valueEnd += 1;
        }

        if (valueEnd === valueStart) {
          throw new Error(`Attribute "${nameToken.text}" has empty value`);
        }

        const firstValueToken = tokens[valueStart];
        if (!firstValueToken) {
          throw new Error(`Invalid token range: ${valueStart}..${valueEnd}`);
        }
        const nextValueToken = valueEnd < tokens.length ? tokens[valueEnd] : undefined;
        const valueText = extractByTokenRange(source, firstValueToken, nextValueToken);
        const expressionHead = EXPRESSION_LEXER.parse(valueText);
        if (!expressionHead) {
          throw new Error("Failed to lex expression");
        }
        const expression = expectSingleResult(expectEOF(EXPRESSION.parse(expressionHead)));

        nodes.push({
          kind: "Attribute",
          name: nameToken.text,
          operator,
          expression,
          valueText,
          range: { start: index, end: valueEnd },
          valueRange: { start: valueStart, end: valueEnd },
        });
        index = valueEnd;
        continue;
      }

      if (lookahead.kind === HclTokenKind.LBrace || lookahead.kind === HclTokenKind.Identifier || lookahead.kind === HclTokenKind.StringLiteral) {
        const labels: HclBlockLabel[] = [];
        let headerIndex = index + 1;
        let openBraceIndex = -1;
        while (headerIndex < tokens.length) {
          const headerToken = tokens[headerIndex];
          if (!headerToken) {
            break;
          }
          if (
            headerToken.kind === HclTokenKind.Whitespace ||
            headerToken.kind === HclTokenKind.LineComment ||
            headerToken.kind === HclTokenKind.HashComment ||
            headerToken.kind === HclTokenKind.BlockComment
          ) {
            headerIndex += 1;
            continue;
          }

          if (headerToken.kind === HclTokenKind.LBrace) {
            openBraceIndex = headerIndex;
            break;
          }

          if (headerToken.kind === HclTokenKind.StringLiteral) {
            labels.push({
              kind: "string",
              value: decodeStringLiteral(headerToken.text),
              raw: headerToken.text,
            });
            headerIndex += 1;
            continue;
          }

          if (headerToken.kind === HclTokenKind.Identifier) {
            labels.push({
              kind: "identifier",
              name: headerToken.text,
            });
            headerIndex += 1;
            continue;
          }

          throw new Error(`Unexpected token "${headerToken.text}" in block header`);
        }

        if (openBraceIndex === -1) {
          throw new Error("Block missing opening brace");
        }

        const bodyResult = parseBody(tokens, source, openBraceIndex + 1, new Set([HclTokenKind.RBrace]));
        const closeIndex = bodyResult.index;
        if (closeIndex >= tokens.length || tokens[closeIndex]?.kind !== HclTokenKind.RBrace) {
          throw new Error("Block missing closing brace");
        }

        nodes.push({
          kind: "Block",
          type: token.text,
          labels,
          body: bodyResult.nodes,
          range: { start: index, end: closeIndex + 1 },
          headerRange: { start: index, end: openBraceIndex + 1 },
          closeRange: { start: closeIndex, end: closeIndex + 1 },
        });
        index = closeIndex + 1;
        continue;
      }

      throw new Error(`Unexpected token "${lookahead.text}" after identifier "${token.text}"`);
    }

    throw new Error(`Unexpected token "${token.text}"`);
  }

  return { nodes, index };
}

export function hclToAst(source: string): HclDocument {
  const head = DOCUMENT_LEXER.parse(source);
  const tokens: ParsecToken<HclTokenKind>[] = [];
  let current = head;
  while (current) {
    tokens.push(current);
    current = current.next;
  }

  const { nodes } = parseBody(tokens, source, 0, new Set());

  const normalizedTokens = tokens.map((token) => ({
    kind: token.kind,
    text: token.text,
    position: token.pos,
  }));

  return {
    type: "Document",
    nodes,
    tokens: normalizedTokens,
    source,
  };
}

export function astToHcl(document: HclDocument): string {
  return document.tokens.map((token) => token.text).join("");
}
