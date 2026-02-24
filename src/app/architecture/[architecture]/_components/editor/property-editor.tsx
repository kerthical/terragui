"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { fetchProviderSchema } from "~/app/architecture/[architecture]/_actions/terraform/fetch-provider-schema";
import type { ReactFlowNode } from "~/lib/graph";
import type { HclAttributeNode, HclBlockNode } from "~/lib/hcl";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/ui/form";
import { Input } from "~/ui/input";
import { ScrollArea } from "~/ui/scroll-area";
import { Switch } from "~/ui/switch";
import { Textarea } from "~/ui/textarea";

type ProviderSchemaAttribute = {
  type?: unknown;
  optional?: boolean;
  required?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  description?: string;
  description_kind?: "plain" | "markdown";
};

type ProviderSchemaBlockType = {
  nesting_mode: "single" | "list" | "set" | "map" | "group";
  min_items?: number;
  max_items?: number;
  block: ProviderSchemaBlock;
};

type ProviderSchemaBlock = {
  attributes?: Record<string, ProviderSchemaAttribute>;
  block_types?: Record<string, ProviderSchemaBlockType>;
  description?: string;
  description_kind?: "plain" | "markdown";
};

type ProviderResourceSchema = {
  version: number;
  block: ProviderSchemaBlock;
};

type ProviderSchema = {
  provider: ProviderResourceSchema;
  resource_schemas?: Record<string, ProviderResourceSchema>;
  data_source_schemas?: Record<string, ProviderResourceSchema>;
};

type PropertyEditorProps = {
  selectedNode: ReactFlowNode | null;
  onApply: (nodeId: string, updates: Record<string, string>) => Promise<void>;
  disabled?: boolean;
};

type FieldSpec = {
  name: string;
  input: "text" | "number" | "boolean" | "textarea";
  required: boolean;
  description: string | null;
  configured: boolean;
};

type FormValues = Record<string, string | boolean>;

type ProviderInfo =
  | {
      kind: "resource";
      provider: string;
      resourceType: string;
    }
  | {
      kind: "provider";
      provider: string;
    };

type CachedSchemaEntry = {
  provider: string;
  schema: ProviderSchema | null;
  error: string | null;
};

const findAttributeNode = (block: HclBlockNode, name: string): HclAttributeNode | null => {
  for (const node of block.body) {
    if (node.kind === "Attribute" && node.name === name) {
      return node;
    }
  }
  return null;
};

const determineProviderInfo = (node: ReactFlowNode | null): ProviderInfo | null => {
  const graphNode = node?.data?.graphNode;
  if (!graphNode) {
    return null;
  }
  if (graphNode.type === "provider") {
    return { kind: "provider", provider: graphNode.data.name };
  }
  if (graphNode.type === "resource") {
    const resourceType = graphNode.data.address.resourceType;
    const separatorIndex = resourceType.indexOf("_");
    const provider = separatorIndex === -1 ? resourceType : resourceType.slice(0, separatorIndex);
    return { kind: "resource", provider, resourceType };
  }
  return null;
};

const pickSchemaBlock = (schema: ProviderSchema, info: ProviderInfo): ProviderSchemaBlock | null => {
  if (info.kind === "provider") {
    return schema.provider.block;
  }
  return schema.resource_schemas?.[info.resourceType]?.block ?? null;
};

const classifyInput = (type: ProviderSchemaAttribute["type"]): FieldSpec["input"] => {
  if (type === "bool") {
    return "boolean";
  }
  if (type === "number") {
    return "number";
  }
  if (type === "string") {
    return "text";
  }
  if (Array.isArray(type)) {
    const head = type[0];
    if (head === "bool") {
      return "boolean";
    }
    if (head === "number") {
      return "number";
    }
    if (head === "string") {
      return "text";
    }
    return "textarea";
  }
  return "text";
};

