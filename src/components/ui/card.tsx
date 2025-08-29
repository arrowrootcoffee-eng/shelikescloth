import React from "react";

export function Card({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded-2xl bg-white shadow ${className}`}>{children}</div>;
}
export function CardContent({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={className}>{children}</div>;
}
