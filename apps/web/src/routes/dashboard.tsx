import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Download,
	Edit,
	Loader2,
	Music,
	Play,
	Search,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { RingtonePlayerDialog } from "@/components/ringtone-player-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { secondsToHms } from "@/lib/utils";
import { orpc, queryClient } from "@/utils/orpc";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/dashboard")({
	component: DashboardComponent,
});

function DashboardComponent() {
	const navigate = useNavigate();
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [searchTerm, setSearchTerm] = useState("");
	const [editingRingtone, setEditingRingtone] = useState<{
		id: string;
		fileName: string;
	} | null>(null);
	const [deletingRingtone, setDeletingRingtone] = useState<{
		id: string;
		fileName: string;
	} | null>(null);
	const [editFileName, setEditFileName] = useState("");
	const [showPlayerDialog, setShowPlayerDialog] = useState(false);
	const [activeRingtone, setActiveRingtone] = useState<{
		downloadUrl: string;
		fileName: string;
	} | null>(null);

	const ringtonesQuery = useQuery(
		orpc.ringtone.getAll.queryOptions({
			enabled: !!session,
		}),
	);

	const updateMutation = useMutation(
		orpc.ringtone.update.mutationOptions({
			onSuccess: () => {
				toast.success("Ringtone updated successfully!");
				queryClient.invalidateQueries({
					queryKey: orpc.ringtone.getAll.queryKey(),
				});
				setEditingRingtone(null);
				setEditFileName("");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const deleteMutation = useMutation(
		orpc.ringtone.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Ringtone deleted successfully!");
				queryClient.invalidateQueries({
					queryKey: orpc.ringtone.getAll.queryKey(),
				});
				setDeletingRingtone(null);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	if (!isSessionPending && !session) {
		navigate({ to: "/login" });
		return null;
	}

	const handleEdit = (ringtone: { id: string; fileName: string }) => {
		setEditingRingtone(ringtone);
		setEditFileName(ringtone.fileName);
	};

	const handleEditSubmit = () => {
		if (!editingRingtone || !editFileName.trim()) return;

		updateMutation.mutate({
			id: editingRingtone.id,
			fileName: editFileName.trim(),
		});
	};

	const handleDelete = (ringtone: { id: string; fileName: string }) => {
		setDeletingRingtone(ringtone);
	};

	const confirmDelete = () => {
		if (!deletingRingtone) return;

		deleteMutation.mutate({
			id: deletingRingtone.id,
		});
	};

	const filteredRingtones =
		ringtonesQuery.data?.filter(
			(ringtone) =>
				ringtone.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				ringtone.originalUrl.toLowerCase().includes(searchTerm.toLowerCase()),
		) || [];

	if (isSessionPending) {
		return <Loader />;
	}

	return (
		<div className="grid grid-cols-1">
			<div className="mb-8">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h1 className="mb-2 font-light text-3xl text-foreground">
							Dashboard
						</h1>
						<p className="text-muted-foreground">
							Manage your ringtones, {session?.user.name}
						</p>
					</div>
					<Button
						variant="outline"
						onClick={() => navigate({ to: "/" })}
						className="flex items-center space-x-2"
					>
						<Music className="h-4 w-4" />
						<span>Create New</span>
					</Button>
				</div>

				<div className="relative">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search ringtones by name or URL..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="h-12 pl-10"
					/>
				</div>
			</div>

			<ScrollArea>
				<div>
					{ringtonesQuery.isLoading ? (
						<div className="flex justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : filteredRingtones.length === 0 ? (
						<div className="py-12 text-center">
							<Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
							<p className="text-muted-foreground">
								{searchTerm
									? "No ringtones match your search."
									: "No ringtones yet. Create your first one!"}
							</p>
						</div>
					) : (
						<Table className="w-full">
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Duration</TableHead>
									<TableHead>Source</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredRingtones.map((ringtone) => (
									<TableRow key={ringtone.id}>
										<TableCell className="font-medium">
											<div className="flex items-center space-x-2">
												<Music className="h-4 w-4 text-muted-foreground" />
												<span>{ringtone.fileName}.mp3</span>
											</div>
										</TableCell>
										<TableCell>
											{secondsToHms(ringtone.startTime)} →{" "}
											{secondsToHms(ringtone.endTime)}
										</TableCell>
										<TableCell>
											<a
												href={ringtone.originalUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="block max-w-xs truncate text-blue-600 hover:underline"
											>
												{ringtone.originalUrl}
											</a>
										</TableCell>
										<TableCell>
											{new Date(ringtone.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end space-x-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														const serverUrl =
															import.meta.env.VITE_SERVER_URL ||
															"http://localhost:3000";
														setActiveRingtone({
															downloadUrl: `${serverUrl}${ringtone.downloadUrl}`,
															fileName: ringtone.fileName,
														});
														setShowPlayerDialog(true);
													}}
												>
													<Play className="h-4 w-4" />
												</Button>
												<Button variant="outline" size="sm" asChild>
													<a
														href={`${import.meta.env.VITE_SERVER_URL || "http://localhost:3000"}${ringtone.downloadUrl}`}
														download
														target="_blank"
														className="flex items-center"
													>
														<Download className="h-4 w-4" />
													</a>
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleEdit(ringtone)}
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleDelete(ringtone)}
													className="text-red-600 hover:text-red-700"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>

			<Dialog
				open={!!editingRingtone}
				onOpenChange={(open) => {
					if (!open) {
						setEditingRingtone(null);
						setEditFileName("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Ringtone</DialogTitle>
						<DialogDescription>
							Update the name of your ringtone.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="fileName">File Name</Label>
							<Input
								id="fileName"
								value={editFileName}
								onChange={(e) => setEditFileName(e.target.value)}
								placeholder="Enter new file name"
								className="mt-2"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setEditingRingtone(null);
								setEditFileName("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleEditSubmit}
							disabled={updateMutation.isPending || !editFileName.trim()}
						>
							{updateMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Updating...
								</>
							) : (
								"Update"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!deletingRingtone}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingRingtone(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Ringtone</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{deletingRingtone?.fileName}
							.mp3"? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingRingtone(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDelete}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{activeRingtone && (
				<RingtonePlayerDialog
					isOpen={showPlayerDialog}
					onClose={() => {
						setShowPlayerDialog(false);
						setActiveRingtone(null);
					}}
					audioUrl={activeRingtone.downloadUrl}
					fileName={activeRingtone.fileName}
				/>
			)}
		</div>
	);
}
