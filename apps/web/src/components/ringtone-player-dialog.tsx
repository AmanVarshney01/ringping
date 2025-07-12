import { Download, X } from "lucide-react";
import { CustomAudioPlayer } from "./custom-audio-player";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
	const handleDownload = () => {
		const link = document.createElement("a");
		link.href = audioUrl;
		link.download = `${fileName}.mp3`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogTitle className="sr-only">Ringtone Preview</DialogTitle>
			<DialogDescription className="sr-only">{fileName}</DialogDescription>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<div className="flex items-center justify-between pb-4">
					<div>
						<h2 className="font-semibold text-lg">Ringtone Preview</h2>
						<p className="text-muted-foreground text-sm">{fileName}</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-4">
					<CustomAudioPlayer src={audioUrl} autoPlay />
				</div>

				<div className="pt-4">
					<Button onClick={handleDownload} className="w-full" size="lg">
						<Download className="mr-2 h-4 w-4" />
						Download Ringtone
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
