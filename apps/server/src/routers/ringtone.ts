import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import z from "zod";
import { db } from "../db";
import { ringtone } from "../db/schema/ringtone";
import { protectedProcedure } from "../lib/orpc";

const generateUniqueFileName = async (
	baseName: string,
	userId: string,
): Promise<string> => {
	const existingNames = await db
		.select({ fileName: ringtone.fileName })
		.from(ringtone)
		.where(eq(ringtone.userId, userId));

	const existingSet = new Set(
		existingNames.map((r) => r.fileName.toLowerCase()),
	);

	if (!existingSet.has(baseName.toLowerCase())) {
		return baseName;
	}

	let counter = 1;
	let uniqueName = `${baseName} ${counter}`;

	while (existingSet.has(uniqueName.toLowerCase())) {
		counter++;
		uniqueName = `${baseName} ${counter}`;
	}

	return uniqueName;
};

const getVideoInfo = protectedProcedure
	.input(
		z.object({
			url: z.url("Please enter a valid URL"),
		}),
	)
	.handler(async ({ input }) => {
		const { url } = input;

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
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Could not fetch video information. Please check the URL.",
			});
		}

		const lines = stdout.trim().split("\n");
		const [title, durationStr, uploader, thumbnail] = lines;
		const duration = Number.parseInt(durationStr, 10) || 0;

		return {
			title: title || "Unknown",
			duration: duration,
			thumbnail: thumbnail || null,
			uploader: uploader || "Unknown",
		};
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
			audioFormat: z.enum([
				"mp3",
				"aac",
				"flac",
				"m4a",
				"opus",
				"vorbis",
				"wav",
			]),
			audioQuality: z
				.string()
				.regex(/^(\d+K?|[0-9]|10)$/, "Invalid audio quality format"),
		}),
	)
	.handler(async ({ input, context }) => {
		const {
			url,
			startSeconds,
			durationSeconds,
			fileName,
			videoDuration,
			audioFormat,
			audioQuality,
		} = input;
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

		const uniqueFileName = await generateUniqueFileName(fileName, userId);

		const outputDir = path.join(process.cwd(), "public", "downloads", userId);
		await fs.mkdir(outputDir, { recursive: true });

		const ringtoneId = crypto.randomUUID();
		const outputPath = path.join(outputDir, `${uniqueFileName}.${audioFormat}`);
		const downloadUrl = `/downloads/${userId}/${uniqueFileName}.${audioFormat}`;

		const formatTime = (seconds: number) => {
			const h = Math.floor(seconds / 3600);
			const m = Math.floor((seconds % 3600) / 60);
			const s = Math.floor(seconds % 60);
			return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
		};

		const startTimeFormatted = formatTime(startSeconds);
		const endTimeFormatted = formatTime(endSeconds);

		const proc = Bun.spawn(
			[
				"yt-dlp",
				"-x",
				"--audio-format",
				audioFormat,
				"--audio-quality",
				audioQuality,
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

		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone. Check URL and try again.",
			});
		}

		const trimmedPath = outputPath.replace(
			new RegExp(`\\.${audioFormat}$`),
			`.trimmed.${audioFormat}`,
		);

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

		const ffmpegExitCode = await ffmpegProc.exited;

		if (ffmpegExitCode === 0) {
			await fs.unlink(outputPath);
			await fs.rename(trimmedPath, outputPath);
		}

		await db.insert(ringtone).values({
			id: ringtoneId,
			fileName: uniqueFileName,
			originalUrl: url,
			startTime: startSeconds,
			endTime: endSeconds,
			downloadUrl,
			audioFormat,
			audioQuality,
			userId,
		});

		return {
			downloadUrl: downloadUrl,
		};
	});

const getRingtones = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session.user.id;

	const userRingtones = await db
		.select()
		.from(ringtone)
		.where(eq(ringtone.userId, userId))
		.orderBy(desc(ringtone.createdAt));

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

		const uniqueFileName = await generateUniqueFileName(fileName, userId);

		await db
			.update(ringtone)
			.set({
				fileName: uniqueFileName,
				updatedAt: new Date(),
			})
			.where(eq(ringtone.id, id));

		return { success: true };
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
		} catch {}

		return { success: true };
	});

export const ringtoneRouter = {
	create: createRingtone,
	getAll: getRingtones,
	getVideoInfo: getVideoInfo,
	update: updateRingtone,
	delete: deleteRingtone,
};
