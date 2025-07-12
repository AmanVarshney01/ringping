import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import { CustomAudioPlayer } from "@/components/custom-audio-player";
import Loader from "@/components/loader";
import { TimeRangeSlider } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YoutubePlayer } from "@/components/youtube-player";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();

	const [player, setPlayer] = useState<{
		seekTo: (seconds: number) => void;
		playVideo: () => void;
	} | null>(null);

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
	const [videoId, setVideoId] = useState<string | null>(null);
	const [videoInfo, setVideoInfo] = useState<{
		title: string;
		duration: number;
		thumbnail: string | null;
		uploader: string;
	} | null>(null);
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
				queryClient.invalidateQueries({
					queryKey: orpc.ringtone.getAll.queryKey(),
				});
			},
			onError: (err) => {
				toast.error(err.message);
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

			console.log("Form submission - values:", {
				startSeconds: value.startSeconds,
				endSeconds: value.endSeconds,
				durationSeconds,
				fileName: value.fileName,
				videoDuration: videoInfo?.duration,
			});

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
				)
				.refine(
					(data) => {
						if (!videoInfo) return true;
						return data.endSeconds <= videoInfo.duration;
					},
					{
						message: "End time cannot exceed video duration",
					},
				)
				.refine(
					(data) => {
						return data.startSeconds < data.endSeconds;
					},
					{
						message: "Start time must be less than end time",
					},
				),
		},
	});

	function getYouTubeVideoId(url: string): string | null {
		if (!url) return null;
		try {
			const urlObj = new URL(url);
			if (urlObj.hostname === "youtu.be") {
				return urlObj.pathname.slice(1);
			}
			if (
				urlObj.hostname === "www.youtube.com" ||
				urlObj.hostname === "youtube.com"
			) {
				if (urlObj.pathname === "/watch") {
					return urlObj.searchParams.get("v");
				}
				if (urlObj.pathname.startsWith("/embed/")) {
					return urlObj.pathname.split("/")[2];
				}
			}
		} catch (_error) {
			return null;
		}
		return null;
	}

	const handleUrlChange = (url: string) => {
		setVideoUrl(url);
		form.setFieldValue("url", url);
		setVideoId(getYouTubeVideoId(url));

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

	const handleReset = () => {
		form.reset();
		setVideoInfo(null);
		setVideoUrl("");
		setActiveRingtone(null);
	};

	if (isSessionPending) {
		return <Loader />;
	}

	const hasUrl = videoUrl.trim().length > 0;

	return (
		<div className="h-full">
			<div className="">
				{/* Simple Branding - Shows only when no URL */}
				<AnimatePresence>
					{!hasUrl && (
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.5 }}
							className="mb-12 text-center"
						>
							<h1 className="mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text font-bold text-4xl text-transparent">
								RingTone Creator
							</h1>
							<p className="text-lg text-muted-foreground">
								Transform YouTube videos into custom ringtones
							</p>
						</motion.div>
					)}
				</AnimatePresence>

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

					<AnimatePresence>
						{videoInfo && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.4 }}
								className="grid grid-cols-1 gap-8 md:grid-cols-2"
							>
								<div>
									<div className="space-y-4">
										<div className="flex items-center space-x-4">
											{videoInfo.thumbnail && (
												<img
													src={videoInfo.thumbnail}
													alt={videoInfo.title}
													className="h-24 w-40 rounded-lg object-cover"
												/>
											)}
											<div className="flex-1">
												<p className="font-semibold text-lg">
													{videoInfo.title}
												</p>
												<p className="text-muted-foreground text-sm">
													{videoInfo.uploader}
												</p>
												<p className="text-muted-foreground text-sm">
													Duration: {secondsToHms(videoInfo.duration)}
												</p>
											</div>
										</div>
									</div>
									{videoId && (
										<div className="mt-4">
											<YoutubePlayer
												videoId={videoId}
												onReady={(e) => {
													setPlayer(e.target);
												}}
											/>
										</div>
									)}
								</div>

								<div className="space-y-6">
									<form.Field name="fileName">
										{(field) => (
											<div className="space-y-3">
												<Label htmlFor={field.name} className="font-medium">
													Ringtone Name
												</Label>
												<Input
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="My awesome ringtone"
												/>
												{field.state.meta.errors.map((error) => (
													<p
														key={error?.message}
														className="text-red-500 text-sm"
													>
														{error?.message}
													</p>
												))}
											</div>
										)}
									</form.Field>

									<form.Field name="startSeconds">
										{(field) => (
											<TimeRangeSlider
												startTime={field.state.value}
												endTime={form.state.values.endSeconds}
												maxDuration={videoInfo.duration}
												onChange={(start, end) => {
													form.setFieldValue("startSeconds", start);
													form.setFieldValue("endSeconds", end);
													if (player) {
														player.seekTo(start);
														player.playVideo();
													}
												}}
											/>
										)}
									</form.Field>

									<Button
										type="submit"
										className="w-full"
										disabled={
											form.state.isSubmitting ||
											createMutation.isPending ||
											!videoInfo
										}
									>
										{createMutation.isPending ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<Plus className="mr-2 h-4 w-4" />
										)}
										Create Ringtone
									</Button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</form>
			</div>

			<AnimatePresence>
				{activeRingtone && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.4 }}
						className="mt-8"
					>
						<div className="mb-4 flex items-center justify-between">
							<div>
								<h3 className="font-semibold text-lg">
									Your Ringtone is Ready!
								</h3>
								<p className="text-muted-foreground text-sm">
									{activeRingtone.fileName}.mp3
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setActiveRingtone(null)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						<div className="mb-4">
							<CustomAudioPlayer src={activeRingtone.downloadUrl} autoPlay />
						</div>

						<div className="flex gap-3">
							<Button
								onClick={() => {
									const link = document.createElement("a");
									link.href = activeRingtone.downloadUrl;
									link.download = `${activeRingtone.fileName}.mp3`;
									document.body.appendChild(link);
									link.click();
									document.body.removeChild(link);
								}}
								className="flex-1"
							>
								<Download className="mr-2 h-4 w-4" />
								Download Ringtone
							</Button>
							<Button variant="outline" onClick={handleReset}>
								Create Another
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
