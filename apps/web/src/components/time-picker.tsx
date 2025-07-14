import * as Slider from "@radix-ui/react-slider";
import { type MouseEvent, useEffect, useRef, useState } from "react";
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
	const [localValues, setLocalValues] = useState<[number, number]>([
		startTime,
		endTime,
	]);
	const [isZoomed, setIsZoomed] = useState(false);
	const [zoomCenter, setZoomCenter] = useState(0);
	const trackRef = useRef<HTMLSpanElement>(null);

	const getZoomWindowSize = () => {
		if (maxDuration <= 60) return Math.min(maxDuration * 0.3, 20);
		if (maxDuration <= 300) return Math.min(maxDuration * 0.2, 60);
		if (maxDuration <= 3600) return Math.min(maxDuration * 0.1, 300);
		return Math.min(maxDuration * 0.05, 600);
	};

	const zoomWindowSize = getZoomWindowSize();
	const zoomStart = Math.max(0, zoomCenter - zoomWindowSize / 2);
	const zoomEnd = Math.min(maxDuration, zoomCenter + zoomWindowSize / 2);

	useEffect(() => {
		console.log("TimePicker - useEffect update:", {
			startTime,
			endTime,
			duration: endTime - startTime,
			oldLocalValues: localValues,
		});

		const roundedStart = Math.round(startTime);
		const roundedEnd = Math.round(endTime);

		setLocalValues([roundedStart, roundedEnd]);

		if (!isZoomed) {
			const selectionCenter = (roundedStart + roundedEnd) / 2;
			setZoomCenter(selectionCenter);
		}
	}, [startTime, endTime, isZoomed]);

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

		if (isZoomed) {
			const zoomRange = zoomEnd - zoomStart;
			newStart = zoomStart + (newStart / maxDuration) * zoomRange;
			newEnd = zoomStart + (newEnd / maxDuration) * zoomRange;
		}

		newStart = Math.round(newStart);
		newEnd = Math.round(newEnd);

		if (newEnd - newStart < minDuration) {
			const startDiff = Math.abs(newStart - localValues[0]);
			const endDiff = Math.abs(newEnd - localValues[1]);

			if (startDiff > endDiff) {
				newEnd = Math.min(maxDuration, newStart + minDuration);
			} else {
				newStart = Math.max(0, newEnd - minDuration);
			}
		}

		if (newEnd - newStart > maxAllowedDuration) {
			const startDiff = Math.abs(newStart - localValues[0]);
			const endDiff = Math.abs(newEnd - localValues[1]);

			if (startDiff > endDiff) {
				newEnd = Math.min(maxDuration, newStart + maxAllowedDuration);
			} else {
				newStart = Math.max(0, newEnd - maxAllowedDuration);
			}
		}

		console.log("TimePicker - handleValueChange:", {
			originalStart: newValues[0],
			originalEnd: newValues[1],
			adjustedStart: newStart,
			adjustedEnd: newEnd,
			duration: newEnd - newStart,
			oldValues: localValues,
		});

		setLocalValues([newStart, newEnd]);
		onChange(newStart, newEnd);
	};

	const handleValueCommit = (newValues: number[]) => {
		if (!newValues || newValues.length !== 2) return;

		let [newStart, newEnd] = newValues;

		if (isZoomed) {
			const zoomRange = zoomEnd - zoomStart;
			newStart = zoomStart + (newStart / maxDuration) * zoomRange;
			newEnd = zoomStart + (newEnd / maxDuration) * zoomRange;
		}

		newStart = Math.round(newStart);
		newEnd = Math.round(newEnd);

		console.log("TimePicker - handleValueCommit:", {
			newStart,
			newEnd,
			duration: newEnd - newStart,
			oldValues: localValues,
		});

		onChange(newStart, newEnd);
	};

	const handleTrackClick = (e: MouseEvent<HTMLSpanElement>) => {
		if (!trackRef.current) return;

		const rect = trackRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));

		let clickValue: number;
		if (isZoomed) {
			const zoomRange = zoomEnd - zoomStart;
			clickValue = Math.round(zoomStart + clickPercent * zoomRange);
		} else {
			clickValue = Math.round(clickPercent * maxDuration);
		}

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

		newStart = Math.round(newStart);
		newEnd = Math.round(newEnd);

		setLocalValues([newStart, newEnd]);
		onChange(newStart, newEnd);

		e.stopPropagation();
	};

	const toggleZoom = () => {
		if (!isZoomed) {
			const selectionCenter = (localValues[0] + localValues[1]) / 2;
			setZoomCenter(selectionCenter);
		}
		setIsZoomed(!isZoomed);
	};

	const moveZoom = (direction: "left" | "right") => {
		if (!isZoomed) return;

		const moveAmount = zoomWindowSize * 0.25;
		const newCenter =
			direction === "left"
				? Math.max(zoomWindowSize / 2, zoomCenter - moveAmount)
				: Math.min(maxDuration - zoomWindowSize / 2, zoomCenter + moveAmount);

		setZoomCenter(newCenter);
	};

	const getSliderValues = (): [number, number] => {
		if (isZoomed) {
			const zoomRange = zoomEnd - zoomStart;
			const normalizedStart =
				((localValues[0] - zoomStart) / zoomRange) * maxDuration;
			const normalizedEnd =
				((localValues[1] - zoomStart) / zoomRange) * maxDuration;
			return [
				Math.max(0, Math.min(maxDuration, normalizedStart)),
				Math.max(0, Math.min(maxDuration, normalizedEnd)),
			];
		}
		return localValues;
	};

	const sliderValues = getSliderValues();

	const getStepSize = () => {
		if (maxDuration <= 60) return 0.1;
		if (maxDuration <= 300) return 0.5;
		if (maxDuration <= 3600) return 1;
		return Math.max(1, Math.floor(maxDuration / 10000));
	};

	return (
		<div className={cn("space-y-6 p-4", className)}>
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="font-medium text-sm">Select Time Range</Label>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={toggleZoom}
							className="rounded bg-secondary px-2 py-1 text-xs transition-colors hover:bg-secondary/80"
						>
							{isZoomed ? "Zoom Out" : "Zoom In"}
						</button>
						{isZoomed && (
							<div className="flex gap-1">
								<button
									type="button"
									onClick={() => moveZoom("left")}
									className="rounded bg-secondary px-2 py-1 text-xs transition-colors hover:bg-secondary/80"
								>
									←
								</button>
								<button
									type="button"
									onClick={() => moveZoom("right")}
									className="rounded bg-secondary px-2 py-1 text-xs transition-colors hover:bg-secondary/80"
								>
									→
								</button>
							</div>
						)}
					</div>
				</div>
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>Start: {formatTime(localValues[0])}</span>
					<span className="font-medium">Duration: {duration}s</span>
					<span>End: {formatTime(localValues[1])}</span>
				</div>
				{isZoomed && (
					<div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground text-xs">
						Zoomed view: {formatTime(zoomStart)} - {formatTime(zoomEnd)}
						<span className="ml-2 text-primary">
							({Math.round(zoomWindowSize)}s window)
						</span>
					</div>
				)}
			</div>

			<div className="py-4">
				<Slider.Root
					value={sliderValues}
					onValueChange={handleValueChange}
					onValueCommit={handleValueCommit}
					min={0}
					max={maxDuration}
					step={getStepSize()}
					minStepsBetweenThumbs={minDuration}
					className="relative flex w-full touch-none select-none items-center py-4"
					id={id}
				>
					<Slider.Track
						className={cn(
							"relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full bg-secondary transition-all",
						)}
						onClick={handleTrackClick}
						ref={trackRef}
					>
						<Slider.Range className="absolute h-full bg-primary" />
					</Slider.Track>
					<Slider.Thumb
						className={cn(
							"block size-4 cursor-grab rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50",
						)}
						aria-label="Start time"
					/>
					<Slider.Thumb
						className={cn(
							"block size-4 cursor-grab rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50",
						)}
						aria-label="End time"
					/>
				</Slider.Root>
			</div>

			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>{isZoomed ? formatTime(zoomStart) : "0:00:00"}</span>
				<span>{isZoomed ? formatTime(zoomEnd) : formatTime(maxDuration)}</span>
			</div>
		</div>
	);
};
