import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      // biome-ignore lint/suspicious/noExplicitAny: React 19 compatibility with fumadocs-ui
      {...({ children } as any)}
    >
      {children}
    </DocsLayout>
  );
}
