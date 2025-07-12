import * as Slider from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";

type TimeRangeSliderProps = {
	startTime: number;
	endTime: number;
	maxDuration: number;
	onChange: (start: number, end: number) => void;
	className?: string;
	id?: string;
	minDuration?: number;
	maxAllowedDuration?: number;
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
	const [localValues, setLocalValues] = React.useState<[number, number]>([
		startTime,
		endTime,
	]);
	const trackRef = React.useRef<HTMLSpanElement>(null);

	React.useEffect(() => {
		console.log("TimePicker - useEffect update:", {
			startTime,
			endTime,
			duration: endTime - startTime,
			oldLocalValues: localValues,
		});
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

		const [newStart, newEnd] = newValues;

		console.log("TimePicker - handleValueChange:", {
			newStart,
			newEnd,
			duration: newEnd - newStart,
			oldValues: localValues,
		});

		setLocalValues([newStart, newEnd]);

		onChange(newStart, newEnd);
	};

	const handleTrackClick = (e: React.MouseEvent<HTMLSpanElement>) => {
		if (!trackRef.current) return;

		const rect = trackRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
		const clickValue = Math.round(clickPercent * maxDuration);

		const distanceToStart = Math.abs(clickValue - localValues[0]);
		const distanceToEnd = Math.abs(clickValue - localValues[1]);

		let newStart = localValues[0];
		let newEnd = localValues[1];

		if (distanceToStart <= distanceToEnd) {
			newStart = clickValue;

			if (newEnd - newStart < minDuration) {
				newEnd = Math.min(maxDuration, newStart + minDuration);
			}

			if (newEnd - newStart > maxAllowedDuration) {
				newEnd = Math.min(maxDuration, newStart + maxAllowedDuration);
			}
		} else {
			newEnd = clickValue;

			if (newEnd - newStart < minDuration) {
				newStart = Math.max(0, newEnd - minDuration);
			}

			if (newEnd - newStart > maxAllowedDuration) {
				newStart = Math.max(0, newEnd - maxAllowedDuration);
			}
		}

		handleValueChange([newStart, newEnd]);

		e.stopPropagation();
	};

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
					minStepsBetweenThumbs={minDuration}
					className="relative flex w-full touch-none select-none items-center py-4"
					id={id}
				>
					<Slider.Track
						className="relative h-3 w-full grow cursor-pointer overflow-hidden rounded-full bg-secondary"
						onClick={handleTrackClick}
						ref={trackRef}
					>
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
