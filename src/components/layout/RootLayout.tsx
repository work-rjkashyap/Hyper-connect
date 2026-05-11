import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppSidebar } from "./Sidebar";
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
import { Toaster } from "@/components/ui/toaster";
import {
	SidebarProvider,
	SidebarTrigger,
	SidebarInset,
	useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Radar from "lucide-react/dist/esm/icons/radar";
import Search from "lucide-react/dist/esm/icons/search";
import Settings from "lucide-react/dist/esm/icons/settings";

const MOBILE_TOP_BAR_HEIGHT = "3.5rem";
const MOBILE_BOTTOM_NAV_HEIGHT = "4rem";

function getMobileShellConfig(pathname: string) {
	const isChatRoute = pathname.startsWith("/chat/");
	const isGroupRoute = pathname.startsWith("/group/");
	const isScreenShareRoute = pathname.startsWith("/screen-share");
	const isSearchRoute = pathname.startsWith("/search");
	const isAiRoute = pathname.startsWith("/ai");
	const isDiscoveryRoute = pathname.startsWith("/discovery");
	const isSettingsRoute = pathname.startsWith("/settings");

	if (isChatRoute || isGroupRoute || isScreenShareRoute) {
		return {
			title: "",
			showTopBar: false,
			showBottomNav: false,
			contentNeedsTopInset: false,
		};
	}

	if (isSearchRoute) {
		return {
			title: "Search",
			showTopBar: false,
			showBottomNav: true,
			contentNeedsTopInset: true,
		};
	}

	if (isAiRoute) {
		return {
			title: "AI Assistant",
			showTopBar: false,
			showBottomNav: true,
			contentNeedsTopInset: true,
		};
	}

	if (isDiscoveryRoute) {
		return {
			title: "Discovery",
			showTopBar: true,
			showBottomNav: true,
			contentNeedsTopInset: false,
		};
	}

	if (isSettingsRoute) {
		return {
			title: "Settings",
			showTopBar: true,
			showBottomNav: true,
			contentNeedsTopInset: false,
		};
	}

	return {
		title: "Chats",
		showTopBar: true,
		showBottomNav: true,
		contentNeedsTopInset: false,
	};
}

function MobileTopBar({ title }: { title: string }) {
	const navigate = useNavigate();

	return (
		<header
			className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/92 backdrop-blur-xl md:hidden"
			style={{
				paddingTop: "var(--safe-area-top, 0px)",
			}}
		>
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center gap-2 min-w-0">
					<SidebarTrigger className="h-9 w-9 rounded-xl border border-border/60 bg-card/70" />
					<div className="min-w-0">
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Hyper Connect
						</p>
						<h1 className="text-sm font-semibold truncate">{title}</h1>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 rounded-xl text-muted-foreground"
					onClick={() => navigate("/search")}
				>
					<Search className="h-4 w-4" />
					<span className="sr-only">Open search</span>
				</Button>
			</div>
		</header>
	);
}

function MobileBottomNav() {
	const navigate = useNavigate();
	const location = useLocation();
	const { setOpenMobile } = useSidebar();

	const items = [
		{
			key: "chats",
			label: "Chats",
			icon: MessageSquare,
			active:
				location.pathname === "/" ||
				location.pathname.startsWith("/chat/") ||
				location.pathname.startsWith("/group/"),
			onClick: () => setOpenMobile(true),
		},
		{
			key: "discovery",
			label: "Discovery",
			icon: Radar,
			active: location.pathname.startsWith("/discovery"),
			onClick: () => navigate("/discovery"),
		},
		{
			key: "search",
			label: "Search",
			icon: Search,
			active:
				location.pathname.startsWith("/search") ||
				location.pathname.startsWith("/ai"),
			onClick: () => navigate("/search"),
		},
		{
			key: "settings",
			label: "Settings",
			icon: Settings,
			active: location.pathname.startsWith("/settings"),
			onClick: () => navigate("/settings"),
		},
	] as const;

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/96 backdrop-blur-2xl"
			style={{ paddingBottom: "var(--safe-area-bottom, 0px)" }}
		>
			<div className="grid h-16 grid-cols-4 px-2">
				{items.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.key}
							onClick={item.onClick}
							className={cn(
								"flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors",
								item.active
									? "text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Icon className="h-4 w-4" />
							<span>{item.label}</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}

function ResponsiveShell() {
	const isMobile = useIsMobile();
	const location = useLocation();
	const shell = getMobileShellConfig(location.pathname);

	if (!isMobile) {
		return (
			<>
				{/* macOS title bar drag region - desktop only */}
				<div
					data-tauri-drag-region
					className="hidden md:block fixed top-0 left-0 right-0 h-8 z-50 pointer-events-auto"
					style={
						{ WebkitAppRegion: "drag" } as React.CSSProperties
					}
				/>

				<AppSidebar />

				<SidebarInset className="flex flex-col h-screen min-h-0 overflow-hidden bg-background">
					<div className="hidden md:block h-8 w-full shrink-0" />
					<NetworkHealthBar />
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
						<Outlet />
					</div>
				</SidebarInset>
			</>
		);
	}

	return (
		<>
			<AppSidebar />
			<div className="relative flex h-[100dvh] w-full flex-1 flex-col overflow-hidden bg-background md:hidden">
				{shell.showTopBar && <MobileTopBar title={shell.title} />}
				<div
					className="flex-1 min-h-0 overflow-hidden"
					style={{
						paddingTop: shell.showTopBar
							? `calc(var(--safe-area-top, 0px) + ${MOBILE_TOP_BAR_HEIGHT})`
							: shell.contentNeedsTopInset
								? "var(--safe-area-top, 0px)"
								: undefined,
						paddingBottom: shell.showBottomNav
							? `calc(${MOBILE_BOTTOM_NAV_HEIGHT} + var(--safe-area-bottom, 0px))`
							: undefined,
					}}
				>
					<Outlet />
				</div>
				{shell.showBottomNav && <MobileBottomNav />}
			</div>
		</>
	);
}

export default function RootLayout() {
	// Initialize device identity first (required for discovery)
	useIdentity();

	// Initialize global discovery, file transfer, messaging, and group chat listeners
	useLanPeers();
	useFileTransfers();
	useMessaging();
	useGroupChat();
	useSecureHandshake();

	return (
		<ThemeProvider>
			<TooltipProvider>
				<SidebarProvider>
					<ResponsiveShell />

					<TransferHUD />
					<HandshakeVerificationDialog />
					<ScreenShareOfferDialog />
					<Toaster />
				</SidebarProvider>
			</TooltipProvider>
		</ThemeProvider>
	);
}
