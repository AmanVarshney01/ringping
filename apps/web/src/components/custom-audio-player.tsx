/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import * as React from "react";
import { Howl } from "howler";
import { Button } from "./ui/button";

interface CustomAudioPlayerProps {
	src: string;
	onLoadStart?: () => void;
	onLoadedMetadata?: () => void;
	onError?: () => void;
	autoPlay?: boolean;
	className?: string;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
	src,
	onLoadStart,
	onLoadedMetadata,
	onError,
	autoPlay = false,
	className = "",
}) => {
	const [howl, setHowl] = React.useState<Howl | null>(null);
	const [isPlaying, setIsPlaying] = React.useState(false);
	const [duration, setDuration] = React.useState(0);
	const [currentTime, setCurrentTime] = React.useState(0);
	const [volume, setVolume] = React.useState(1);
	const [isMuted, setIsMuted] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(true);
	const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

	const formatTime = (time: number): string => {
		if (Number.isNaN(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	const clearUpdateInterval = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	};

	const startUpdateInterval = (sound: Howl) => {
		clearUpdateInterval();
		intervalRef.current = setInterval(() => {
			if (sound.playing()) {
				const seek = sound.seek();
				if (typeof seek === "number") {
					setCurrentTime(seek);
				}
			}
		}, 100);
	};

	React.useEffect(() => {
		onLoadStart?.();
		setIsLoading(true);
		setCurrentTime(0);
		setIsPlaying(false);
		clearUpdateInterval();

		const sound = new Howl({
			src: [src],
			html5: false,
			preload: true,
			volume: volume,
			onload: () => {
				console.log("Audio loaded successfully");
				setDuration(sound.duration());
				setIsLoading(false);
				onLoadedMetadata?.();

				if (autoPlay) {
					sound.play();
				}
			},
			onloaderror: (id, error) => {
				console.error("Audio load error:", error);
				setIsLoading(false);
				onError?.();
			},
			onplay: () => {
				console.log("Audio started playing");
				setIsPlaying(true);
				startUpdateInterval(sound);
			},
			onpause: () => {
				console.log("Audio paused");
				setIsPlaying(false);
				clearUpdateInterval();
			},
			onend: () => {
				console.log("Audio ended");
				setIsPlaying(false);
				clearUpdateInterval();
				setCurrentTime(sound.duration());
			},
			onstop: () => {
				console.log("Audio stopped");
				setIsPlaying(false);
				clearUpdateInterval();
			},
		});

		setHowl(sound);

		return () => {
			clearUpdateInterval();
			sound.unload();
		};
	}, [src, autoPlay, volume]);

	const togglePlay = () => {
		if (!howl) {
			console.log("No howl instance available");
			return;
		}

		if (howl.playing()) {
			console.log("Pausing audio");
			howl.pause();
		} else {
			console.log("Playing audio");
			howl.play();
		}
	};

	const handleSeek = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (!howl || duration === 0) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, x / rect.width));
		const newTime = percentage * duration;

		console.log("Seeking to:", newTime, "seconds");

		howl.seek(newTime);
		setCurrentTime(newTime);

		if (!howl.playing() && newTime > 0) {
			howl.play();
			setTimeout(() => {
				if (!isPlaying) {
					howl.pause();
				}
			}, 50);
		}
	};

	const toggleMute = () => {
		if (!howl) return;

		if (isMuted) {
			howl.volume(volume);
			setIsMuted(false);
		} else {
			howl.volume(0);
			setIsMuted(true);
		}
	};

	const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

	if (isLoading) {
		return (
			<div
				className={`flex items-center justify-center space-x-3 rounded-lg border bg-muted/20 p-6 ${className}`}
			>
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				<span className="text-muted-foreground text-sm">Loading audio...</span>
			</div>
		);
	}

	return (
		<div
			className={`space-y-4 rounded-lg border bg-card p-6 shadow-sm ${className}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<Button
						variant="outline"
						size="icon"
						onClick={togglePlay}
						disabled={isLoading}
						className="h-10 w-10 rounded-full"
					>
						{isPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="ml-0.5 h-4 w-4" />
						)}
					</Button>

					<div className="text-center">
						<div className="font-mono text-sm">
							{formatTime(currentTime)} / {formatTime(duration)}
						</div>
					</div>
				</div>

				<Button
					variant="ghost"
					size="icon"
					onClick={toggleMute}
					className="h-8 w-8"
				>
					{isMuted ? (
						<VolumeX className="h-4 w-4" />
					) : (
						<Volume2 className="h-4 w-4" />
					)}
				</Button>
			</div>

			<button
				type="button"
				className="relative h-2 w-full cursor-pointer rounded-full bg-muted"
				onClick={handleSeek}
				aria-label="Seek audio"
			>
				<div
					className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-150"
					style={{ width: `${progressPercentage}%` }}
				/>
			</button>
		</div>
	);
};
