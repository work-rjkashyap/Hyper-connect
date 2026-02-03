## Core Rules (always follow)

1. Every `.mdx` file MUST start with YAML frontmatter containing at least `title` and `description`. NEVER add a `# H1` heading — Fumadocs auto-renders `title` as the page `<h1>`.
2. All content lives inside `content/docs/`. The file path IS the URL slug.
3. Every folder needs a `meta.json` to control sidebar ordering and visibility.
4. `<Callout>` works with zero imports. Everything else (Tabs, Accordions, Steps, Cards) needs an import statement at the top of the `.mdx` file OR registration in `mdx-components.tsx`.
5. Internal links between docs pages use relative `.mdx` paths: `[See Guide](./guides/quickstart.mdx)` — only works when `createRelativeLink` is wired in `page.tsx`.
6. Folders wrapped in `()` are slug-transparent: `(shared)/changelog.mdx` → URL is `/docs/changelog`, not `/docs/shared/changelog`.

---

## Folder & File Layout

```
content/
└── docs/
    ├── index.mdx                  →  /docs
    ├── meta.json                  →  root sidebar order
    ├── getting-started.mdx        →  /docs/getting-started
    ├── guides/
    │   ├── meta.json              →  guides sidebar order
    │   ├── index.mdx              →  /docs/guides
    │   ├── quickstart.mdx         →  /docs/guides/quickstart
    │   └── advanced.mdx           →  /docs/guides/advanced
    ├── api/
    │   ├── meta.json
    │   ├── index.mdx              →  /docs/api
    │   └── endpoints.mdx          →  /docs/api/endpoints
    └── (shared)/                  →  slug-transparent group
        └── changelog.mdx          →  /docs/changelog
```

- `index.mdx` inside a folder = that folder's landing page.
- No `meta.json` = alphabetical order, may be hidden from sidebar.

---

## meta.json — Full Reference

### Minimal

```json
{
  "title": "Guides"
}
```

### All Options

```json
{
  "title": "Guides",
  "description": "Step-by-step tutorials",
  "icon": "BookIcon",
  "defaultOpen": true,
  "root": false,
  "pages": [
    "index",
    "quickstart",
    "---Advanced Topics---",
    "...advanced",
    "...",
    "!draft-page",
    "[External Link](https://example.com)"
  ]
}
```

### `pages` Array Tokens

| Token              | What it does                               |
| ------------------ | ------------------------------------------ |
| `"page-name"`      | Include a page (filename, no extension)    |
| `"folder-name"`    | Include a sub-folder                       |
| `"---Label---"`    | Visual section separator with a label      |
| `"..."`            | All remaining pages/folders (alphabetical) |
| `"z...a"`          | Remaining in reverse alphabetical order    |
| `"...folder-name"` | Inline all pages from a sub-folder         |
| `"!page-name"`     | Exclude a page                             |
| `"!folder-name"`   | Exclude a folder                           |
| `"[Text](url)"`    | External link in sidebar                   |

### Sidebar Tabs (`root: true`)

Setting `"root": true` turns a folder into a sidebar tab. Only the active tab shows its contents. Useful for splitting docs into major sections like Framework vs API.

```json
{
  "title": "Framework",
  "root": true
}
```

---

## MDX Page Template

```mdx
---
title: Page Title Here
description: Short description for SEO and sidebar tooltips.
---

## First Section

Your content here. Use ## for top-level sections — never use # (that is reserved).

## Second Section

More content.
```

### Optional Frontmatter Fields

| Field         | Type    | What it does                                 |
| ------------- | ------- | -------------------------------------------- |
| `title`       | string  | Becomes the page `<h1>` and sidebar label    |
| `description` | string  | SEO meta description + sidebar tooltip       |
| `icon`        | string  | Icon name (needs icon handler in `loader()`) |
| `full`        | boolean | Full-width layout, hides inline TOC          |

---

## Headings & TOC

| Syntax                       | Effect                                       |
| ---------------------------- | -------------------------------------------- |
| `## Normal Heading`          | Shows in TOC with auto-generated anchor      |
| `## My Heading [#custom-id]` | Custom anchor ID                             |
| `## Hidden [!toc]`           | Heading renders, but hidden from TOC         |
| `## Phantom [toc]`           | Shows in TOC only, not rendered on page      |
| `[!toc]` on its own line     | Inserts an inline clickable TOC at that spot |

---

## Components

### Callout (no import needed)

```mdx
<Callout>Default info callout.</Callout>

<Callout title="Note">Callout with a title.</Callout>

<Callout title="Warning" type="warn">
  Something risky.
</Callout>

<Callout title="Error" type="error">
  Something broke.
</Callout>

<Callout title="Tip" type="idea">
  A helpful suggestion.
</Callout>
```

`type` values: `note` (default), `warn`, `error`, `idea`.

---

### Tabs

