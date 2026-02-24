"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "~/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/ui/table";

type TemplateRow = {
  id: string;
  name: string;
  summary: string;
  provider: string;
  tags: string[];
  createdAt: string;
};

type SortKey = "name" | "provider" | "createdAt";

type TemplateTableProps = {
  templates: TemplateRow[];
};

type FilterBarProps = {
  provider: string;
  providerOptions: string[];
  query: string;
  setProvider: (value: string) => void;
  setQuery: (value: string) => void;
};

export function TemplateTable({ templates }: TemplateTableProps) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const formatDateTime = (value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return "—";
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalizedValue)) {
      return normalizedValue;
    }
    const time = Date.parse(normalizedValue);
    if (Number.isNaN(time)) return normalizedValue;
    return new Date(time).toISOString().slice(0, 19).replace("T", " ");
  };

  const providerOptions = useMemo(() => Array.from(new Set(templates.map((template) => template.provider).filter(Boolean))).sort(), [templates]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const searched = templates
      .filter((template) => (provider === "all" ? true : template.provider === provider))
      .filter((template) => {
        if (!normalizedQuery) return true;
        const haystack = `${template.name} ${template.summary} ${template.tags.join(" ")}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });

    const sorted = [...searched].sort((a, b) => {
      if (sortKey === "name") {
        return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortKey === "provider") {
        return sortOrder === "asc" ? a.provider.localeCompare(b.provider) : b.provider.localeCompare(a.provider);
      }
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    return sorted;
  }, [provider, query, sortKey, sortOrder, templates]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder("asc");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortOrder === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />;
  };

  if (filtered.length === 0) {
    return (
      <div className="space-y-3">
        <FilterBar provider={provider} providerOptions={providerOptions} query={query} setProvider={setProvider} setQuery={setQuery} />
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-sm border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="text-muted-foreground text-sm">No templates found</div>
          <p className="text-muted-foreground text-xs mt-1">Try adjusting your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FilterBar provider={provider} providerOptions={providerOptions} query={query} setProvider={setProvider} setQuery={setQuery} />
      <div className="rounded-sm border bg-card">
        <Table className="text-[12px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead
                className="w-[25%] cursor-pointer select-none py-0 pl-4 font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Template</span>
                  {renderSortIcon("name")}
                </div>
              </TableHead>
              <TableHead className="w-[45%] py-0 font-medium text-muted-foreground">Description</TableHead>
              <TableHead
                className="w-[15%] cursor-pointer select-none py-0 font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toggleSort("provider")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Provider</span>
                  {renderSortIcon("provider")}
                </div>
              </TableHead>
              <TableHead
                className="w-[15%] cursor-pointer select-none py-0 pr-4 text-right font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toggleSort("createdAt")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Created</span>
                  {renderSortIcon("createdAt")}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((template) => (
              <TableRow className="group border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer" key={template.id}>
                <TableCell className="py-0 pl-4 h-9">
                  <div className="flex items-center gap-2">
                    <Link className="truncate font-medium text-foreground group-hover:text-primary transition-colors" href={`/new/templates/${template.id}`}>
                      {template.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="py-0 h-9 text-muted-foreground truncate max-w-[400px]">
                  {template.summary}
                  {template.tags.length > 0 && (
                    <span className="ml-2 inline-flex gap-1 opacity-50">
                      {template.tags.map((tag) => (
                        <span className="text-[10px]" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-0 h-9">
                  <span className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {template.provider}
                  </span>
                </TableCell>
                <TableCell className="py-0 pr-4 h-9 text-right text-muted-foreground font-mono text-[11px]">{formatDateTime(template.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterBar({ provider, providerOptions, query, setProvider, setQuery }: FilterBarProps) {
  const handleProviderChange = (value: string | null) => {
    setProvider(value ?? "all");
  };

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:w-80">
        <Search className="text-muted-foreground pointer-events-none absolute left-2 top-2 size-4" />
        <Input aria-label="Search templates" className="w-full pl-8" onChange={(event) => setQuery(event.target.value)} placeholder="Filter..." value={query} />
      </div>
      <div className="flex items-center gap-2">
        <Select onValueChange={handleProviderChange} value={provider}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All Providers</SelectItem>
            {providerOptions.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
