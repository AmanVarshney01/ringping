import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import z from "zod/v4";
import { db } from "../db";
import { ringtone } from "../db/schema/ringtone";
import { protectedProcedure } from "../lib/orpc";

const getVideoInfo = protectedProcedure
	.input(
		z.object({
			url: z.url("Please enter a valid URL"),
		}),
	)
	.handler(async ({ input }) => {
		const { url } = input;

		try {
			console.info("Fetching video info for URL:", url);

			const proc = Bun.spawn(
				[
					"yt-dlp",
					"--print",
					"%(title)s",
					"--print",
					"%(duration)s",
					"--print",
					"%(uploader)s",
					"--print",
					"%(thumbnail)s",
					"--no-download",
					url,
				],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				throw new Error(`yt-dlp failed with exit code ${exitCode}: ${stderr}`);
			}

			const lines = stdout.trim().split("\n");
			const [title, durationStr, uploader, thumbnail] = lines;

			const duration = Number.parseInt(durationStr, 10) || 0;

			console.log("Video info fetched successfully:", { title, duration });

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
			startSeconds: z.number().int().min(0, "Start time must be 0 or greater"),
			durationSeconds: z
				.number()
				.int()
				.min(5, "Duration must be at least 5 seconds")
				.max(60, "Duration cannot exceed 60 seconds"),
			fileName: z
				.string()
				.min(1, "File name is required")
				.max(50, "File name too long"),
			videoDuration: z.number().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { url, startSeconds, durationSeconds, fileName, videoDuration } =
			input;
		const userId = context.session.user.id;
		const endSeconds = startSeconds + durationSeconds;

		if (videoDuration && endSeconds > videoDuration) {
			throw new ORPCError("BAD_REQUEST", {
				message: `End time (${endSeconds}s) cannot exceed video duration (${videoDuration}s)`,
			});
		}

		if (videoDuration && startSeconds >= videoDuration) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Start time (${startSeconds}s) cannot be greater than or equal to video duration (${videoDuration}s)`,
			});
		}

		const outputDir = path.join(process.cwd(), "public", "downloads", userId);
		await fs.mkdir(outputDir, { recursive: true });

		const ringtoneId = crypto.randomUUID();
		const outputPath = path.join(outputDir, `${fileName}.mp3`);
		const downloadUrl = `/downloads/${userId}/${fileName}.mp3`;

		try {
			console.info("Creating ringtone:", {
				fileName,
				startSeconds,
				durationSeconds,
				userId,
			});

			console.info("Downloading time range:", { startSeconds, endSeconds });

			const formatTime = (seconds: number) => {
				const h = Math.floor(seconds / 3600);
				const m = Math.floor((seconds % 3600) / 60);
				const s = Math.floor(seconds % 60);
				return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
			};

			const startTimeFormatted = formatTime(startSeconds);
			const endTimeFormatted = formatTime(endSeconds);

			console.info("Time range for yt-dlp:", {
				startTimeFormatted,
				endTimeFormatted,
				expectedDuration: endSeconds - startSeconds,
			});

			const proc = Bun.spawn(
				[
					"yt-dlp",
					"-x",
					"--audio-format",
					"mp3",
					"--audio-quality",
					"192K",
					"--download-sections",
					`*${startTimeFormatted}-${endTimeFormatted}`,
					"-o",
					outputPath,
					url,
				],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			console.info("yt-dlp output:", { stdout, stderr, exitCode });

			if (exitCode !== 0) {
				throw new Error(`yt-dlp failed with exit code ${exitCode}: ${stderr}`);
			}

			const stats = await fs.stat(outputPath);
			if (stats.size === 0) {
				throw new Error("Generated file is empty");
			}

			console.log("File created:", {
				size: `${Math.round(stats.size / 1024)}KB`,
			});

			const trimmedPath = outputPath.replace(/\.mp3$/, ".trimmed.mp3");

			console.info("Original request:", {
				startSeconds,
				durationSeconds,
				endSeconds,
				startTimeFormatted,
				endTimeFormatted,
			});
			console.info("yt-dlp downloaded segment:", {
				outputPath,
				originalSize: `${Math.round(stats.size / 1024)}KB`,
			});

			const probeProc = Bun.spawn(
				[
					"ffprobe",
					"-v",
					"quiet",
					"-print_format",
					"json",
					"-show_format",
					"-show_streams",
					outputPath,
				],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			const probeStdout = await new Response(probeProc.stdout).text();
			const probeExitCode = await probeProc.exited;

			if (probeExitCode === 0) {
				try {
					const probeData = JSON.parse(probeStdout);
					const duration = Number.parseFloat(probeData.format?.duration || "0");
					console.info("Downloaded segment info:", {
						actualDuration: `${duration.toFixed(2)}s`,
						expectedDuration: `${durationSeconds}s`,
						difference: `${(duration - durationSeconds).toFixed(2)}s`,
					});
				} catch (e) {
					console.error("Failed to parse ffprobe output:", e);
				}
			}

			console.info("Starting ffmpeg trim...");
			const ffmpegProc = Bun.spawn(
				[
					"ffmpeg",
					"-y",
					"-i",
					outputPath,
					"-ss",
					"0",
					"-t",
					String(durationSeconds),
					"-acodec",
					"copy",
					trimmedPath,
				],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			const ffmpegStdout = await new Response(ffmpegProc.stdout).text();
			const ffmpegStderr = await new Response(ffmpegProc.stderr).text();
			const ffmpegExitCode = await ffmpegProc.exited;

			console.info("ffmpeg command output:", {
				ffmpegStdout,
				ffmpegStderr,
				ffmpegExitCode,
			});

			if (ffmpegExitCode !== 0) {
				throw new Error(
					`ffmpeg trimming failed with exit code ${ffmpegExitCode}: ${ffmpegStderr}`,
				);
			}

			const finalProbeProc = Bun.spawn(
				[
					"ffprobe",
					"-v",
					"quiet",
					"-print_format",
					"json",
					"-show_format",
					trimmedPath,
				],
				{
					stdout: "pipe",
					stderr: "pipe",
				},
			);

			const finalProbeStdout = await new Response(finalProbeProc.stdout).text();
			const finalProbeExitCode = await finalProbeProc.exited;

			if (finalProbeExitCode === 0) {
				try {
					const finalProbeData = JSON.parse(finalProbeStdout);
					const finalDuration = Number.parseFloat(
						finalProbeData.format?.duration || "0",
					);
					console.info("Final trimmed file info:", {
						finalDuration: `${finalDuration.toFixed(2)}s`,
						requestedDuration: `${durationSeconds}s`,
						accuracy: `${Math.abs(finalDuration - durationSeconds).toFixed(2)}s off`,
					});
				} catch (e) {
					console.error("Failed to parse final ffprobe output:", e);
				}
			}

			await fs.unlink(outputPath);
			await fs.rename(trimmedPath, outputPath);

			const finalStats = await fs.stat(outputPath);
			console.log("Audio trimmed successfully:", {
				finalSize: `${Math.round(finalStats.size / 1024)}KB`,
				exactDuration: `${durationSeconds}s`,
			});
			console.info("=== END FFMPEG TRIMMING DEBUG ===");

			await db.insert(ringtone).values({
				id: ringtoneId,
				fileName,
				originalUrl: url,
				startTime: startSeconds,
				endTime: endSeconds,
				downloadUrl,
				userId,
			});

			console.log("Ringtone created successfully:", {
				fileName,
				downloadUrl,
			});

			return {
				downloadUrl: downloadUrl,
			};
		} catch (error) {
			console.error("Error creating ringtone:", error);

			try {
				await fs.unlink(outputPath);
			} catch (cleanupError) {
				console.error("Cleanup error:", cleanupError);
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone. Check URL and try again.",
			});
		}
	});

const getRingtones = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;
	console.info("Fetching ringtones for user:", userId);

	const userRingtones = await db
		.select()
		.from(ringtone)
		.where(eq(ringtone.userId, userId))
		.orderBy(desc(ringtone.createdAt));

	console.info("Found ringtones:", userRingtones.length);

	return userRingtones;
});

const updateRingtone = protectedProcedure
	.input(
		z.object({
			id: z.string(),
			fileName: z
				.string()
				.min(1, "File name is required")
				.max(50, "File name too long"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { id, fileName } = input;
		const userId = context.session.user.id;

		try {
			console.info("Updating ringtone:", { id, fileName, userId });

			const existingRingtone = await db
				.select()
				.from(ringtone)
				.where(eq(ringtone.id, id))
				.limit(1);

			if (existingRingtone.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Ringtone not found",
				});
			}

			if (existingRingtone[0].userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "You can only update your own ringtones",
				});
			}

			await db
				.update(ringtone)
				.set({
					fileName,
					updatedAt: new Date(),
				})
				.where(eq(ringtone.id, id));

			console.log("Ringtone updated successfully:", { id, fileName });

			return { success: true };
		} catch (error) {
			console.error("Error updating ringtone:", error);
			if (error instanceof ORPCError) {
				throw error;
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update ringtone",
			});
		}
	});

const deleteRingtone = protectedProcedure
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { id } = input;
		const userId = context.session.user.id;

		try {
			console.info("Deleting ringtone:", { id, userId });

			const existingRingtone = await db
				.select()
				.from(ringtone)
				.where(eq(ringtone.id, id))
				.limit(1);

			if (existingRingtone.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Ringtone not found",
				});
			}

			if (existingRingtone[0].userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "You can only delete your own ringtones",
				});
			}

			const ringtoneData = existingRingtone[0];

			await db.delete(ringtone).where(eq(ringtone.id, id));

			try {
				const filePath = path.join(
					process.cwd(),
					"public",
					ringtoneData.downloadUrl,
				);
				await fs.unlink(filePath);
				console.info("File deleted:", filePath);
			} catch (fileError) {
				console.warn("Could not delete file (file may not exist):", fileError);
			}

			console.log("Ringtone deleted successfully:", { id });

			return { success: true };
		} catch (error) {
			console.error("Error deleting ringtone:", error);
			if (error instanceof ORPCError) {
				throw error;
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete ringtone",
			});
		}
	});

export const ringtoneRouter = {
	create: createRingtone,
	getAll: getRingtones,
	getVideoInfo: getVideoInfo,
	update: updateRingtone,
	delete: deleteRingtone,
};
