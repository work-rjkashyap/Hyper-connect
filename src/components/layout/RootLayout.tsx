import { Outlet } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import Sidebar from './Sidebar';
import { useLanPeers } from '@/hooks/use-lan-peers';
import { useFileTransfers } from '@/hooks/use-file-transfers';

export default function RootLayout() {
    // Initialize global discovery and file transfer listeners
    useLanPeers();
    useFileTransfers();

    return (
        <ThemeProvider>
            <div className="flex w-full h-screen bg-background overflow-hidden">
                {/* macOS title bar drag region */}
                <div
                    data-tauri-drag-region
                    className="fixed top-0 left-0 right-0 h-8 z-[100] pointer-events-auto"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                />

                <Sidebar className="w-80 lg:w-96 border-r" />
                <div className="flex-1 flex flex-col min-w-0">
                    <Outlet />
                </div>
            </div>
        </ThemeProvider>
    );
}
