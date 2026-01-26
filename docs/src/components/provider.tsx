'use client'
import SearchDialog from '@/components/search'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { type ReactNode } from 'react'

export function Provider({ children }: { children: ReactNode }): React.ReactElement {
  return <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
}
