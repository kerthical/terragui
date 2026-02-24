"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { cn } from "~/ui/utils";

function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: SliderPrimitive.Root.Props) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );
  const valueProps = value === undefined ? {} : { value };
  const defaultValueProps = defaultValue === undefined ? {} : { defaultValue };

  return (
    <SliderPrimitive.Root
      className="data-horizontal:w-full data-vertical:h-full"
      data-slot="slider"
      max={max}
      min={min}
      thumbAlignment="edge"
      {...defaultValueProps}
      {...valueProps}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "data-vertical:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col",
          className,
        )}
      >
        <SliderPrimitive.Track
          className="bg-muted rounded-md data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3 relative overflow-hidden select-none"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator className="bg-primary select-none data-horizontal:h-full data-vertical:w-full" data-slot="slider-range" />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => {
          const thumbKey = _values[index] ?? 0;
          return (
            <SliderPrimitive.Thumb
              className="border-primary ring-ring/30 size-4 rounded-md border bg-white shadow-sm transition-colors hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
              data-slot="slider-thumb"
              key={String(thumbKey)}
            />
          );
        })}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
