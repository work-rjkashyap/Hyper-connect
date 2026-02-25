import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store";
import { useGroupChat } from "@/hooks/use-group-chat";
import { cn } from "@/lib/utils";
import Users from "lucide-react/dist/esm/icons/users";
import Plus from "lucide-react/dist/esm/icons/plus";
import Crown from "lucide-react/dist/esm/icons/crown";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Laptop from "lucide-react/dist/esm/icons/laptop";

interface CreateGroupDialogProps {
	trigger?: React.ReactNode;
}

function getPlatformIcon(platform: string) {
	const p = platform.toLowerCase();
	if (p.includes("android") || p.includes("ios") || p.includes("mobile")) {
		return <Smartphone className="h-4 w-4 text-muted-foreground" />;
	}
	if (p.includes("laptop") || p.includes("mac")) {
		return <Laptop className="h-4 w-4 text-muted-foreground" />;
	}
	return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

export default function CreateGroupDialog({ trigger }: CreateGroupDialogProps) {
	const [open, setOpen] = useState(false);
	const [groupName, setGroupName] = useState("");
	const [selectedDevices, setSelectedDevices] = useState<Set<string>>(
		new Set(),
	);
	const [isCreating, setIsCreating] = useState(false);

	const devices = useAppStore((state) => state.devices);
	const localDeviceId = useAppStore((state) => state.localDeviceId);
	const approvedDevices = useAppStore((state) => state.approvedDevices);
	const { createGroup } = useGroupChat();

	// Only show devices that we've approved (started chat with)
	const availableDevices = devices.filter(
		(d) =>
			d.device_id !== localDeviceId &&
			approvedDevices.includes(d.device_id),
	);

	const toggleDevice = (deviceId: string) => {
		setSelectedDevices((prev) => {
			const next = new Set(prev);
			if (next.has(deviceId)) {
				next.delete(deviceId);
			} else {
				next.add(deviceId);
			}
			return next;
		});
	};

	const handleCreate = async () => {
		if (!groupName.trim() || selectedDevices.size === 0) return;

		setIsCreating(true);
		try {
			const result = await createGroup(
				groupName.trim(),
				Array.from(selectedDevices),
			);
			if (result) {
				setOpen(false);
				resetForm();
			}
		} finally {
			setIsCreating(false);
		}
	};

	const resetForm = () => {
		setGroupName("");
		setSelectedDevices(new Set());
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (!newOpen) {
			resetForm();
		}
	};

	const isValid = groupName.trim().length > 0 && selectedDevices.size > 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger || (
					<Button
						variant="outline"
						size="sm"
						className="gap-2"
					>
						<Plus className="h-4 w-4" />
						New Group
					</Button>
				)}
			</DialogTrigger>

			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Create Group Chat
					</DialogTitle>
					<DialogDescription>
						Create a group to chat with multiple devices at once.
						You'll be the group host.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Group Name */}
					<div className="space-y-2">
						<Label htmlFor="group-name">Group Name</Label>
						<Input
							id="group-name"
							placeholder="e.g. Office Team, Home Devices"
							value={groupName}
							onChange={(e) => setGroupName(e.target.value)}
							maxLength={50}
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter" && isValid) {
									handleCreate();
								}
							}}
						/>
						<p className="text-xs text-muted-foreground">
							{groupName.length}/50 characters
						</p>
					</div>

					{/* Device Selection */}
					<div className="space-y-2">
						<Label>
							Select Members{" "}
							<span className="text-muted-foreground font-normal">
								({selectedDevices.size} selected)
							</span>
						</Label>

						{availableDevices.length === 0 ? (
							<div className="rounded-md border border-dashed p-4 text-center">
								<p className="text-sm text-muted-foreground">
									No approved devices available.
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Start a chat with devices from the Discovery
									page first.
								</p>
							</div>
						) : (
							<ScrollArea className="h-[200px] rounded-md border">
								<div className="p-2 space-y-1">
									{/* Show local device as host (non-removable) */}
									<div className="flex items-center gap-3 px-3 py-2 rounded-md bg-accent/50">
										<div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
											<Crown className="h-4 w-4 text-primary" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">
												You (Host)
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{localDeviceId?.slice(0, 8)}...
											</p>
										</div>
										<span className="text-xs text-primary font-medium">
											Host
										</span>
									</div>

									{/* Available devices */}
									{availableDevices.map((device) => {
										const isSelected = selectedDevices.has(
											device.device_id,
										);
										return (
											<label
												key={device.device_id}
												className={cn(
													"flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
													isSelected
														? "bg-accent"
														: "hover:bg-accent/50",
												)}
											>
												<Checkbox
													checked={isSelected}
													onCheckedChange={() =>
														toggleDevice(
															device.device_id,
														)
													}
												/>
												<div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
													{getPlatformIcon(
														device.platform,
													)}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium truncate">
														{device.display_name}
													</p>
													<p className="text-xs text-muted-foreground truncate">
														{device.platform} •{" "}
														{device.device_id.slice(
															0,
															8,
														)}
														...
													</p>
												</div>
											</label>
										);
									})}
								</div>
							</ScrollArea>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!isValid || isCreating}
						className="gap-2"
					>
						{isCreating ? (
							<>
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
								Creating...
							</>
						) : (
							<>
								<Users className="h-4 w-4" />
								Create Group ({selectedDevices.size + 1})
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
