import { consola } from "consola";
import { eq } from "drizzle-orm";
import z from "zod";
import { db } from "../db";
import { todo } from "../db/schema/todo";
import { publicProcedure } from "../lib/orpc";

export const todoRouter = {
	getAll: publicProcedure.handler(async () => {
		consola.info("Fetching all todos");
		const todos = await db.select().from(todo);
		consola.info("Found todos:", todos.length);
		return todos;
	}),

	create: publicProcedure
		.input(z.object({ text: z.string().min(1) }))
		.handler(async ({ input }) => {
			consola.info("Creating todo:", input.text);
			const result = await db
				.insert(todo)
				.values({
					text: input.text,
				})
				.returning();
			consola.success("Todo created:", result[0]?.id);
			return result[0];
		}),

	toggle: publicProcedure
		.input(z.object({ id: z.number(), completed: z.boolean() }))
		.handler(async ({ input }) => {
			consola.info("Toggling todo:", {
				id: input.id,
				completed: input.completed,
			});
			await db
				.update(todo)
				.set({ completed: input.completed })
				.where(eq(todo.id, input.id));
			consola.success("Todo toggled successfully");
			return { success: true };
		}),

	delete: publicProcedure
		.input(z.object({ id: z.number() }))
		.handler(async ({ input }) => {
			consola.info("Deleting todo:", input.id);
			await db.delete(todo).where(eq(todo.id, input.id));
			consola.success("Todo deleted successfully");
			return { success: true };
		}),
};
