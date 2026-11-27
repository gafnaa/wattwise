"use client";

import * as React from "react";
import { Blobatar } from "@blobatar/react";

export function UserBlobatar({
  name,
  size = 36,
  shape = "circle",
  className = "",
  title,
}: {
  name: string;
  size?: number;
  shape?: "circle" | "squircle";
  className?: string;
  title?: string;
}) {
  const radiusClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-border/80 ${radiusClass} ${className}`}
      style={{ width: size, height: size }}
      title={title ?? name}
    >
      <Blobatar
        name={name || "wattwise-user"}
        size={size}
        background={shape}
        title={title ?? name}
        className="block size-full"
      />
    </span>
  );
}
