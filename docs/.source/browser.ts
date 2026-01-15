// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/index.mdx?collection=docs"), "api/ipc-handlers.mdx": () => import("../content/api/ipc-handlers.mdx?collection=docs"), "api/main-process.mdx": () => import("../content/api/main-process.mdx?collection=docs"), "architecture/overview.mdx": () => import("../content/architecture/overview.mdx?collection=docs"), "architecture/project-structure.mdx": () => import("../content/architecture/project-structure.mdx?collection=docs"), "deployment/building.mdx": () => import("../content/deployment/building.mdx?collection=docs"), "features/device-discovery.mdx": () => import("../content/features/device-discovery.mdx?collection=docs"), "features/file-transfer.mdx": () => import("../content/features/file-transfer.mdx?collection=docs"), "features/messaging.mdx": () => import("../content/features/messaging.mdx?collection=docs"), "getting-started/development.mdx": () => import("../content/getting-started/development.mdx?collection=docs"), "getting-started/installation.mdx": () => import("../content/getting-started/installation.mdx?collection=docs"), }),
};
export default browserCollections;