import { formSchema } from "@ringping/types";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type z from "zod";
import { CustomAudioPlayer } from "@/components/custom-audio-player";
import Loader from "@/components/loader";
import { TimeRangeSlider } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
				const audioFormat = form.state.values.audioFormat;
				const serverUrl = import.meta.env.VITE_SERVER_URL;
				setActiveRingtone({
					downloadUrl: `${serverUrl}${data.downloadUrl}`,
					fileName: `${fileName}.${audioFormat}`,
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

	const defaultValues: z.Infer<typeof formSchema> = {
		url: "",
		startSeconds: 0,
		endSeconds: 30,
		fileName: "",
		audioFormat: "mp3",
		audioQuality: "192K",
	};

	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			const durationSeconds = value.endSeconds - value.startSeconds;

			console.log("Form submission - values:", {
				startSeconds: value.startSeconds,
				endSeconds: value.endSeconds,
				durationSeconds,
				fileName: value.fileName,
				audioFormat: value.audioFormat,
				audioQuality: value.audioQuality,
				videoDuration: videoInfo?.duration,
			});

			toast.promise(
				async () =>
					await createMutation.mutateAsync({
						url: value.url,
						startSeconds: value.startSeconds,
						durationSeconds,
						fileName: value.fileName,
						audioFormat: value.audioFormat,
						audioQuality: value.audioQuality,
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
			onChange: formSchema,
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

	// const hasUrl = videoUrl.trim().length > 0;

	return (
		<div className="h-full">
			<div className="">
				<AnimatePresence>
					{!videoInfo && (
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
					<form.Field
						name="url"
						asyncDebounceMs={500}
						validators={{
							onChange: ({ value }) =>
								!value
									? "URL is required"
									: !/^https?:\/\/.+/.test(value)
										? "Please enter a valid URL"
										: undefined,
						}}
					>
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
								{!field.state.meta.isValid && (
									<em role="alert">{field.state.meta.errors.join(", ")}</em>
								)}
							</div>
						)}
					</form.Field>
					<AnimatePresence>
						{videoInfo && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.2, delay: 0.5 }}
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
									<form.Field
										name="fileName"
										validators={{
											onChange: ({ value }) =>
												!value
													? "File name is required"
													: value.length > 50
														? "File name too long"
														: /[<>:"/\\|?*]/.test(value)
															? "File name contains invalid characters"
															: undefined,
										}}
									>
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
											</div>
										)}
									</form.Field>

									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<form.Field
											name="audioFormat"
											validators={{
												onChange: ({ value }) =>
													![
														"mp3",
														"aac",
														"flac",
														"m4a",
														"opus",
														"vorbis",
														"wav",
													].includes(value)
														? "Please select a valid audio format"
														: undefined,
											}}
										>
											{(field) => (
												<div className="space-y-3">
													<Label htmlFor={field.name} className="font-medium">
														Audio Format
													</Label>
													<Select
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(
																value as typeof field.state.value,
															)
														}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select format" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="mp3">MP3</SelectItem>
															<SelectItem value="aac">AAC</SelectItem>
															<SelectItem value="flac">FLAC</SelectItem>
															<SelectItem value="m4a">M4A</SelectItem>
															<SelectItem value="opus">Opus</SelectItem>
															<SelectItem value="vorbis">Vorbis</SelectItem>
															<SelectItem value="wav">WAV</SelectItem>
														</SelectContent>
													</Select>
												</div>
											)}
										</form.Field>

										<form.Field
											name="audioQuality"
											validators={{
												onChange: ({ value }) =>
													!value ? "Audio quality is required" : undefined,
											}}
										>
											{(field) => (
												<div className="space-y-3">
													<Label htmlFor={field.name} className="font-medium">
														Audio Quality
													</Label>
													<Select
														value={field.state.value}
														onValueChange={(value) => field.handleChange(value)}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select quality" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="0">Best (0)</SelectItem>
															<SelectItem value="1">Excellent (1)</SelectItem>
															<SelectItem value="2">Very Good (2)</SelectItem>
															<SelectItem value="3">Good (3)</SelectItem>
															<SelectItem value="4">Fair (4)</SelectItem>
															<SelectItem value="5">Average (5)</SelectItem>
															<SelectItem value="6">
																Below Average (6)
															</SelectItem>
															<SelectItem value="7">Poor (7)</SelectItem>
															<SelectItem value="8">Very Poor (8)</SelectItem>
															<SelectItem value="9">Worst (9)</SelectItem>
															<SelectItem value="10">Lowest (10)</SelectItem>
															<SelectItem value="64K">64K</SelectItem>
															<SelectItem value="128K">128K</SelectItem>
															<SelectItem value="192K">
																192K (Default)
															</SelectItem>
															<SelectItem value="256K">256K</SelectItem>
															<SelectItem value="320K">320K</SelectItem>
														</SelectContent>
													</Select>
												</div>
											)}
										</form.Field>
									</div>

									<form.Field
										name="startSeconds"
										validators={{
											onChange: ({ value }) => {
												const endTime = form.state.values.endSeconds;
												const duration = endTime - value;
												return value < 0
													? "Start time must be 0 or greater"
													: duration < 5
														? "Duration must be at least 5 seconds"
														: duration > 60
															? "Duration cannot exceed 60 seconds"
															: videoInfo && value >= videoInfo.duration
																? "Start time cannot exceed video duration"
																: undefined;
											},
										}}
									>
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
									{activeRingtone.fileName}
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
									link.download = activeRingtone.fileName;
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
