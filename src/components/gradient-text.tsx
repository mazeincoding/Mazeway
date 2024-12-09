"use client";

import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GradientText({
  children,
  className,
  ...props
}: GradientTextProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-t from-foreground/50 to-foreground bg-clip-text text-transparent",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
