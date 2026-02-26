import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useScreenShare } from "@/hooks/use-screen-share";
import { useNavigate } from "react-router-dom";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Tv from "lucide-react/dist/esm/icons/tv";

/**
 * Global dialog that appears when a remote device sends a screen share offer.
 *
 * This component should be rendered once in the RootLayout so that it can
 * intercept offers regardless of which page the user is currently viewing.
 * When the user accepts, they are navigated to the screen share page.
 */
export default function ScreenShareOfferDialog() {
	const navigate = useNavigate();
	const { pendingOffer, acceptOffer, rejectOffer } = useScreenShare();

	if (!pendingOffer) {
		return null;
	}

	const handleAccept = async () => {
		await acceptOffer(pendingOffer.session_id);
		// Navigate to the screen share page so the viewer can see the stream
		navigate("/screen-share");
	};

	const handleReject = () => {
		rejectOffer(pendingOffer.session_id);
	};

	const qualityLabel =
		pendingOffer.quality === "low"
			? "Low (720p)"
			: pendingOffer.quality === "high"
				? "High (Native)"
				: "Medium (1080p)";

	return (
		<AlertDialog open={!!pendingOffer} onOpenChange={(open) => {
			if (!open) {
				handleReject();
			}
		}}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2.5">
						<div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 shrink-0">
							<Tv className="h-4.5 w-4.5 text-primary" />
						</div>
						<span>Screen Share Request</span>
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3">
							<p>
								<span className="font-semibold text-foreground">
									{pendingOffer.from_display_name}
								</span>{" "}
								wants to share their screen with you.
							</p>

							<div className="flex flex-wrap gap-2">
								{pendingOffer.screen_width > 0 &&
									pendingOffer.screen_height > 0 && (
										<Badge
											variant="secondary"
											className="text-[10px] gap-1"
										>
											<Monitor className="h-3 w-3" />
											{pendingOffer.screen_width} ×{" "}
											{pendingOffer.screen_height}
										</Badge>
									)}
								<Badge
									variant="secondary"
									className="text-[10px]"
								>
									Quality: {qualityLabel}
								</Badge>
							</div>

							<p className="text-xs text-muted-foreground/80">
								You will be able to view their screen in
								real-time over your local network. You can stop
								viewing at any time.
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={handleReject}>
						Decline
					</AlertDialogCancel>
					<AlertDialogAction onClick={handleAccept}>
						Accept & View
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
