import { protectedProcedure, publicProcedure } from "../lib/orpc";
import { ringtoneRouter } from "./ringtone";
import { todoRouter } from "./todo";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	todo: todoRouter,
	ringtone: ringtoneRouter,
};
export type AppRouter = typeof appRouter;
