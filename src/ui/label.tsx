"use client";

import type * as React from "react";

import { cn } from "~/ui/utils";

function Label({ className, htmlFor, children, ...props }: React.ComponentProps<"label">) {
  const classes = cn(
    "gap-2 text-xs/relaxed leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
    className,
  );

  if (htmlFor) {
    return (
      <label className={classes} data-slot="label" htmlFor={htmlFor} {...props}>
        {children}
      </label>
    );
  }

  return (
    <span className={classes} data-slot="label" {...props}>
      {children}
    </span>
  );
}

export { Label };
