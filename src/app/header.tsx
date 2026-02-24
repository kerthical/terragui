"use client";

import { ArrowLeft, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Button } from "~/ui/button";

type HeaderProps = {
  backHref?: string;
  title?: string;
  actions?: ReactNode;
};

export function Header({ backHref, title, actions }: HeaderProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const normalizedTheme = theme === "light" || theme === "dark" ? theme : resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : "dark";
  const nextTheme: "light" | "dark" = normalizedTheme === "dark" ? "light" : "dark";

  return (
    <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-4 select-none">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Button
            className="h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
            nativeButton={false}
            render={
              <Link href={backHref}>
                <ArrowLeft className="size-4" />
              </Link>
            }
            size="icon-sm"
            variant="ghost"
          />
        )}
        {title && <h1 className="truncate text-[13px] font-semibold tracking-wide text-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button
          aria-label={normalizedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="h-7 w-7 rounded-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:cursor-pointer disabled:cursor-not-allowed"
          onClick={() => setTheme(nextTheme)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {normalizedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
