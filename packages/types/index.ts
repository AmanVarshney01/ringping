import z from "zod";

export const formSchema = z.object({
	url: z.url("Please enter a valid URL"),
	startSeconds: z.number().min(0, "Start time must be 0 or greater"),
	endSeconds: z.number().min(1, "End time must be greater than 0"),
	fileName: z
		.string()
		.min(1, "File name cannot be empty")
		.max(50, "File name too long")
		.refine((name) => !/[<>:"/\\|?*]/.test(name), {
			message: "File name contains invalid characters",
		}),
	audioFormat: z.enum(["mp3", "aac", "flac", "m4a", "opus", "vorbis", "wav"]),
	audioQuality: z.string().min(1, "Audio quality is required"),
});
