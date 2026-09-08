import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const syncConfigs = sqliteTable('sync_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sourceRepoOwner: text('source_repo_owner').notNull(),
  sourceRepoName: text('source_repo_name').notNull(),
  sourceToken: text('source_token').notNull(),
  destRepoOwner: text('dest_repo_owner').notNull(),
  destRepoName: text('dest_repo_name').notNull(),
  destToken: text('dest_token').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  // Comma-separated list of allowed file extensions (e.g. ".exe,.msi"). Default only .exe
  assetFilter: text('asset_filter').default('.exe').notNull(),
  // Whether to update README.md in the destination repo based on release changelog
  updateReadme: integer('update_readme', { mode: 'boolean' }).default(true).notNull(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const syncLogs = sqliteTable('sync_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id')
    .references(() => syncConfigs.id, { onDelete: 'cascade' })
    .notNull(),
  tagName: text('tag_name').notNull(),
  releaseName: text('release_name'),
  status: text('status').notNull(), // 'success', 'failed', 'syncing'
  message: text('message'),
  syncedAssets: text('synced_assets'), // JSON stringified array of synced filenames & sizes
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const syncConfigsRelations = relations(syncConfigs, ({ many }) => ({
  logs: many(syncLogs),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  config: one(syncConfigs, {
    fields: [syncLogs.configId],
    references: [syncConfigs.id],
  }),
}));
