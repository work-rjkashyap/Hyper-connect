"use client";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import SearchDialog from "@/components/search";

export function Provider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  // biome-ignore lint/suspicious/noExplicitAny: React 19 compatibility with fumadocs-ui
  return <RootProvider {...({ search: { SearchDialog }, children } as any)} />;
}
