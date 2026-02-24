"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/ui/table";

type ArchitectureRow = {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
};

type SortKey = "updatedAt" | "createdAt" | "name" | "sourceType";

type ArchitectureTableProps = {
  architectures: ArchitectureRow[];
};

export function ArchitectureTable({ architectures }: ArchitectureTableProps) {
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(architectures.map((arch) => arch.sourceType).filter(Boolean))).sort();
  }, [architectures]);

  const filteredArchitectures = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = architectures
      .filter((arch) => (sourceType === "all" ? true : arch.sourceType === sourceType))
      .filter((arch) => {
        if (!normalizedQuery) return true;
        return arch.name.toLowerCase().includes(normalizedQuery) || (arch.description ? arch.description.toLowerCase().includes(normalizedQuery) : false);
      });

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortKey === "sourceType") {
        return sortOrder === "asc" ? a.sourceType.localeCompare(b.sourceType) : b.sourceType.localeCompare(a.sourceType);
      }

      const aTime = Date.parse(sortKey === "updatedAt" ? a.updatedAt : a.createdAt);
      const bTime = Date.parse(sortKey === "updatedAt" ? b.updatedAt : b.createdAt);

      if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
        return 0;
      }

      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    return sorted;
  }, [architectures, query, sortKey, sortOrder, sourceType]);

  const formatDateTime = (value: string) => (value ? value : "—");

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder("asc");
  };

  const handleSourceTypeChange = (value: string | null) => {
    setSourceType(value ?? "all");
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return null;
    }
    return sortOrder === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute left-2 top-2 size-4" />
          <Input
            aria-label="Search architectures"
            className="w-full pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter..."
            value={query}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={handleSourceTypeChange} value={sourceType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All Types</SelectItem>
              {sourceOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredArchitectures.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-sm border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="text-muted-foreground text-sm">No architectures found</div>
          <p className="text-muted-foreground text-xs mt-1">Create a new one to get started.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/new">Create New</Link>} size="sm" variant="secondary" />
        </div>
      ) : (
        <div className="rounded-sm border bg-card">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead
                  className="w-[40%] cursor-pointer select-none py-0 pl-4 font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {renderSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead className="w-[30%] py-0 font-medium text-muted-foreground">Description</TableHead>
                <TableHead
                  className="w-[15%] cursor-pointer select-none py-0 font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleSort("sourceType")}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Type</span>
                    {renderSortIcon("sourceType")}
                  </div>
                </TableHead>
                <TableHead
                  className="w-[15%] cursor-pointer select-none py-0 pr-4 text-right font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleSort("updatedAt")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Updated</span>
                    {renderSortIcon("updatedAt")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArchitectures.map((arch) => (
                <TableRow className="group border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer" key={arch.id}>
                  <TableCell className="py-0 pl-4 h-9">
                    <Link
                      className="flex items-center gap-2 w-full h-full text-foreground font-medium group-hover:text-primary transition-colors"
                      href={`/architecture/${arch.id}`}
                    >
                      <span className="truncate">{arch.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-0 h-9 text-muted-foreground truncate max-w-[300px]">{arch.description}</TableCell>
                  <TableCell className="py-0 h-9 text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] uppercase tracking-wider font-semibold">{arch.sourceType}</span>
                  </TableCell>
                  <TableCell className="py-0 pr-4 h-9 text-right text-muted-foreground font-mono text-[11px]">{formatDateTime(arch.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
