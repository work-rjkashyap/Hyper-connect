// @ts-nocheck
import { default as __fd_glob_15 } from "../content/getting-started/meta.json?collection=meta"
import { default as __fd_glob_14 } from "../content/features/meta.json?collection=meta"
import { default as __fd_glob_13 } from "../content/deployment/meta.json?collection=meta"
import { default as __fd_glob_12 } from "../content/architecture/meta.json?collection=meta"
import { default as __fd_glob_11 } from "../content/api/meta.json?collection=meta"
import * as __fd_glob_10 from "../content/getting-started/installation.mdx?collection=docs"
import * as __fd_glob_9 from "../content/getting-started/development.mdx?collection=docs"
import * as __fd_glob_8 from "../content/features/messaging.mdx?collection=docs"
import * as __fd_glob_7 from "../content/features/file-transfer.mdx?collection=docs"
import * as __fd_glob_6 from "../content/features/device-discovery.mdx?collection=docs"
import * as __fd_glob_5 from "../content/deployment/building.mdx?collection=docs"
import * as __fd_glob_4 from "../content/architecture/project-structure.mdx?collection=docs"
import * as __fd_glob_3 from "../content/architecture/overview.mdx?collection=docs"
import * as __fd_glob_2 from "../content/api/main-process.mdx?collection=docs"
import * as __fd_glob_1 from "../content/api/ipc-handlers.mdx?collection=docs"
import * as __fd_glob_0 from "../content/index.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.doc("docs", "content", {"index.mdx": __fd_glob_0, "api/ipc-handlers.mdx": __fd_glob_1, "api/main-process.mdx": __fd_glob_2, "architecture/overview.mdx": __fd_glob_3, "architecture/project-structure.mdx": __fd_glob_4, "deployment/building.mdx": __fd_glob_5, "features/device-discovery.mdx": __fd_glob_6, "features/file-transfer.mdx": __fd_glob_7, "features/messaging.mdx": __fd_glob_8, "getting-started/development.mdx": __fd_glob_9, "getting-started/installation.mdx": __fd_glob_10, });

export const meta = await create.meta("meta", "content", {"api/meta.json": __fd_glob_11, "architecture/meta.json": __fd_glob_12, "deployment/meta.json": __fd_glob_13, "features/meta.json": __fd_glob_14, "getting-started/meta.json": __fd_glob_15, });