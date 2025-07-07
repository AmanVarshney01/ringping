import { ORPCError } from "@orpc/server";
import { exec } from "child_process";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import z from "zod/v4";
import { db } from "../db";
import { ringtone } from "../db/schema/ringtone";
import { protectedProcedure } from "../lib/orpc";

const execAsync = promisify(exec);

const timeToSeconds = (timeString: string): number => {
	const [hours, minutes, seconds] = timeString.split(":").map(Number);
	return hours * 3600 + minutes * 60 + seconds;
};

const getVideoInfo = protectedProcedure
	.input(
		z.object({
			url: z.url("Please enter a valid URL"),
		}),
	)
	.handler(async ({ input }) => {
		const { url } = input;

		try {
			const { stdout } = await execAsync(
				`yt-dlp --print "%(title)s" --print "%(duration)s" --print "%(uploader)s" --print "%(thumbnail)s" --no-download "${url}"`,
			);

			const lines = stdout.trim().split("\n");
			const [title, durationStr, uploader, thumbnail] = lines;

			const duration = Number.parseInt(durationStr, 10) || 0;

			return {
				title: title || "Unknown",
				duration: duration,
				thumbnail: thumbnail || null,
				uploader: uploader || "Unknown",
			};
		} catch (error) {
			console.error("Error getting video info:", error);
			throw new ORPCError("BAD_REQUEST", {
				message: "Could not fetch video information. Please check the URL.",
			});
		}
	});

const createRingtone = protectedProcedure
	.input(
		z.object({
			url: z.url("Please enter a valid URL"),
			startTime: z.string().refine((val) => /^\d{2}:\d{2}:\d{2}$/.test(val), {
				message: "Start time must be in HH:MM:SS format",
			}),
			endTime: z.string().refine((val) => /^\d{2}:\d{2}:\d{2}$/.test(val), {
				message: "End time must be in HH:MM:SS format",
			}),
			fileName: z.string().min(1, "File name is required"),
			videoDuration: z.number().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { url, startTime, endTime, fileName, videoDuration } = input;
		const userId = context.session.user.id;

		const startSeconds = timeToSeconds(startTime);
		const endSeconds = timeToSeconds(endTime);

		if (endSeconds <= startSeconds) {
			throw new ORPCError("BAD_REQUEST", {
				message: "End time must be after start time",
			});
		}

		if (endSeconds - startSeconds > 60) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Ringtone duration cannot exceed 60 seconds",
			});
		}

		if (videoDuration && endSeconds > videoDuration) {
			throw new ORPCError("BAD_REQUEST", {
				message: `End time cannot exceed video duration (${Math.floor(videoDuration / 60)}:${(videoDuration % 60).toString().padStart(2, "0")})`,
			});
		}

		const outputDir = path.join(process.cwd(), "public", "downloads", userId);
		await fs.mkdir(outputDir, { recursive: true });

		const ringtoneId = crypto.randomUUID();
		const tempRingtonePath = path.join(outputDir, `${ringtoneId}_temp.mp3`);
		const finalRingtonePath = path.join(outputDir, `${fileName}.mp3`);
		const downloadUrl = `/downloads/${userId}/${fileName}.mp3`;

		try {
			const bufferSeconds = 5;
			const sectionStartSeconds = Math.max(0, startSeconds - bufferSeconds);
			const sectionEndSeconds = endSeconds + bufferSeconds;

			const formatTime = (totalSeconds: number) => {
				const hours = Math.floor(totalSeconds / 3600);
				const minutes = Math.floor((totalSeconds % 3600) / 60);
				const seconds = Math.floor(totalSeconds % 60);
				return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
			};

			const sectionStart = formatTime(sectionStartSeconds);
			const sectionEnd = formatTime(sectionEndSeconds);

			await execAsync(
				[
					"yt-dlp",
					`--download-sections "*${sectionStart}-${sectionEnd}"`,
					"-x",
					"--audio-format mp3",
					"-f best",
					`-o "${tempRingtonePath}"`,
					`"${url}"`,
				].join(" "),
			);

			await execAsync(
				[
					"ffmpeg",
					"-i",
					`"${tempRingtonePath}"`,
					"-ss",
					startTime,
					"-to",
					endTime,
					"-c",
					"copy",
					"-avoid_negative_ts",
					"make_zero",
					`"${finalRingtonePath}"`,
					"-y",
				].join(" "),
			);

			await fs.unlink(tempRingtonePath);

			await db.insert(ringtone).values({
				id: ringtoneId,
				fileName,
				originalUrl: url,
				startTime,
				endTime,
				downloadUrl,
				userId,
			});

			return {
				downloadUrl: downloadUrl,
			};
		} catch (error) {
			console.error("Error creating ringtone:", error);

			try {
				if (await fs.stat(tempRingtonePath)) {
					await fs.unlink(tempRingtonePath);
				}
				if (await fs.stat(finalRingtonePath)) {
					await fs.unlink(finalRingtonePath);
				}
			} catch (cleanupError) {
				console.error("Cleanup error:", cleanupError);
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone. Please try again.",
			});
		}
	});

const getRingtones = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;
	return db.select().from(ringtone).where(eq(ringtone.userId, userId));
});

export const ringtoneRouter = {
	create: createRingtone,
	getAll: getRingtones,
	getVideoInfo: getVideoInfo,
};
