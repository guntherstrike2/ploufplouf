import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const visitors = sqliteTable("visitors", {
  id: integer("id").primaryKey(),
  count: integer("count").notNull().default(0),
});

// ── better-auth tables ────────────────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  // Profile fields
  bio: text("bio"),
  statusMessage: text("status_message"),
  avatarDataUrl: text("avatar_data_url"),
  favoriteApp: text("favorite_app"),
  gunthosRank: text("gunthos_rank"),
  onlineStatus: text("online_status", { enum: ["online", "away", "busy", "offline"] }).default("offline"),
  lastHeartbeat: integer("last_heartbeat", { mode: "timestamp" }),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Messages MSN style
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Tracks when a user last read messages from a given contact
export const messageReads = sqliteTable("message_reads", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  contactId: text("contact_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  readAt: integer("read_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("message_reads_pair_idx").on(t.userId, t.contactId),
]);

// Nudges MSN style (persistés pour que le destinataire les reçoive même via SSE ou polling)
export const nudges = sqliteTable("nudges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Settings persistées par user
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  settings: text("settings").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// LinkedGunth posts (vrais users + bots)
export const linkedGunthPosts = sqliteTable("linked_gunth_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // null = bot post
  authorId: text("author_id").references(() => user.id, { onDelete: "cascade" }),
  // used when authorId is null (bot)
  botName: text("bot_name"),
  botTitle: text("bot_title"),
  botAvatar: text("bot_avatar"),
  content: text("content").notNull(),
  // JSON: { "Inspirant": 1234, "Bravo": 456, "Fascinant": 78 } — fake bot counts displayed alongside real user reactions
  botReactionCounts: text("bot_reaction_counts"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const linkedGunthReactions = sqliteTable("linked_gunth_reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => linkedGunthPosts.id, { onDelete: "cascade" }),
  // null = bot reaction
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  // used when userId is null
  botName: text("bot_name"),
  reaction: text("reaction", { enum: ["Inspirant", "Bravo", "Fascinant", "Instructif", "Drôle", "Soutien"] }).notNull(),
});

export const linkedGunthComments = sqliteTable("linked_gunth_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => linkedGunthPosts.id, { onDelete: "cascade" }),
  // null = bot comment
  authorId: text("author_id").references(() => user.id, { onDelete: "cascade" }),
  botName: text("bot_name"),
  botAvatar: text("bot_avatar"),
  content: text("content").notNull(),
  // null = top-level comment
  parentId: integer("parent_id"),
  // emoji reactions: JSON { "👍": 3, "❤️": 1, ... }
  likes: integer("likes").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const linkedGunthCommentLikes = sqliteTable("linked_gunth_comment_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commentId: integer("comment_id").notNull().references(() => linkedGunthComments.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const linkedGunthFollows = sqliteTable("linked_gunth_follows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  followerId: text("follower_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  followedId: text("followed_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const linkedGunthNotifications = sqliteTable("linked_gunth_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  icon: text("icon").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// profil étendu (open to work, headline, localisation)
export const linkedGunthProfiles = sqliteTable("linked_gunth_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  openToWork: integer("open_to_work", { mode: "boolean" }).notNull().default(false),
  headline: text("headline"),
  location: text("location"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// expériences professionnelles
export const linkedGunthExperiences = sqliteTable("linked_gunth_experiences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// visiteurs du profil (mix bots + vrais users)
export const linkedGunthProfileViews = sqliteTable("linked_gunth_profile_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileUserId: text("profile_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  // null = bot visitor
  viewerUserId: text("viewer_user_id").references(() => user.id, { onDelete: "cascade" }),
  botName: text("bot_name"),
  botTitle: text("bot_title"),
  botEmoji: text("bot_emoji"),
  viewedAt: integer("viewed_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// recommandations entre vrais users
export const linkedGunthRecommendations = sqliteTable("linked_gunth_recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  relationship: text("relationship").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("linked_gunth_recommendations_pair_idx").on(t.fromUserId, t.toUserId),
]);

// GuntherBoard — issue tracker interne GunthOS
export const guntherBoardTickets = sqliteTable("gunther_board_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high", "critical"] }).notNull().default("medium"),
  label: text("label", { enum: ["bug", "feature", "chore", "ui", "audio", "db"] }),
  scope: text("scope"),
  assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// réactions aux tickets GuntherBoard
export const guntherBoardReactions = sqliteTable("gunther_board_reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id").notNull().references(() => guntherBoardTickets.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("gunther_board_reactions_unique_idx").on(t.ticketId, t.userId, t.emoji),
]);

// Peagle 98 annonces / changelog
export const peagleAnnouncements = sqliteTable("peagle_announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { enum: ["info", "update", "warning"] }).notNull().default("info"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Peagle 98 leaderboard
export const peagleScores = sqliteTable("peagle_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  won: integer("won", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── GunthMessenger groupes ────────────────────────────────────────────────────

export const groupConversations = sqliteTable("group_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdById: text("created_by_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const groupMembers = sqliteTable("group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groupConversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("group_members_unique_idx").on(t.groupId, t.userId),
]);

export const groupMessages = sqliteTable("group_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groupConversations.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const groupMessageReads = sqliteTable("group_message_reads", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => groupConversations.id, { onDelete: "cascade" }),
  readAt: integer("read_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("group_message_reads_pair_idx").on(t.userId, t.groupId),
]);

// validations de compétences entre vrais users
export const linkedGunthEndorsements = sqliteTable("linked_gunth_endorsements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  skillName: text("skill_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("linked_gunth_endorsements_pair_idx").on(t.fromUserId, t.toUserId, t.skillName),
]);

// ── Notification Center ───────────────────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // "linked-gunth" | "msn" | "gunther-board" | "system"
  type: text("type", { enum: ["info", "success", "warning", "error"] }).notNull().default("info"),
  title: text("title").notNull(),
  message: text("message"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  actionAppSlug: text("action_app_slug"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── GunthMeet chat messages ───────────────────────────────────────────────────

export const meetMessages = sqliteTable("meet_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── Defrag game stats ─────────────────────────────────────────────────────────

export const defragStats = sqliteTable("defrag_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  won: integer("won", { mode: "boolean" }).notNull(),
  score: integer("score").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── GunthOS versioning ────────────────────────────────────────────────────────

export const osVersions = sqliteTable("os_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: text("version").notNull(),
  changelog: text("changelog"),
  releasedAt: integer("released_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── GunthRank — game tier-list ──────────────────────────────────────────────────

export const gunthrankGames = sqliteTable("gunthrank_games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  igdbId: integer("igdb_id").unique(),
  name: text("name").notNull(),
  slug: text("slug"),
  coverUrl: text("cover_url"),
  platforms: text("platforms"),       // JSON array string
  genres: text("genres"),             // JSON array string
  releaseDate: integer("release_date"), // year only
  summary: text("summary"),
  summaryFr: text("summary_fr"),
  videos: text("videos"),             // JSON array [{videoId: string, name: string}]
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const gunthrankRankings = sqliteTable("gunthrank_rankings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull().references(() => gunthrankGames.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(),
  objectiveNote: integer("objective_note"),
  noteText: text("note_text"),
  playedOn: text("played_on"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex("gunthrank_user_game_unique").on(t.userId, t.gameId),
]);
