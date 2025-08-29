import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "secondary" | "outline" | "default" };
export function Button({ variant = "default", className = "", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium";
  const map: Record<string, string> = {
    default: "bg-neutral-900 text-white border-neutral-900 hover:bg-black",
    secondary: "bg-neutral-100 text-neutral-900 border-neutral-200 hover:bg-neutral-200",
    outline: "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-50"
  };
  return <button className={`${base} ${map[variant]} ${className}`} {...props} />;
}
