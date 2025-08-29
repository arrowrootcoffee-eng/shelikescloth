import React from "react";
export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-12 text-lg rounded-xl border px-3 w-full ${className}`} {...props} />;
}
