import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import Sidebar from "./Sidebar";
import NetworkHealthBar from "@/components/network/NetworkHealthBar";
import TransferHUD from "@/components/network/TransferHUD";
import HandshakeVerificationDialog from "@/components/network/HandshakeVerificationDialog";
import ScreenShareOfferDialog from "@/components/screen-share/ScreenShareOfferDialog";
import { useIdentity } from "@/hooks/use-identity";
import { useLanPeers } from "@/hooks/use-lan-peers";
import { useFileTransfers } from "@/hooks/use-file-transfers";
import { useMessaging } from "@/hooks/use-messaging";
import { useGroupChat } from "@/hooks/use-group-chat";
import { useSecureHandshake } from "@/hooks/use-secure-handshake";
import { useMobileNav } from "@/hooks/use-mobile-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import Menu from "lucide-react/dist/esm/icons/menu";

export default function RootLayout() {
	// Initialize device identity first (required for discovery)
	useIdentity();

	// Initialize global discovery, file transfer, messaging, and group chat listeners
	useLanPeers();
	useFileTransfers();
	useMessaging();
	useGroupChat();
	useSecureHandshake();

	const { isOpen, setIsOpen, isMobile } = useMobileNav();

	return (
		<ThemeProvider>
			<div className="flex w-full h-screen bg-background overflow-hidden">
				{/* macOS title bar drag region - desktop only */}
				<div
					data-tauri-drag-region
					className="hidden md:block fixed top-0 left-0 right-0 h-8 z-50 pointer-events-auto"
					style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
				/>

				{/* Desktop Sidebar - always render, Tailwind media queries hide/show */}
				<Sidebar
					className={cn(
						"w-80 lg:w-96 border-r",
						isMobile && "hidden",
					)}
				/>

				{/* Mobile Drawer Sidebar */}
				{isMobile && (
					<Sheet open={isOpen} onOpenChange={setIsOpen}>
						<SheetTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="fixed left-4 z-40 h-10 w-10"
								style={{
									top: "calc(1rem + var(--safe-area-top, 0px))",
								}}
							>
								<Menu className="h-5 w-5" />
								<span className="sr-only">
									Toggle navigation menu
								</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-72 p-0">
							<Sidebar
								className="border-0"
								onClose={() => setIsOpen(false)}
							/>
						</SheetContent>
					</Sheet>
				)}

				<div className="flex-1 flex flex-col min-w-0">
					{/* macOS title bar spacer for the content area */}
					<div className="hidden md:block h-8 w-full shrink-0" />
					<NetworkHealthBar />
					<Outlet />
				</div>
			</div>
			<TransferHUD />
			<HandshakeVerificationDialog />
			<ScreenShareOfferDialog />
			<Toaster />
		</ThemeProvider>
	);
}
