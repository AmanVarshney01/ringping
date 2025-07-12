import YouTube, { type YouTubeProps } from "react-youtube";

type YoutubePlayerProps = {
	videoId: string;
	onReady?: YouTubeProps["onReady"];
	onStateChange?: YouTubeProps["onStateChange"];
};

export function YoutubePlayer({
	videoId,
	onReady,
	onStateChange,
}: YoutubePlayerProps) {
	const aspectRatio = 16 / 9;
	const width = 550;
	const height = Math.round(width / aspectRatio);

	const opts: YouTubeProps["opts"] = {
		height: height.toString(),
		width: width.toString(),
		playerVars: {
			autoplay: 0,
		},
	};

	return (
		<YouTube
			videoId={videoId}
			opts={opts}
			onReady={onReady}
			onStateChange={onStateChange}
			className=""
		/>
	);
}
