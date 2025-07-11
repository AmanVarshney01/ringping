import { Download } from "lucide-react";
import * as React from "react";
import { CustomAudioPlayer } from "./custom-audio-player";
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
						<CustomAudioPlayer
							src={audioUrl}
							onError={() => {
								setError("Failed to load audio file");
							}}
							autoPlay
						/>

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
