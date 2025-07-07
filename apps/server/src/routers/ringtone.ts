import { ORPCError } from "@orpc/server";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import z from "zod/v4";
import { publicProcedure } from "../lib/orpc";

const execAsync = promisify(exec);

const createRingtone = publicProcedure
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
	.handler(async ({ input }) => {
		const { url, startTime, endTime, fileName } = input;

		const outputDir = path.join(process.cwd(), "public", "downloads");
		await fs.mkdir(outputDir, { recursive: true });

		const randomId = Math.random().toString(36).substring(7);
		const audioPath = path.join(outputDir, `${randomId}.mp3`);
		const ringtonePath = path.join(outputDir, `${fileName}.mp3`);

		try {
			await execAsync(
				`yt-dlp -x --audio-format mp3 -o "${audioPath}" "${url}"`,
			);

			await execAsync(
				`ffmpeg -i "${audioPath}" -ss ${startTime} -to ${endTime} -c copy "${ringtonePath}"`,
			);

			await fs.unlink(audioPath);

			return {
				downloadUrl: `/downloads/${fileName}.mp3`,
			};
		} catch (error) {
			console.error(error);
			try {
				if (await fs.stat(audioPath)) {
					await fs.unlink(audioPath);
				}
				if (await fs.stat(ringtonePath)) {
					await fs.unlink(ringtonePath);
				}
			} catch (cleanupError) {
				console.error("Cleanup error:", cleanupError);
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create ringtone.",
			});
		}
	});

export const ringtoneRouter = {
	create: createRingtone,
};
