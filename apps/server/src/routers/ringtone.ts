import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { consola } from "consola";
import { eq } from "drizzle-orm";
import { execa } from "execa";
import z from "zod/v4";
import { db } from "../db";
import { ringtone } from "../db/schema/ringtone";
import { protectedProcedure, publicProcedure } from "../lib/orpc";

const getVideoInfo = protectedProcedure
	.input(
		z.object({
			url: z.url("Please enter a valid URL"),
		}),
	)
	.handler(async ({ input }) => {
		const { url } = input;

		try {
			consola.info("Fetching video info for URL:", url);

			const { stdout } = await execa(
				`yt-dlp --print "%(title)s" --print "%(duration)s" --print "%(uploader)s" --print "%(thumbnail)s" --no-download "${url}"`,
				{ shell: true, timeout: 30000 },
			);

			const lines = stdout.trim().split("\n");
			const [title, durationStr, uploader, thumbnail] = lines;

			const duration = Number.parseInt(durationStr, 10) || 0;

			consola.success("Video info fetched successfully:", { title, duration });

			return {
				title: title || "Unknown",
				duration: duration,
				thumbnail: thumbnail || null,
				uploader: uploader || "Unknown",
			};
		} catch (error) {
			consola.error("Error getting video info:", error);
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
				.min(1, "Duration must be at least 1 second")
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

		const outputDir = path.join(process.cwd(), "public", "downloads", userId);
		await fs.mkdir(outputDir, { recursive: true });

		const ringtoneId = crypto.randomUUID();
		const outputPath = path.join(outputDir, `${fileName}.mp3`);
		const downloadUrl = `/downloads/${userId}/${fileName}.mp3`;

		try {
			consola.info("Creating ringtone:", {
				fileName,
				startSeconds,
				durationSeconds,
				userId,
			});

			consola.info("Downloading time range:", { startSeconds, endSeconds });
			await execa(
				`yt-dlp -x --audio-format mp3 --audio-quality 192K --download-sections "*${startSeconds}-${endSeconds}" -o "${outputPath}" "${url}"`,
				{
					shell: true,
					timeout: 120000,
				},
			);

			const stats = await fs.stat(outputPath);
			if (stats.size === 0) {
				throw new Error("Generated file is empty");
			}

			consola.success("File created:", {
				size: `${Math.round(stats.size / 1024)}KB`,
			});

			await db.insert(ringtone).values({
				id: ringtoneId,
				fileName,
				originalUrl: url,
				startTime: startSeconds.toString(),
				endTime: endSeconds.toString(),
				downloadUrl,
				userId,
			});

			consola.success("Ringtone created successfully:", {
				fileName,
				downloadUrl,
			});

			return {
				downloadUrl: downloadUrl,
			};
		} catch (error) {
			consola.error("Error creating ringtone:", error);

			try {
				await fs.unlink(outputPath);
			} catch (cleanupError) {
				consola.error("Cleanup error:", cleanupError);
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone. Check URL and try again.",
			});
		}
	});

const getRingtones = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;
	consola.info("Fetching ringtones for user:", userId);

	const userRingtones = await db
		.select()
		.from(ringtone)
		.where(eq(ringtone.userId, userId));

	consola.info("Found ringtones:", userRingtones.length);

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
			consola.info("Updating ringtone:", { id, fileName, userId });

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

			consola.success("Ringtone updated successfully:", { id, fileName });

			return { success: true };
		} catch (error) {
			consola.error("Error updating ringtone:", error);
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
			consola.info("Deleting ringtone:", { id, userId });

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
				consola.info("File deleted:", filePath);
			} catch (fileError) {
				consola.warn("Could not delete file (file may not exist):", fileError);
			}

			consola.success("Ringtone deleted successfully:", { id });

			return { success: true };
		} catch (error) {
			consola.error("Error deleting ringtone:", error);
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
