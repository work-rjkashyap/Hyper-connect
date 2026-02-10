import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { HyperconnectLogo } from "@/components/logo";
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <HyperconnectLogo style={{ width: 24, height: 24 }} />,
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
      },
      {
        text: "GitHub",
        url: "https://github.com/work-rjkashyap/Hyper-connect",
      },
      {
        text: "Twitter",
        url: "https://twitter.com",
      },
    ],
    githubUrl: "https://github.com/work-rjkashyap/Hyper-connect",
    themeSwitch: {
      enabled: true,
    },
  };
}
