import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
	GroupChat,
	GroupMessage,
	GroupMember,
	GroupSummary,
} from "@/types";
import { toast } from "@/hooks/use-toast";

/**
 * Hook to manage group chat state and listen for real-time group events
 * from the Tauri backend.
 *
 * Group Chat uses the **Temporary Host** model:
 * - The creator becomes the initial host.
 * - All messages route through the host, which fans them out.
 * - If the host leaves or goes offline, the member with the smallest
 *   device_id is elected as the new host.
 */
export function useGroupChat() {
	const {
		addGroup,
		removeGroup,
		setGroups,
		addGroupMessage,
		setGroupMessages,
		setGroupMembers,
		updateGroupHost,
		localDeviceId,
		isOnboarded,
	} = useAppStore();

	// Helper to get device name
	const getDeviceName = (deviceId: string): string => {
		const devices = useAppStore.getState().devices;
		const device = devices.find((d) => d.device_id === deviceId);
		return device?.display_name || deviceId.slice(0, 8);
	};

	// ── Data Loading ─────────────────────────────────────────────────────────

	/** Load all groups the local device belongs to. */
	const loadGroups = useCallback(async () => {
		if (!localDeviceId) return [];
		try {
			const groups = await invoke<GroupChat[]>("get_groups", {
				localDeviceId,
			});
			setGroups(groups);
			console.log(`👥 Loaded ${groups.length} groups`);
			return groups;
		} catch (error) {
			console.error("Failed to load groups:", error);
			return [];
		}
	}, [localDeviceId, setGroups]);

	/** Load all group summaries (group + members + last message). */
	const loadGroupSummaries = useCallback(async () => {
		if (!localDeviceId) return [];
		try {
			const summaries = await invoke<GroupSummary[]>(
				"get_group_summaries",
				{ localDeviceId },
			);
			// Update store with groups and members from summaries
			for (const summary of summaries) {
				addGroup(summary.group);
				setGroupMembers(summary.group.id, summary.members);
			}
			console.log(`👥 Loaded ${summaries.length} group summaries`);
			return summaries;
		} catch (error) {
			console.error("Failed to load group summaries:", error);
			return [];
		}
	}, [localDeviceId, addGroup, setGroupMembers]);

	/** Load messages for a specific group. */
	const loadGroupMessages = useCallback(
		async (groupId: string) => {
			try {
				const messages = await invoke<GroupMessage[]>(
					"get_group_messages",
					{ groupId },
				);
				setGroupMessages(groupId, messages);
				console.log(
					`📥 Loaded ${messages.length} messages for group ${groupId}`,
				);
				return messages;
			} catch (error) {
				console.error("Failed to load group messages:", error);
				return [];
			}
		},
		[setGroupMessages],
	);

	/** Load members for a specific group. */
	const loadGroupMembers = useCallback(
		async (groupId: string) => {
			try {
				const members = await invoke<GroupMember[]>(
					"get_group_members",
					{ groupId },
				);
				setGroupMembers(groupId, members);
				console.log(
					`👥 Loaded ${members.length} members for group ${groupId}`,
				);
				return members;
			} catch (error) {
				console.error("Failed to load group members:", error);
				return [];
			}
		},
		[setGroupMembers],
	);

	// ── Actions ──────────────────────────────────────────────────────────────

	/** Create a new group. The local device becomes the host. */
	const createGroup = useCallback(
		async (name: string, memberDeviceIds: string[]) => {
			if (!localDeviceId) {
				console.error("Cannot create group: no local device ID");
				return null;
			}
			try {
				// Ensure local device is in the member list
				const allMembers = memberDeviceIds.includes(localDeviceId)
					? memberDeviceIds
					: [localDeviceId, ...memberDeviceIds];

				const group = await invoke<GroupChat>("create_group", {
					name,
					localDeviceId,
					memberDeviceIds: allMembers,
				});
				console.log("👥 Group created:", group.name);
				return group;
			} catch (error) {
				console.error("Failed to create group:", error);
				toast({
					title: "Failed to create group",
					description: String(error),
					variant: "destructive",
				});
				return null;
			}
		},
		[localDeviceId],
	);

	/** Send a text message to a group. */
	const sendGroupMessage = useCallback(
		async (
			groupId: string,
			content: string,
			msgContentType?: string,
			replyTo?: string,
		) => {
			if (!localDeviceId) {
				console.error("Cannot send group message: no local device ID");
				return null;
			}
			try {
				const message = await invoke<GroupMessage>(
					"send_group_message",
					{
						groupId,
						localDeviceId,
						content,
						msgContentType: msgContentType ?? "text",
						replyTo: replyTo ?? null,
					},
				);
				console.log("📤 Group message sent:", message.id);
				// Add to store (the backend also emits group-message-sent)
				addGroupMessage(groupId, message);
				return message;
			} catch (error) {
				console.error("Failed to send group message:", error);
				toast({
					title: "Failed to send message",
					description: String(error),
					variant: "destructive",
				});
				return null;
			}
		},
		[localDeviceId, addGroupMessage],
	);

	/** Add a member to a group (host only). */
	const addMember = useCallback(
		async (groupId: string, newDeviceId: string) => {
			if (!localDeviceId) return;
			try {
				await invoke("add_group_member", {
					groupId,
					newDeviceId,
					localDeviceId,
				});
				console.log(`👥 Added ${newDeviceId} to group ${groupId}`);
			} catch (error) {
				console.error("Failed to add group member:", error);
				toast({
					title: "Failed to add member",
					description: String(error),
					variant: "destructive",
				});
			}
		},
		[localDeviceId],
	);

	/** Remove a member from a group (host only). */
	const removeMember = useCallback(
		async (groupId: string, targetDeviceId: string) => {
			if (!localDeviceId) return;
			try {
				await invoke("remove_group_member", {
					groupId,
					targetDeviceId,
					localDeviceId,
				});
				console.log(
					`👥 Removed ${targetDeviceId} from group ${groupId}`,
				);
			} catch (error) {
				console.error("Failed to remove group member:", error);
				toast({
					title: "Failed to remove member",
					description: String(error),
					variant: "destructive",
				});
			}
		},
		[localDeviceId],
	);

	/** Leave a group. */
	const leaveGroup = useCallback(
		async (groupId: string) => {
			if (!localDeviceId) return;
			try {
				await invoke("leave_group", { groupId, localDeviceId });
				removeGroup(groupId);
				console.log(`👥 Left group ${groupId}`);
				toast({
					title: "Left group",
					description: "You have left the group.",
				});
			} catch (error) {
				console.error("Failed to leave group:", error);
				toast({
					title: "Failed to leave group",
					description: String(error),
					variant: "destructive",
				});
			}
		},
		[localDeviceId, removeGroup],
	);

	/** Disband (delete) a group (host/creator only). */
	const disbandGroup = useCallback(
		async (groupId: string) => {
			if (!localDeviceId) return;
			try {
				await invoke("disband_group", { groupId, localDeviceId });
				removeGroup(groupId);
				console.log(`🗑️ Disbanded group ${groupId}`);
				toast({
					title: "Group disbanded",
					description: "The group has been disbanded.",
				});
			} catch (error) {
				console.error("Failed to disband group:", error);
				toast({
					title: "Failed to disband group",
					description: String(error),
					variant: "destructive",
				});
			}
		},
		[localDeviceId, removeGroup],
	);

	// ── Event Listeners ──────────────────────────────────────────────────────

	useEffect(() => {
		if (!isOnboarded || !localDeviceId) {
			return;
		}

		let unlistenCreated: (() => void) | undefined;
		let unlistenMsgSent: (() => void) | undefined;
		let unlistenMsgReceived: (() => void) | undefined;
		let unlistenMemberAdded: (() => void) | undefined;
		let unlistenMemberRemoved: (() => void) | undefined;
		let unlistenHostChanged: (() => void) | undefined;
		let unlistenDisbanded: (() => void) | undefined;
		let unlistenLeft: (() => void) | undefined;
		let cancelled = false;

		const setupListeners = async () => {
			try {
				// ── Group created ──────────────────────────────────────────
				const _unlistenCreated = await listen<GroupChat>(
					"group-created",
					(event) => {
						console.log("👥 Group created event:", event.payload);
						addGroup(event.payload);
						// Also load members for the new group
						loadGroupMembers(event.payload.id);

						// Show toast if we didn't create it ourselves
						if (event.payload.creator_device_id !== localDeviceId) {
							const creatorName = getDeviceName(
								event.payload.creator_device_id,
							);
							toast({
								title: "Added to group",
								description: `${creatorName} added you to "${event.payload.name}"`,
								duration: 5000,
							});
						}
					},
				);

				// ── Group message sent (by us) ────────────────────────────
				const _unlistenMsgSent = await listen<GroupMessage>(
					"group-message-sent",
					(event) => {
						console.log(
							"📤 Group message sent event:",
							event.payload.id,
						);
						addGroupMessage(event.payload.group_id, event.payload);
					},
				);

				// ── Group message received (from others) ──────────────────
				const _unlistenMsgReceived = await listen<GroupMessage>(
					"group-message-received",
					(event) => {
						console.log(
							"📥 Group message received:",
							event.payload.id,
						);
						addGroupMessage(event.payload.group_id, event.payload);

						// Show toast if the group chat isn't currently open
						const { activeGroupId } = useAppStore.getState();
						if (
							event.payload.from_device_id !== localDeviceId &&
							activeGroupId !== event.payload.group_id
						) {
							const senderName = getDeviceName(
								event.payload.from_device_id,
							);
							const groups = useAppStore.getState().groups;
							const group = groups.find(
								(g) => g.id === event.payload.group_id,
							);
							toast({
								title: group
									? `${senderName} in ${group.name}`
									: senderName,
								description:
									event.payload.content.length > 80
										? event.payload.content.substring(
												0,
												80,
											) + "..."
										: event.payload.content,
								duration: 5000,
							});
						}
					},
				);

				// ── Member added ──────────────────────────────────────────
				const _unlistenMemberAdded = await listen<{
					group_id: string;
					device_id: string;
				}>("group-member-added", (event) => {
					console.log(
						"👥 Member added to group:",
						event.payload.device_id,
					);
					// Reload members from backend to stay in sync
					loadGroupMembers(event.payload.group_id);
				});

				// ── Member removed ────────────────────────────────────────
				const _unlistenMemberRemoved = await listen<{
					group_id: string;
					device_id: string;
				}>("group-member-removed", (event) => {
					console.log(
						"👥 Member removed from group:",
						event.payload.device_id,
					);
					// If we were removed, remove the group from store
					if (event.payload.device_id === localDeviceId) {
						removeGroup(event.payload.group_id);
						toast({
							title: "Removed from group",
							description: "You have been removed from a group.",
							variant: "destructive",
						});
					} else {
						// Reload members
						loadGroupMembers(event.payload.group_id);
					}
				});

				// ── Host changed ──────────────────────────────────────────
				const _unlistenHostChanged = await listen<{
					group_id: string;
					host_device_id: string;
				}>("group-host-changed", (event) => {
					console.log(
						"👑 New host for group:",
						event.payload.host_device_id,
					);
					updateGroupHost(
						event.payload.group_id,
						event.payload.host_device_id,
					);

					if (event.payload.host_device_id === localDeviceId) {
						toast({
							title: "You are now the group host",
							description:
								"The previous host went offline. You are now responsible for routing messages.",
							duration: 5000,
						});
					}
				});

				// ── Group disbanded ───────────────────────────────────────
				const _unlistenDisbanded = await listen<{
					group_id: string;
				}>("group-disbanded", (event) => {
					console.log("🗑️ Group disbanded:", event.payload.group_id);
					removeGroup(event.payload.group_id);
					toast({
						title: "Group disbanded",
						description: "A group you were in has been disbanded.",
						duration: 5000,
					});
				});

				// ── Group left (self) ─────────────────────────────────────
				const _unlistenLeft = await listen<{
					group_id: string;
				}>("group-left", (event) => {
					console.log("👋 Left group:", event.payload.group_id);
					removeGroup(event.payload.group_id);
				});

				if (cancelled) {
					_unlistenCreated();
					_unlistenMsgSent();
					_unlistenMsgReceived();
					_unlistenMemberAdded();
					_unlistenMemberRemoved();
					_unlistenHostChanged();
					_unlistenDisbanded();
					_unlistenLeft();
					return;
				}

				unlistenCreated = _unlistenCreated;
				unlistenMsgSent = _unlistenMsgSent;
				unlistenMsgReceived = _unlistenMsgReceived;
				unlistenMemberAdded = _unlistenMemberAdded;
				unlistenMemberRemoved = _unlistenMemberRemoved;
				unlistenHostChanged = _unlistenHostChanged;
				unlistenDisbanded = _unlistenDisbanded;
				unlistenLeft = _unlistenLeft;

				console.log("✅ Group chat listeners setup complete");
			} catch (error) {
				console.error("Failed to setup group chat listeners:", error);
			}
		};

		setupListeners();

		// Load existing groups on mount
		loadGroups();

		return () => {
			cancelled = true;
			if (unlistenCreated) unlistenCreated();
			if (unlistenMsgSent) unlistenMsgSent();
			if (unlistenMsgReceived) unlistenMsgReceived();
			if (unlistenMemberAdded) unlistenMemberAdded();
			if (unlistenMemberRemoved) unlistenMemberRemoved();
			if (unlistenHostChanged) unlistenHostChanged();
			if (unlistenDisbanded) unlistenDisbanded();
			if (unlistenLeft) unlistenLeft();
			console.log("🧹 Group chat listeners cleaned up");
		};
	}, [isOnboarded, localDeviceId]);

	return {
		// Data loading
		loadGroups,
		loadGroupSummaries,
		loadGroupMessages,
		loadGroupMembers,
		// Actions
		createGroup,
		sendGroupMessage,
		addMember,
		removeMember,
		leaveGroup,
		disbandGroup,
	};
}
