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

	const [videoUrl, setVideoUrl] = useState("");
	const [videoInfo, setVideoInfo] = useState<{
		title: string;
		duration: number;
		thumbnail: string | null;
		uploader: string;
	} | null>(null);

	useEffect(() => {
		if (!isSessionPending && !session) {
			navigate({ to: "/login" });
		}
	}, [isSessionPending, session, navigate]);

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
				toast.success("Ringtone created successfully!");
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

	const convertTimeStringToSeconds = (timeString: string) => {
		const [hours, minutes, seconds] = timeString.split(":").map(Number);
		return hours * 3600 + minutes * 60 + seconds;
	};

	const formatDuration = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	const form = useForm({
		defaultValues: {
			url: "",
			startTime: "00:00:00",
			endTime: "00:00:10",
			fileName: "ringtone",
		},
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				...value,
				videoDuration: videoInfo?.duration,
			});
		},
		validators: {
			onSubmit: z
				.object({
					url: z.string().url("Please enter a valid URL"),
					startTime: z
						.string()
						.regex(
							/^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/,
							"Invalid time format (HH:MM:SS)",
						),
					endTime: z
						.string()
						.regex(
							/^([0-9]{2}):([0-5][0-9]):([0-5][0-9])$/,
							"Invalid time format (HH:MM:SS)",
						),
					fileName: z
						.string()
						.min(1, "File name cannot be empty")
						.refine((name) => !/[<>:"/\\|?*]/.test(name), {
							message: "File name contains invalid characters",
						}),
				})
				.refine(
					(data) => {
						const startSeconds = convertTimeStringToSeconds(data.startTime);
						const endSeconds = convertTimeStringToSeconds(data.endTime);
						return endSeconds > startSeconds;
					},
					{
						message: "End time must be after start time",
						path: ["endTime"],
					},
				)
				.refine(
					(data) => {
						const startSeconds = convertTimeStringToSeconds(data.startTime);
						const endSeconds = convertTimeStringToSeconds(data.endTime);
						return endSeconds - startSeconds <= 60;
					},
					{
						message: "Ringtone duration should be 60 seconds or less",
						path: ["endTime"],
					},
				)
				.refine(
					(data) => {
						if (!videoInfo?.duration) return true;
						const endSeconds = convertTimeStringToSeconds(data.endTime);
						return endSeconds <= videoInfo.duration;
					},
					{
						message: videoInfo?.duration
							? `End time cannot exceed video duration (${formatDuration(videoInfo.duration)})`
							: "End time exceeds video duration",
						path: ["endTime"],
					},
				)
				.refine(
					(data) => {
						if (!videoInfo?.duration) return true;
						const startSeconds = convertTimeStringToSeconds(data.startTime);
						return startSeconds <= videoInfo.duration;
					},
					{
						message: videoInfo?.duration
							? `Start time cannot exceed video duration (${formatDuration(videoInfo.duration)})`
							: "Start time exceeds video duration",
						path: ["startTime"],
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

	if (isSessionPending || !session) {
		return <Loader />;
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="mb-12 text-center">
					<div className="mb-4 flex justify-center">
						<Music className="h-8 w-8 text-primary" />
					</div>
					<h1 className="mb-2 font-light text-3xl text-foreground">
						Create Ringtones
					</h1>
					<p className="text-muted-foreground">
						Welcome back, {session.user.name}
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
											Duration: {formatDuration(videoInfo.duration)}
										</p>
									</div>
								</div>
							</div>
						)}

						{videoInfo && videoInfo.duration < 30 && (
							<div className="flex items-center space-x-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
								<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
								<p className="text-sm text-yellow-800 dark:text-yellow-200">
									This video is quite short (
									{formatDuration(videoInfo.duration)}). Make sure your ringtone
									times fit within this duration.
								</p>
							</div>
						)}

						<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
							<form.Field name="startTime">
								{(field) => (
									<div className="space-y-3">
										<TimePicker
											id={field.name}
											label="Start Time"
											value={field.state.value}
											onChange={field.handleChange}
										/>
										{field.state.meta.errors.map((error) => (
											<p key={error?.message} className="text-red-500 text-sm">
												{error?.message}
											</p>
										))}
									</div>
								)}
							</form.Field>

							<form.Field name="endTime">
								{(field) => (
									<div className="space-y-3">
										<TimePicker
											id={field.name}
											label="End Time"
											value={field.state.value}
											onChange={field.handleChange}
										/>
										{field.state.meta.errors.map((error) => (
											<p key={error?.message} className="text-red-500 text-sm">
												{error?.message}
											</p>
										))}
									</div>
								)}
							</form.Field>
						</div>

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
									{createMutation.isPending ? "Creating..." : "Create Ringtone"}
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

				<div className="space-y-6">
					<h2 className="font-light text-foreground text-xl">Your Ringtones</h2>

					{ringtonesQuery.isLoading ? (
						<div className="flex justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : ringtonesQuery.data?.length === 0 ? (
						<div className="py-12 text-center">
							<Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
							<p className="text-muted-foreground">
								No ringtones yet. Create your first one above!
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{ringtonesQuery.data?.map((ringtone) => (
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
												{ringtone.startTime} → {ringtone.endTime}
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
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
