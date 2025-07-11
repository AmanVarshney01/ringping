import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import Loader from "@/components/loader";
import { RingtonePlayerDialog } from "@/components/ringtone-player-dialog";
import { TimeRangeSlider } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();

	useEffect(() => {
		if (!isSessionPending && !session) {
			authClient.signIn.anonymous({
				fetchOptions: {
					onSuccess: () => {
						toast.success("Anonymous user signed in");
					},
					onError: () => {
						toast.error("Failed to sign in anonymous user");
					},
				},
			});
		}
	}, [session, isSessionPending]);

	const [videoUrl, setVideoUrl] = useState("");
	const [videoInfo, setVideoInfo] = useState<{
		title: string;
		duration: number;
		thumbnail: string | null;
		uploader: string;
	} | null>(null);
	const [showPlayerDialog, setShowPlayerDialog] = useState(false);
	const [activeRingtone, setActiveRingtone] = useState<{
		downloadUrl: string;
		fileName: string;
	} | null>(null);

	const createSafeFileName = (title: string) =>
		title
			.replace(/[<>:"/\\|?*]/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 50) || "ringtone";

	useEffect(() => {
		if (videoInfo) {
			const maxStart = Math.max(
				0,
				Math.min(videoInfo.duration - 30, Math.floor(videoInfo.duration * 0.1)),
			);
			const defaultDuration = Math.min(30, videoInfo.duration - maxStart);

			form.setFieldValue("startSeconds", Math.floor(maxStart));
			form.setFieldValue("endSeconds", Math.floor(maxStart) + defaultDuration);

			if (
				form.state.values.fileName === "ringtone" ||
				!form.state.values.fileName
			) {
				form.setFieldValue("fileName", createSafeFileName(videoInfo.title));
			}
		}
	}, [videoInfo]);

	const videoInfoMutation = useMutation(
		orpc.ringtone.getVideoInfo.mutationOptions(),
	);

	const createMutation = useMutation(
		orpc.ringtone.create.mutationOptions({
			onSuccess: (data) => {
				const fileName = form.state.values.fileName;
				const serverUrl = import.meta.env.VITE_SERVER_URL;
				setActiveRingtone({
					downloadUrl: `${serverUrl}${data.downloadUrl}`,
					fileName,
				});
				setShowPlayerDialog(true);
				queryClient.invalidateQueries({
					queryKey: orpc.ringtone.getAll.queryKey(),
				});
				// form.reset();
				// setVideoInfo(null);
				// setVideoUrl("");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const secondsToHms = (d: number) => {
		const dur = Number(d);
		const h = Math.floor(dur / 3600);
		const m = Math.floor((dur % 3600) / 60);
		const s = Math.floor((dur % 3600) % 60);
		return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	const form = useForm({
		defaultValues: {
			url: "",
			startSeconds: 0,
			endSeconds: 30,
			fileName: "",
		},
		onSubmit: async ({ value }) => {
			const durationSeconds = value.endSeconds - value.startSeconds;
			toast.promise(
				async () =>
					await createMutation.mutateAsync({
						url: value.url,
						startSeconds: value.startSeconds,
						durationSeconds,
						fileName: value.fileName,
						videoDuration: videoInfo?.duration,
					}),
				{
					loading: "Creating ringtone...",
					success: "Ringtone created successfully!",
					error: (error) => `Error creating ringtone: ${error.message}`,
				},
			);
		},
		validators: {
			onSubmit: z
				.object({
					url: z.url("Please enter a valid URL"),
					startSeconds: z.number().min(0, "Start time must be 0 or greater"),
					endSeconds: z.number().min(1, "End time must be greater than 0"),
					fileName: z
						.string()
						.min(1, "File name cannot be empty")
						.max(50, "File name too long")
						.refine((name) => !/[<>:"/\\|?*]/.test(name), {
							message: "File name contains invalid characters",
						}),
				})
				.refine(
					(data) => {
						const duration = data.endSeconds - data.startSeconds;
						return duration >= 5;
					},
					{
						message: "Ringtone must be at least 5 seconds long",
					},
				)
				.refine(
					(data) => {
						const duration = data.endSeconds - data.startSeconds;
						return duration <= 60;
					},
					{
						message: "Ringtone cannot be longer than 60 seconds",
					},
				),
		},
	});

	const handleUrlChange = (url: string) => {
		setVideoUrl(url);
		form.setFieldValue("url", url);

		if (!url.trim()) {
			setVideoInfo(null);
			return;
		}

		try {
			new URL(url);
			const timeoutId = setTimeout(() => {
				toast.promise(
					async () => await videoInfoMutation.mutateAsync({ url }),
					{
						loading: "Fetching video info...",
						success: (data) => {
							setVideoInfo(data);
							return `Video found: ${data.title}`;
						},
						error: (error) => {
							setVideoInfo(null);
							return `Error fetching video info: ${error.message}`;
						},
					},
				);
			}, 500);

			return () => clearTimeout(timeoutId);
		} catch {
			setVideoInfo(null);
		}
	};

	if (isSessionPending) {
		return <Loader />;
	}

	return (
		<div className="h-full">
			<div className="rounded-xl p-8 shadow-sm">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-8"
				>
					<form.Field name="url">
						{(field) => (
							<div className="space-y-3">
								<Input
									id={field.name}
									name={field.name}
									type="url"
									placeholder="https://www.youtube.com/watch?v=..."
									value={videoUrl}
									onBlur={field.handleBlur}
									onChange={(e) => handleUrlChange(e.target.value)}
									className="h-12"
								/>
								{field.state.meta.errors.map((error) => (
									<p key={error?.message} className="text-red-500 text-sm">
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>

					{videoInfo && (
						<div className="rounded-lg border border-border bg-muted/20 p-4">
							<div className="flex items-start space-x-4">
								{videoInfo.thumbnail && (
									<img
										src={videoInfo.thumbnail}
										alt="Video thumbnail"
										className="h-15 w-20 rounded-md object-cover"
									/>
								)}
								<div className="min-w-0 flex-1">
									<div className="mb-2 flex items-center space-x-2">
										<Play className="h-4 w-4 text-primary" />
										<h3 className="truncate font-medium text-foreground">
											{videoInfo.title}
										</h3>
									</div>
									<p className="mb-1 text-muted-foreground text-sm">
										By {videoInfo.uploader}
									</p>
									<p className="font-medium text-primary text-sm">
										Duration: {secondsToHms(videoInfo.duration)}
									</p>
								</div>
							</div>
						</div>
					)}

					{videoInfo && videoInfo.duration < 30 && (
						<div className="flex items-center space-x-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
							<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
							<p className="text-sm text-yellow-800 dark:text-yellow-200">
								This video is quite short ({secondsToHms(videoInfo.duration)}
								). Make sure your ringtone times fit within this duration.
							</p>
						</div>
					)}

					{videoInfo && (
						<TimeRangeSlider
							startTime={form.state.values.startSeconds}
							endTime={form.state.values.endSeconds}
							maxDuration={videoInfo.duration}
							minDuration={5}
							maxAllowedDuration={60}
							onChange={(start, end) => {
								form.setFieldValue("startSeconds", start);
								form.setFieldValue("endSeconds", end);
							}}
						/>
					)}

					{videoInfo && (
						<form.Field name="fileName">
							{(field) => (
								<div className="space-y-3">
									<Label htmlFor={field.name} className="font-medium text-base">
										File Name
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="text"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className="h-12 text-base"
									/>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-red-500 text-sm">
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>
					)}

					<form.Subscribe>
						{(state) => (
							<Button
								type="submit"
								className="h-12 w-full font-medium text-base"
								disabled={
									!state.canSubmit || createMutation.isPending || !videoInfo
								}
							>
								{createMutation.isPending ? (
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
								) : (
									<Plus className="mr-2 h-5 w-5" />
								)}
								{createMutation.isPending
									? "Creating..."
									: session
										? "Create & Save Ringtone"
										: "Create Ringtone"}
							</Button>
						)}
					</form.Subscribe>

					{!videoInfo && videoUrl && !videoInfoMutation.isPending && (
						<p className="text-center text-muted-foreground text-sm">
							Please enter a valid video URL to continue
						</p>
					)}
				</form>
			</div>
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
