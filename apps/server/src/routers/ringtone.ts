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
		}),
	)
	.handler(async ({ input, context }) => {
		const { url, startTime, endTime, fileName } = input;
		const userId = context.session.user.id;

		const outputDir = path.join(process.cwd(), "public", "downloads", userId);
		await fs.mkdir(outputDir, { recursive: true });

		const ringtoneId = crypto.randomUUID();
		const tempAudioPath = path.join(outputDir, `${ringtoneId}_temp.mp3`);
		const finalRingtonePath = path.join(outputDir, `${fileName}.mp3`);
		const downloadUrl = `/downloads/${userId}/${fileName}.mp3`;

		try {
			// Download audio using yt-dlp
			await execAsync(
				`yt-dlp -x --audio-format mp3 -o "${tempAudioPath}" "${url}"`,
			);

			// Trim audio using ffmpeg
			await execAsync(
				`ffmpeg -i "${tempAudioPath}" -ss ${startTime} -to ${endTime} -c copy "${finalRingtonePath}"`,
			);

			// Clean up original download
			await fs.unlink(tempAudioPath);

			// Save to database
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
			// Clean up files if an error occurs
			try {
				if (await fs.stat(tempAudioPath)) {
					await fs.unlink(tempAudioPath);
				}
				if (await fs.stat(finalRingtonePath)) {
					await fs.unlink(finalRingtonePath);
				}
			} catch (cleanupError) {
				console.error("Cleanup error:", cleanupError);
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone.",
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
};
