import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const secondsToHms = (d: number) => {
	const dur = Number(d);
	const h = Math.floor(dur / 3600);
	const m = Math.floor((dur % 3600) / 60);
	const s = Math.floor((dur % 3600) % 60);
	return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
