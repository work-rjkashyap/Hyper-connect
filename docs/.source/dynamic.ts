import { dynamic } from 'fumadocs-mdx/runtime/dynamic'
import * as Config from '../source.config'

await dynamic<
  typeof Config,
  import('fumadocs-mdx/runtime/types').InternalTypeConfig & {
    DocData: Record<string, never>
  }
>(
  Config,
  { configPath: 'source.config.ts', environment: 'next', outDir: '.source' },
  { doc: { passthroughs: ['extractedReferences'] } }
)
