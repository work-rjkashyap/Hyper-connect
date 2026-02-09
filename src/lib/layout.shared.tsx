import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "HYPERCONNECT",
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
