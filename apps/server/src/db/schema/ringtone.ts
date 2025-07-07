import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const ringtone = sqliteTable("ringtone", {
	id: text("id").primaryKey(),
	fileName: text("file_name").notNull(),
	originalUrl: text("original_url").notNull(),
	startTime: text("start_time").notNull(),
	endTime: text("end_time").notNull(),
	downloadUrl: text("download_url").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const ringtoneRelations = relations(ringtone, ({ one }) => ({
	user: one(user, {
		fields: [ringtone.userId],
		references: [user.id],
	}),
}));
