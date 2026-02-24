"use client";

import * as React from "react";
import { Controller, type ControllerProps, type FieldPath, type FieldValues, FormProvider, type FormProviderProps } from "react-hook-form";

function Form<TFieldValues extends FieldValues>(props: FormProviderProps<TFieldValues>) {
  return <FormProvider {...props} />;
}

function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(props: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  return <div className={className} ref={ref} {...props} />;
});

FormItem.displayName = "FormItem";

function FormLabel({ className, htmlFor, children, ...props }: React.ComponentProps<"label">) {
  if (htmlFor) {
    return (
      <label className={className} htmlFor={htmlFor} {...props}>
        {children}
      </label>
    );
  }
  return (
    <span className={className} {...props}>
      {children}
    </span>
  );
}

const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  return <div className={className} ref={ref} {...props} />;
});

FormControl.displayName = "FormControl";

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, children, ...props }, ref) => {
  if (!children) {
    return null;
  }
  return (
    <p className={className} ref={ref} {...props}>
      {children}
    </p>
  );
});

FormMessage.displayName = "FormMessage";

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage };
