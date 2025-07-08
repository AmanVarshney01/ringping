import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	Download,
	Loader2,
	Music,
	Play,
	Plus,
	UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod/v4";
import Loader from "@/components/loader";
import { TimePicker } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();

	useEffect(() => {
		if (!isSessionPending && !session) {
			authClient.signIn
				.anonymous()
				.then(() => {
					console.log("Anonymous user signed in");
				})
				.catch((error) => {
					console.error("Failed to sign in anonymous user:", error);
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
				Math.min(videoInfo.duration - 10, videoInfo.duration * 0.1),
			);
			form.setFieldValue("startSeconds", Math.floor(maxStart));
			form.setFieldValue("endSeconds", Math.floor(maxStart) + 10);
			if (
				form.state.values.fileName === "ringtone" ||
				!form.state.values.fileName
			) {
				form.setFieldValue("fileName", createSafeFileName(videoInfo.title));
			}
		}
	}, [videoInfo]);

	const ringtonesQuery = useQuery(
		orpc.ringtone.getAll.queryOptions({
			enabled: !!session,
		}),
	);

	const videoInfoMutation = useMutation(
		orpc.ringtone.getVideoInfo.mutationOptions({
			onSuccess: (data) => {
				setVideoInfo(data);
				toast.success(`Video found: ${data.title}`);
			},
			onError: (error) => {
				setVideoInfo(null);
				toast.error(error.message);
			},
		}),
	);

	const createMutation = useMutation(
		orpc.ringtone.create.mutationOptions({
			onSuccess: () => {
				if (session?.user.isAnonymous) {
					toast.success(
						"Ringtone created! Check your dashboard to download it.",
					);
				} else {
					toast.success("Ringtone created and saved to your account!");
				}
				queryClient.invalidateQueries({
					queryKey: orpc.ringtone.getAll.queryKey(),
				});
				form.reset();
				setVideoInfo(null);
				setVideoUrl("");
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

	const hmsToSeconds = (s: string) => {
		const [h, m, sec] = s.split(":").map(Number);
		return h * 3600 + m * 60 + sec;
	};

	const form = useForm({
		defaultValues: {
			url: "",
			startSeconds: 0,
			endSeconds: 10,
			fileName: "ringtone",
		},
		onSubmit: async ({ value }) => {
			const durationSeconds = value.endSeconds - value.startSeconds;

			createMutation.mutate({
				url: value.url,
				startSeconds: value.startSeconds,
				durationSeconds,
				fileName: value.fileName,
				videoDuration: videoInfo?.duration,
			});
		},
		validators: {
			onSubmit: z
				.object({
					url: z.string().url("Please enter a valid URL"),
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
						return data.endSeconds > data.startSeconds;
					},
					{
						message: "End time must be after start time",
						path: ["endSeconds"],
					},
				)
				.refine(
					(data) => {
						return data.endSeconds - data.startSeconds <= 60;
					},
					{
						message: "Ringtone duration should be 60 seconds or less",
						path: ["endSeconds"],
					},
				)
				.refine(
					(data) => {
						if (!videoInfo?.duration) return true;
						return data.endSeconds <= videoInfo.duration;
					},
					{
						message: videoInfo?.duration
							? `End time cannot exceed video duration (${secondsToHms(videoInfo.duration)})`
							: "End time exceeds video duration",
						path: ["endSeconds"],
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
				videoInfoMutation.mutate({ url });
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
		<div className="h-full bg-background">
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="mb-12 text-center">
					<div className="mb-4 flex justify-center">
						<Music className="h-8 w-8 text-primary" />
					</div>
					<h1 className="mb-2 font-light text-3xl text-foreground">
						Create Ringtones
					</h1>
					<p className="text-muted-foreground">
						{session && !session.user.isAnonymous
							? `Welcome back, ${session.user.name}`
							: "Create ringtones from any video - free and easy!"}
					</p>
				</div>
				<div className="mb-12 rounded-xl border border-border bg-card p-8 shadow-sm">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						className="space-y-8"
					>
						<form.Field name="url">
							{(field) => (
								<div className="space-y-3">
									<Label htmlFor={field.name} className="font-medium text-base">
										Video URL
									</Label>
									<Input
										id={field.name}
										name={field.name}
										type="url"
										placeholder="https://www.youtube.com/watch?v=..."
										value={videoUrl}
										onBlur={field.handleBlur}
										onChange={(e) => handleUrlChange(e.target.value)}
										className="h-12 text-base"
									/>
									{field.state.meta.errors.map((error) => (
										<p key={error?.message} className="text-red-500 text-sm">
											{error?.message}
										</p>
									))}

									{videoInfoMutation.isPending && (
										<div className="flex items-center space-x-2 text-muted-foreground">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span className="text-sm">Fetching video info...</span>
										</div>
									)}
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
							<div className="space-y-6">
								<div className="flex items-center justify-around gap-4">
									<TimePicker
										label="Start Time"
										value={secondsToHms(form.state.values.startSeconds)}
										onChange={(value) =>
											form.setFieldValue("startSeconds", hmsToSeconds(value))
										}
									/>
									<TimePicker
										label="End Time"
										value={secondsToHms(form.state.values.endSeconds)}
										onChange={(value) =>
											form.setFieldValue("endSeconds", hmsToSeconds(value))
										}
									/>
								</div>
							</div>
						)}

						{videoInfo && (
							<form.Field name="fileName">
								{(field) => (
									<div className="space-y-3">
										<Label
											htmlFor={field.name}
											className="font-medium text-base"
										>
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

				{session && (
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="font-light text-foreground text-xl">
								Your Saved Ringtones
							</h2>
							<Button
								variant="outline"
								onClick={() => navigate({ to: "/dashboard" })}
								className="flex items-center space-x-2"
							>
								<Music className="h-4 w-4" />
								<span>View Dashboard</span>
							</Button>
						</div>

						{ringtonesQuery.isLoading ? (
							<div className="flex justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : ringtonesQuery.data?.length === 0 ? (
							<div className="py-12 text-center">
								<Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
								<p className="text-muted-foreground">
									No saved ringtones yet. Create your first one above!
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{ringtonesQuery.data?.slice(0, 3).map((ringtone) => (
									<div
										key={ringtone.id}
										className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/20"
									>
										<div className="flex items-center space-x-3">
											<Music className="h-5 w-5 text-muted-foreground" />
											<div>
												<p className="font-medium text-foreground">
													{ringtone.fileName}.mp3
												</p>
												<p className="text-muted-foreground text-sm">
													{secondsToHms(
														Number.parseInt(ringtone.startTime, 10),
													)}{" "}
													→{" "}
													{secondsToHms(Number.parseInt(ringtone.endTime, 10))}
												</p>
											</div>
										</div>
										<Button
											variant="outline"
											size="sm"
											asChild
											className="shrink-0"
										>
											<a
												href={`${import.meta.env.VITE_SERVER_URL}${ringtone.downloadUrl}`}
												download
												target="_blank"
												className="flex items-center"
											>
												<Download className="mr-2 h-4 w-4" />
												Download
											</a>
										</Button>
									</div>
								))}
								{ringtonesQuery.data && ringtonesQuery.data.length > 3 && (
									<div className="pt-4 text-center">
										<Button
											variant="outline"
											onClick={() => navigate({ to: "/dashboard" })}
										>
											View All ({ringtonesQuery.data.length}) Ringtones
										</Button>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