```mdx
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'

<Tabs items={['JavaScript', 'TypeScript', 'Rust']}>
  <Tab value="JavaScript">JS content here.</Tab>
  <Tab value="TypeScript">TS content here.</Tab>
  <Tab value="Rust">Rust content here.</Tab>
</Tabs>
```

**Synced tabs** (stay in sync across the page):

```mdx
<Tabs groupId="language" items={['JS', 'TS']} persist>
  <Tab value="JS">...</Tab>
  <Tab value="TS">...</Tab>
</Tabs>
```

**Code-block shorthand** (no import, just add `tab` to the fence):

````mdx
```js tab="JavaScript"
console.log('hello')
```

```ts tab="TypeScript"
console.log('hello')
```
````

---

### Accordions

```mdx
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'

<Accordions type="single">
  <Accordion title="What is Fumadocs?" id="what-is">
    Fumadocs is a React documentation framework.
  </Accordion>
  <Accordion title="How do I install it?">Run `npm create fumadocs-app`.</Accordion>
</Accordions>
```

`type`: `"single"` = one open at a time. `"multiple"` = all can open.
`id` on an Accordion = auto-opens when the URL hash matches it.

---

### Steps

```mdx
import { Step, Steps } from 'fumadocs-ui/components/steps'

<Steps>
  <Step>### Install Dependencies Run `npm install fumadocs-ui fumadocs-mdx`.</Step>
  <Step>### Configure Source Create `source.config.ts`.</Step>
</Steps>
```

---

### Cards

```mdx
import { Cards, Card } from 'fumadocs-ui/components/card'

<Cards>
  <Card title="Getting Started" href="/docs/getting-started">
    Learn the basics quickly.
  </Card>
  <Card title="API Reference" href="/docs/api">
    Full API documentation.
  </Card>
</Cards>
```

---

### Code Blocks

Language tag on the fence = syntax highlighting (powered by Shiki).

````mdx
```typescript
const greeting: string = 'Hello, Fumadocs!'
console.log(greeting)
```
````

**Twoslash** — inline TypeScript type info:

````mdx
```ts twoslash
const x = 'hello' // hover to see type
```
````

**Line decorations** — highlight added/removed lines:

````mdx
```ts
console.log('Hello World')
;[!code++]
const added = true
;[!code--]
const removed = true
```
````

---

### Other Built-ins

**Include / embed another file:**

```mdx
<include>./shared-warning.mdx</include>
```

**Zoomable image (lightbox):**

```mdx
import { ZoomableImage } from 'fumadocs-ui/components/zoomable-image'

<ZoomableImage src="/diagram.png" alt="Architecture diagram" />
```

**Auto-generate a props table from a TypeScript type:**

```mdx
<auto-type-table path="./types.ts" name="ButtonProps" />
```

**npm install block (renders npm / pnpm / yarn / bun tabs automatically):**

```mdx
<npm-install package="fumadocs-ui" />
```

---

## Next.js Boilerplate Files

### Project Structure

```
project-root/
├── content/docs/                  ← all .mdx content
├── src/
│   ├── app/
│   │   ├── layout.tsx             ← RootProvider wrapper
│   │   ├── layout.config.tsx      ← shared nav config
│   │   ├── docs/
│   │   │   ├── layout.tsx         ← DocsLayout + sidebar
│   │   │   └── [[...slug]]/
│   │   │       └── page.tsx       ← dynamic page renderer
│   │   └── api/search/
│   │       └── route.ts           ← search API (Orama)
│   ├── lib/
│   │   └── source.ts              ← loader() config
│   └── mdx-components.tsx         ← global component registry
├── source.config.ts               ← Fumadocs MDX collections
├── next.config.ts                 ← createMDX() plugin
└── tailwind.config.ts             ← fumadocs-ui/tailwind-plugin
```

### source.config.ts

```typescript
import { defineConfig } from 'fumadocs-mdx/config'

export default defineConfig({
  // extend frontmatter schema, plugins, etc.
})
```

### src/lib/source.ts

```typescript
import { docs } from '../.source' // auto-generated
import { loader } from 'fumadocs-core/source'

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource()
})
```

### src/app/layout.config.tsx

```typescript
import { BookIcon } from 'lucide-react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'My Docs',
    },
    links: [
      { icon: <BookIcon />, text: 'Blog', url: '/blog' },
    ],
  };
}
```

### src/app/docs/layout.tsx

```typescript
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
```

### src/app/docs/[[...slug]]/page.tsx

```typescript
import { source } from '@/lib/source';
import { DocsPage, DocsTitle, DocsDescription, DocsBody } from 'fumadocs-ui/page';
import { getMDXComponents } from '../../../../mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { notFound } from 'next/navigation';

export default async function Page(props) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({
          a: createRelativeLink(source, page),
        })} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}
```

### src/mdx-components.tsx

```typescript
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import { Cards, Card } from 'fumadocs-ui/components/card'
import type { MDXComponents } from 'mdx/types'

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Step,
    Steps,
    Tab,
    Tabs,
    Cards,
    Card,
    ...components
  }
}
```
