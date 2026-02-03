// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser'
import type * as Config from '../source.config'

const create = browser<
  typeof Config,
  import('fumadocs-mdx/runtime/types').InternalTypeConfig & {
    DocData: {}
  }
>()
const browserCollections = {
  docs: create.doc('docs', {
    'components.mdx': () => import('../content/docs/components.mdx?collection=docs'),
    'index.mdx': () => import('../content/docs/index.mdx?collection=docs'),
    'getting-started/installation.mdx': () =>
      import('../content/docs/getting-started/installation.mdx?collection=docs'),
    'getting-started/quick-start.mdx': () =>
      import('../content/docs/getting-started/quick-start.mdx?collection=docs'),
    'guides/configuration.mdx': () =>
      import('../content/docs/guides/configuration.mdx?collection=docs'),
    'guides/troubleshooting.mdx': () =>
      import('../content/docs/guides/troubleshooting.mdx?collection=docs')
  })
}
export default browserCollections
