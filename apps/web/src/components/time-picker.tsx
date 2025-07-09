import * as Slider from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";

type TimeRangeSliderProps = {
	startTime: number; // in seconds
	endTime: number; // in seconds
	maxDuration: number; // in seconds
	onChange: (start: number, end: number) => void;
	className?: string;
	id?: string;
	minDuration?: number; // minimum allowed duration in seconds
	maxAllowedDuration?: number; // maximum allowed duration in seconds
};

export const TimeRangeSlider = ({
	startTime,
	endTime,
	maxDuration,
	onChange,
	className,
	id,
	minDuration = 5,
	maxAllowedDuration = 60,
}: TimeRangeSliderProps) => {
	// Internal state to handle dragging
	const [localValues, setLocalValues] = React.useState<[number, number]>([
		startTime,
		endTime,
	]);

	// Update local values when props change
	React.useEffect(() => {
		setLocalValues([startTime, endTime]);
	}, [startTime, endTime]);

	const formatTime = (seconds: number) => {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	const duration = localValues[1] - localValues[0];

	const handleValueChange = (newValues: number[]) => {
		if (!newValues || newValues.length !== 2) return;

		let [newStart, newEnd] = newValues;

		// Enforce minimum duration constraint
		if (newEnd - newStart < minDuration) {
			// If moving end thumb
			if (newEnd !== localValues[1]) {
				newEnd = Math.min(newStart + minDuration, maxDuration);
			}
			// If moving start thumb
			else if (newStart !== localValues[0]) {
				newStart = Math.max(0, newEnd - minDuration);
			}
		}

		// Enforce maximum duration constraint
		if (newEnd - newStart > maxAllowedDuration) {
			// If moving end thumb
			if (newEnd !== localValues[1]) {
				newEnd = Math.min(newStart + maxAllowedDuration, maxDuration);
			}
			// If moving start thumb
			else if (newStart !== localValues[0]) {
				newStart = Math.max(0, newEnd - maxAllowedDuration);
			}
		}

		// Update local state immediately for responsive UI
		setLocalValues([newStart, newEnd]);

		// Notify parent component
		onChange(newStart, newEnd);
	};

	console.log("TimeRangeSlider render:", {
		localValues,
		startTime,
		endTime,
		maxDuration,
	});

	return (
		<div className={cn("space-y-6 p-4", className)}>
			<div className="space-y-2">
				<Label className="font-medium text-sm">Select Time Range</Label>
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>Start: {formatTime(localValues[0])}</span>
					<span>Duration: {duration}s</span>
					<span>End: {formatTime(localValues[1])}</span>
				</div>
			</div>

			<div className="py-4">
				<Slider.Root
					value={localValues}
					onValueChange={handleValueChange}
					min={0}
					max={maxDuration}
					step={1}
					className="relative flex w-full touch-none select-none items-center py-4"
					id={id}
				>
					<Slider.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-secondary">
						<Slider.Range className="absolute h-full bg-primary" />
					</Slider.Track>
					<Slider.Thumb
						className="block h-6 w-6 cursor-grab rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
						aria-label="Start time"
					/>
					<Slider.Thumb
						className="block h-6 w-6 cursor-grab rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
						aria-label="End time"
					/>
				</Slider.Root>
			</div>

			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>0:00:00</span>
				<span>{formatTime(maxDuration)}</span>
			</div>
		</div>
	);
};