const attributeToDefaultValue = (block: HclBlockNode, field: FieldSpec): string | boolean => {
  const attribute = findAttributeNode(block, field.name);
  if (!attribute) {
    if (field.input === "boolean") {
      return false;
    }
    return "";
  }
  if (field.input === "boolean") {
    if (attribute.expression.kind === "Literal" && typeof attribute.expression.value === "boolean") {
      return attribute.expression.value;
    }
    return attribute.valueText.trim().toLowerCase() === "true";
  }
  if (field.input === "number") {
    if (attribute.expression.kind === "Literal" && typeof attribute.expression.value === "number") {
      return String(attribute.expression.value);
    }
    return attribute.valueText.trim();
  }
  if (field.input === "text") {
    if (attribute.expression.kind === "Literal" && typeof attribute.expression.value === "string") {
      return attribute.expression.value;
    }
    const trimmed = attribute.valueText.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  return attribute.valueText.trim();
};

const serializeValue = (field: FieldSpec, value: string | boolean): string | null => {
  if (field.input === "boolean") {
    return value === true ? "true" : "false";
  }
  if (field.input === "number") {
    if (typeof value !== "string") {
      return null;
    }
    const text = value.trim();
    if (text.length === 0) {
      return null;
    }
    if (Number.isNaN(Number(text))) {
      return null;
    }
    return text;
  }
  if (field.input === "textarea") {
    if (typeof value !== "string") {
      return null;
    }
    const text = value.trim();
    return text.length === 0 ? null : text;
  }
  if (typeof value !== "string") {
    return null;
  }
  return JSON.stringify(value);
};

export function PropertyEditor({ onApply, selectedNode, disabled = false }: PropertyEditorProps) {
  const isDisabled = disabled === true;
  const providerInfo = useMemo(() => determineProviderInfo(selectedNode), [selectedNode]);
  const block = useMemo(() => {
    const graphNode = selectedNode?.data?.graphNode;
    if (!graphNode) {
      return null;
    }
    if (graphNode.type === "resource" || graphNode.type === "provider") {
      return graphNode.data.block;
    }
    return null;
  }, [selectedNode]);
  const [schema, setSchema] = useState<ProviderSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const cacheRef = useRef<CachedSchemaEntry[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingApplyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      if (!providerInfo) {
        setSchema(null);
        setSchemaError(null);
        setIsSchemaLoading(false);
        return;
      }
      const cachedIndex = cacheRef.current.findIndex((entry) => entry.provider === providerInfo.provider);
      if (cachedIndex !== -1) {
        const cached = cacheRef.current[cachedIndex];
        if (!cached) {
          setIsSchemaLoading(false);
          return;
        }
        cacheRef.current.splice(cachedIndex, 1);
        cacheRef.current.unshift(cached);
        setSchema(cached.schema);
        setSchemaError(cached.error);
        setIsSchemaLoading(false);
        return;
      }
      setIsSchemaLoading(true);
      const result = await fetchProviderSchema({ provider: providerInfo.provider });
      if (cancelled) {
        return;
      }
      const resolvedError = result.schema ? null : (result.error ?? "Failed to fetch schema");
      setSchema(result.schema ?? null);
      setSchemaError(resolvedError);
      cacheRef.current.unshift({
        provider: providerInfo.provider,
        schema: result.schema ?? null,
        error: resolvedError,
      });
      if (cacheRef.current.length > 3) {
        cacheRef.current.length = 3;
      }
      setIsSchemaLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [providerInfo]);

  const schemaBlock = useMemo(() => {
    if (!schema || !providerInfo) {
      return null;
    }
    return pickSchemaBlock(schema, providerInfo);
  }, [schema, providerInfo]);

  const fields = useMemo<FieldSpec[]>(() => {
    if (!schemaBlock) {
      return [];
    }
    const attributes = schemaBlock.attributes ?? {};
    const entries: FieldSpec[] = [];
    for (const [name, attribute] of Object.entries(attributes)) {
      const isReadOnly = attribute.computed === true && attribute.optional !== true && attribute.required !== true;
      if (isReadOnly) continue;
      entries.push({
        name,
        input: classifyInput(attribute.type),
        required: attribute.required === true,
        description: attribute.description ?? null,
        configured: block ? findAttributeNode(block, name) !== null : false,
      });
    }
    return entries;
  }, [block, schemaBlock]);

  const visibleFields = useMemo(() => fields.filter((field) => field.required || field.configured), [fields]);
  const optionalHiddenFields = useMemo(() => fields.filter((field) => !field.required && !field.configured), [fields]);
  const defaultValues = useMemo<FormValues>(() => {
    if (!block) {
      return {};
    }
    const values: FormValues = {};
    for (const field of fields) {
      values[field.name] = attributeToDefaultValue(block, field);
    }
    return values;
  }, [block, fields]);

  const baselineRef = useRef<FormValues>(defaultValues);

  const form = useForm<FormValues>({
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    baselineRef.current = defaultValues;
  }, [defaultValues]);

  const applyChanges = useCallback((): void => {
    if (isDisabled) {
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (isApplying) {
      pendingApplyRef.current = true;
      return;
    }
    const submit = form.handleSubmit(async (values: FormValues): Promise<void> => {
      if (!selectedNode) {
        return;
      }
      const updates: Record<string, string> = {};
      const baseline = baselineRef.current;
      for (const field of fields) {
        const currentValue = values[field.name];
        const initialValue = baseline[field.name];
        if (currentValue === undefined) {
          continue;
        }
        if (initialValue !== undefined && currentValue === initialValue) {
          continue;
        }
        const serialized = serializeValue(field, currentValue);
        if (serialized) {
          updates[field.name] = serialized;
        }
      }
      if (Object.keys(updates).length === 0) {
        return;
      }
      setIsApplying(true);
      try {
        await onApply(selectedNode.id, updates);
        baselineRef.current = values;
      } finally {
        setIsApplying(false);
      }
    });
    void submit();
  }, [fields, form, isApplying, isDisabled, onApply, selectedNode]);

  useEffect(() => {
    if (!isApplying && pendingApplyRef.current) {
      pendingApplyRef.current = false;
      applyChanges();
    }
  }, [applyChanges, isApplying]);

  useEffect(() => {
    if (isDisabled) {
      return;
    }
    const subscription = form.watch(() => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        applyChanges();
      }, 1000);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [applyChanges, form, isDisabled]);

  if (!selectedNode) {
    return (
      <ScrollArea className="h-full p-2 pr-4">
        <div className="text-center text-xs text-muted-foreground">
          <p>Select a node to edit its properties</p>
        </div>
      </ScrollArea>
    );
  }

  if (isSchemaLoading) {
    return (
      <ScrollArea className="h-full p-2 pr-4">
        <div className="text-center text-xs text-muted-foreground">
          <p>Loading schema...</p>
        </div>
      </ScrollArea>
    );
  }

  if (schemaError) {
    return (
      <ScrollArea className="h-full p-2 pr-4">
        <div className="space-y-2 text-sm leading-tight">
          <div className="text-xs text-destructive">{schemaError}</div>
        </div>
      </ScrollArea>
    );
  }

  if (!providerInfo || !block || !schemaBlock) {
    return (
      <ScrollArea className="h-full p-2 pr-4">
        <div className="space-y-2 text-sm leading-tight">
          <div className="text-xs text-destructive">This node cannot be edited.</div>
        </div>
      </ScrollArea>
    );
  }

  const renderField = (field: FieldSpec) => (
    <FormField
      control={form.control}
      key={field.name}
      name={field.name}
      render={({ field: controllerField }) => (
        <FormItem className="w-full min-w-0 grid-cols-1 items-start gap-1.5 break-words">
          <FormLabel className="wrap-break-word text-xs font-semibold leading-tight max-w-full break-words min-w-0" title={field.name}>
            {field.name}
            {field.required ? <span className="ml-1 text-destructive">*</span> : null}
          </FormLabel>
          {field.input === "boolean" ? (
            <FormControl className="w-full min-w-0">
              <Switch
                checked={Boolean(controllerField.value)}
                disabled={isDisabled}
                onBlur={applyChanges}
                onCheckedChange={(checked) => controllerField.onChange(checked)}
              />
            </FormControl>
          ) : field.input === "textarea" ? (
            <FormControl className="w-full min-w-0">
              <Textarea
                className="min-h-12 px-2 py-1.5 text-[13px] leading-snug"
                disabled={isDisabled}
                onBlur={applyChanges}
                onChange={(event) => controllerField.onChange(event.target.value)}
                value={String(controllerField.value ?? "")}
              />
            </FormControl>
          ) : (
            <FormControl className="w-full min-w-0">
              <Input
                className="h-7 px-2 py-1 text-[13px]"
                disabled={isDisabled}
                onBlur={applyChanges}
                onChange={(event) => controllerField.onChange(event.target.value)}
                type="text"
                value={typeof controllerField.value === "string" ? controllerField.value : ""}
              />
            </FormControl>
          )}
          {field.description ? (
            <div className="text-[11px] leading-tight text-muted-foreground break-words min-w-0 whitespace-pre-wrap">{field.description}</div>
          ) : null}
          <FormMessage className="text-xs min-w-0 break-words" />
        </FormItem>
      )}
      rules={
        field.input === "number"
          ? {
              validate: (value: string | boolean) => {
                if (typeof value !== "string") {
                  return "Enter a number";
                }
                if (value.trim().length === 0) {
                  return field.required ? "Enter a number" : true;
                }
                return Number.isNaN(Number(value)) ? "Enter a number" : true;
              },
            }
          : {}
      }
    />
  );

  return (
    <ScrollArea className="h-full w-full p-2 pr-4">
      <div className="space-y-2 text-sm leading-tight w-full min-w-0">
        {fields.length === 0 ? (
          <div className="text-xs text-muted-foreground">No editable attributes found.</div>
        ) : (
          <Form {...form}>
            <form
              className="space-y-2 w-full min-w-0"
              onSubmit={(event) => {
                event.preventDefault();
                applyChanges();
              }}
            >
              {visibleFields.length > 0 ? (
                <div className="space-y-1.5 w-full min-w-0">{visibleFields.map((field) => renderField(field))}</div>
              ) : (
                <div className="text-xs text-muted-foreground">No required or configured attributes yet.</div>
              )}
              {optionalHiddenFields.length > 0 ? (
                <Accordion className="w-full min-w-0" key={selectedNode?.id ?? "no-node"}>
                  <AccordionItem className="border-0" value="optional">
                    <AccordionTrigger className="w-full min-w-0 rounded-md border px-3 py-2 text-xs font-medium">
                      <span className="truncate">Optional attributes not set ({optionalHiddenFields.length})</span>
                    </AccordionTrigger>
                    <AccordionContent className="mt-1.5 w-full min-w-0 space-y-1.5 overflow-visible">
                      {optionalHiddenFields.map((field) => renderField(field))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </form>
          </Form>
        )}
      </div>
    </ScrollArea>
  );
}
