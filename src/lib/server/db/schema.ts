import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$default(() => crypto.randomUUID()),
  text: text('text').notNull(),
  completed: boolean('completed').default(false).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  parentId: text('parent_id'),
  userId: uuid('user_id').notNull(), // references auth.users(id)
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull()
});

// Export types
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;
