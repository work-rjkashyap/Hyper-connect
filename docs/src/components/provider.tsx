'use client'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { ReactNode } from 'react'
import SearchDialog from '@/components/search'

export function Provider({ children }: { children: ReactNode }): React.ReactElement {
  return <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
}
