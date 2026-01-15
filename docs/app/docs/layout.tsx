import { docs, meta } from '@/source.config';
import { DocsLayout } from 'fumadocs-ui/layout';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <DocsLayout
            tree={docs.pageTree}
            nav={{
                title: 'HyperConnect',
            }}
        >
            {children}
        </DocsLayout>
    );
}
