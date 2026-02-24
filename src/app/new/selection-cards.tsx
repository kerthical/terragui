import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function SelectionCards({
  options,
}: {
  options: {
    id: string;
    title: string;
    description: string;
    href: string;
    icon?: LucideIcon;
  }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-1">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Link
            className="group flex items-center gap-3 rounded-sm border border-transparent px-3 py-2 text-foreground transition-all hover:bg-muted hover:border-border/50 focus:bg-muted focus:outline-none"
            href={option.href}
            key={option.id}
          >
            {Icon && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground group-hover:bg-background group-hover:text-primary transition-colors">
                <Icon className="size-4" />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <div className="text-[13px] font-medium leading-none group-hover:text-primary transition-colors">{option.title}</div>
              <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{option.description}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
