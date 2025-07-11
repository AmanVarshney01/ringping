/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import * as Slider from "@radix-ui/react-slider";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import * as React from "react";
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
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = React.useState(false);
	const [duration, setDuration] = React.useState(0);
	const [currentTime, setCurrentTime] = React.useState(0);
	const [volume, setVolume] = React.useState(1);
	const [isMuted, setIsMuted] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(true);

	// Format time helper
	const formatTime = (time: number): string => {
		if (Number.isNaN(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	// Update current time
	React.useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const updateTime = () => setCurrentTime(audio.currentTime);
		audio.addEventListener("timeupdate", updateTime);
		return () => audio.removeEventListener("timeupdate", updateTime);
	}, []);

	// Handle play/pause
	const togglePlay = async () => {
		const audio = audioRef.current;
		if (!audio) return;

		try {
			if (isPlaying) {
				await audio.pause();
				setIsPlaying(false);
			} else {
				await audio.play();
				setIsPlaying(true);
			}
		} catch (error) {
			console.error("Error playing audio:", error);
			onError?.();
		}
	};

	// Handle seek
	const handleSeek = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newTime = value[0];
		audio.currentTime = newTime;
		setCurrentTime(newTime);
	};

	// Handle volume change
	const handleVolumeChange = (value: number[]) => {
		const audio = audioRef.current;
		if (!audio) return;

		const newVolume = value[0];
		audio.volume = newVolume;
		setVolume(newVolume);
		setIsMuted(newVolume === 0);
	};

	// Toggle mute
	const toggleMute = () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isMuted) {
			audio.volume = volume;
			setIsMuted(false);
		} else {
			audio.volume = 0;
			setIsMuted(true);
		}
	};

	// Calculate progress percentage
	const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<div className={`w-full ${className}`}>
			<audio
				ref={audioRef}
				src={src}
				preload="metadata"
				autoPlay={autoPlay}
				onLoadStart={() => {
					setIsLoading(true);
					onLoadStart?.();
				}}
				onLoadedMetadata={() => {
					const audio = audioRef.current;
					if (audio) {
						setDuration(audio.duration);
						setIsLoading(false);
						onLoadedMetadata?.();
					}
				}}
				onError={() => {
					setIsLoading(false);
					onError?.();
				}}
				onEnded={() => {
					setIsPlaying(false);
				}}
			>
				<track kind="captions" src="" label="No captions available" />
			</audio>

			<div className="space-y-6 rounded-xl border bg-gradient-to-br from-card to-card/80 p-6 shadow-lg backdrop-blur-sm">
				{/* Main controls */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-6">
						<Button
							variant="outline"
							size="icon"
							onClick={togglePlay}
							disabled={isLoading}
							className="h-12 w-12 rounded-full border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 shadow-md transition-all duration-200 hover:border-primary/30 hover:from-primary/20 hover:to-primary/10"
						>
							{isPlaying ? (
								<Pause className="h-5 w-5" />
							) : (
								<Play className="ml-0.5 h-5 w-5" />
							)}
						</Button>

						<div className="flex items-center space-x-3">
							<div className="flex flex-col">
								<span className="font-mono font-semibold text-foreground text-lg">
									{formatTime(currentTime)}
								</span>
								<span className="font-mono text-muted-foreground text-xs">
									{formatTime(duration)}
								</span>
							</div>
						</div>
					</div>

					{/* Volume control */}
					<div className="flex items-center space-x-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleMute}
							className="h-9 w-9 rounded-full transition-colors hover:bg-primary/10"
						>
							{isMuted || volume === 0 ? (
								<VolumeX className="h-4 w-4" />
							) : (
								<Volume2 className="h-4 w-4" />
							)}
						</Button>
						<div className="w-24">
							<Slider.Root
								value={[isMuted ? 0 : volume]}
								onValueChange={handleVolumeChange}
								max={1}
								step={0.1}
								className="relative flex w-full cursor-pointer touch-none select-none items-center"
							>
								<Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary/50">
									<Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-primary to-primary/80" />
								</Slider.Track>
								<Slider.Thumb className="block h-5 w-5 cursor-grab rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-110 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50" />
							</Slider.Root>
						</div>
					</div>
				</div>

				{/* Progress bar */}
				<div className="space-y-4">
					<div className="relative">
						<Slider.Root
							value={[currentTime]}
							onValueChange={handleSeek}
							max={duration || 100}
							step={0.1}
							disabled={isLoading}
							className="relative flex w-full cursor-pointer touch-none select-none items-center py-2"
						>
							<Slider.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-secondary/50 shadow-inner">
								<Slider.Range className="absolute h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary/70 shadow-sm" />
							</Slider.Track>
							<Slider.Thumb className="block h-6 w-6 cursor-grab rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-110 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50" />
						</Slider.Root>
					</div>

					{/* Loading indicator */}
					{isLoading && (
						<div className="flex items-center justify-center py-3">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-sm" />
							<span className="ml-3 font-medium text-muted-foreground text-sm">
								Loading audio...
							</span>
						</div>
					)}
				</div>

				{/* Waveform-style progress indicator */}
				<div className="relative h-12 w-full overflow-hidden rounded-lg bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30">
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="flex h-8 items-end space-x-1">
							{Array.from({ length: 40 }, (_, i) => (
								<div
									key={i}
									className="w-1 rounded-full bg-gradient-to-t from-primary/30 to-primary/60 transition-all duration-300"
									style={{
										height: `${Math.random() * 100}%`,
										opacity: i / 40 <= progressPercentage / 100 ? 1 : 0.3,
									}}
								/>
							))}
						</div>
					</div>
					<div
						className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/10 to-transparent transition-all duration-300 ease-out"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
			</div>
		</div>
	);
};
