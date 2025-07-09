import { Download } from "lucide-react";
import * as React from "react";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

type RingtonePlayerDialogProps = {
	isOpen: boolean;
	onClose: () => void;
	audioUrl: string;
	fileName: string;
};

export const RingtonePlayerDialog = ({
	isOpen,
	onClose,
	audioUrl,
	fileName,
}: RingtonePlayerDialogProps) => {
	const [error, setError] = React.useState<string | null>(null);
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const [isLoading, setIsLoading] = React.useState(true);

	const handleDownload = () => {
		console.log("📥 Download clicked for:", audioUrl);
		const link = document.createElement("a");
		link.href = audioUrl;
		link.download = `${fileName}.mp3`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	React.useEffect(() => {
		if (isOpen) {
			setIsLoading(true);
			setError(null);
		}
	}, [isOpen, audioUrl]);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center justify-between">
						<span>Ringtone Preview</span>
					</DialogTitle>
					<DialogDescription>
						Preview and download your ringtone: {fileName}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					<div className="rounded bg-muted/20 p-2 text-muted-foreground text-xs">
						Audio URL: {audioUrl}
					</div>

					<div className="flex flex-col gap-4">
						<audio
							ref={audioRef}
							controls
							className="w-full"
							preload="metadata"
							src={audioUrl}
							onLoadStart={() => setIsLoading(true)}
							onLoadedMetadata={() => {
								setIsLoading(false);
							}}
							onError={() => {
								setError("Failed to load audio file");
								setIsLoading(false);
							}}
							autoPlay
						>
							<source src={audioUrl} type="audio/mpeg" />
							<track kind="captions" src="" label="No captions available" />
							Your browser does not support the audio element.
						</audio>

						{isLoading && (
							<div className="text-center text-muted-foreground text-sm">
								Loading audio...
							</div>
						)}

						{error && (
							<div className="text-center text-red-500 text-sm">{error}</div>
						)}
					</div>

					<div className="flex items-center justify-center">
						<Button
							onClick={handleDownload}
							className="flex items-center space-x-2"
						>
							<Download className="h-4 w-4" />
							<span>Download</span>
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
