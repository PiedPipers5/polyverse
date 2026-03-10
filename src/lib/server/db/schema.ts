import { pgTable, uuid, text, jsonb, timestamp, index, uniqueIndex, integer, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users Table
 * Stores public identity and authentication details for an actor.
 */
export const users = pgTable('users', {
	/**
	 * Unique identifier for the user.
	 * Using UUID v4 ensures global uniqueness and can be used as primary key instead of serial 1,2,3,4...
	 * Also, if we use 1,2,3,4... as primary key, then it
	 * 1) Be unprofessional
	 * 2) an attacker could figure out how many users are there on the platform if they get hold of this data
	 */
	id: uuid('id').defaultRandom().primaryKey(),

	/**
	 * The user name (e.g., 'alice').
	 * Must be unique within this instance to prevent impersonation.
	 */
	username: text('username').notNull().unique(),

	/**
	 * Argon2 hash of the user's password.
	 * becoz passwords cannot be stored as plain text :)
	 */
	passwordHash: text('password_hash').notNull(),

	/**
	 * The W3C DID Document stored as a JSON Binary Object.
	 * Storing this allows us to serve the /.well-known/did.json endpoint efficiently.
	 * I just discovered postgresql has a jsonb type. Nice!
	 */
	didDocument: jsonb('did_document').notNull(),

	/**
	 * Timestamp of when the account was created.
	 * Good practice for auditing and sorting :)
	 */
	createdAt: timestamp('created_at').defaultNow().notNull(),

	/**
	 * Display name for the user (e.g., "Alice Smith").
	 * This appears in the Actor JSON as 'name'.
	 */
	displayName: text('display_name'),

	/**
	 * User's bio/summary.
	 * This appears in the Actor JSON as 'summary'.
	 */
	bio: text('bio'),

	/**
	 * URL to the user's avatar image.
	 * Stored in Vercel Blob storage.
	 */
	avatarUrl: text('avatar_url')
});

/**
 * User Secrets Table
 * Stores sensitive data, i.e the private key seperate from the users table which has public readable data.
 */
export const userSecrets = pgTable('user_secrets', {
	/**
	 * Primary key for the secrets table.
	 * It is also a global UUID.
	 */
	id: uuid('id').defaultRandom().primaryKey(),

	/**
	 * Foreign Key linking these secrets to a specific user.
	 * If the user is deleted, their secrets should also be removed (cascade).
	 */
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),

	/**
	 * The Encrypted Private Key (PEM or JWK format).
	 * Don't store key as plaintext text in this plsssss
	 */
	encryptedPrivateKey: text('encrypted_private_key').notNull()
});

/**
 * Activities Table
 * Stores all ActivityPub activities (Create, Update, Delete, Follow, Like, etc.)
 * sent or received by this instance.
 */
export const activities = pgTable(
	'activities',
	{
		/**
		 * Unique identifier for the activity record.
		 */
		id: uuid('id').defaultRandom().primaryKey(),

		/**
		 * The local Actor who performed this activity.
		 * References the users table. Null if performed by a remote actor.
		 */
		actorId: uuid('actor_id')
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * The remote Actor who performed this activity.
		 * References the remote_actors table. Null if performed by a local actor.
		 */
		remoteActorId: uuid('remote_actor_id')
			.references(() => remoteActors.id, { onDelete: 'cascade' }),

		/**
		 * The full JSON-LD Activity object.
		 * Stored as jsonb for flexibility (schema-less).
		 * Includes standard fields: id, type, actor, object, published, to, cc.
		 */
		activity: jsonb('activity').notNull(),

		/**
		 * Visibility/Audience scoping.
		 * While 'to' and 'cc' are in the JSON, we might want indexed columns for faster filtering
		 * of Public vs Private posts if we were doing relational queries.
		 * For now, we rely on GIN indexing of the jsonb column or just filtering in code/query
		 * if the volume is low, but let's add a specific column for the top-level visibility
		 * optimization if needed later. For now, standard jsonb is fine as requested in Epic 2.1.4.
		 */

		/**
		 * Timestamp of when the activity was created/received.
		 */
		createdAt: timestamp('created_at').defaultNow().notNull(),

		/**
		 * Type of activity (Create, Note, etc) for easier indexing/filtering without parsing JSON
		 */
		type: text('type').notNull(),

		/**
		 * Denormalized like count for efficient display (Task 4.2.3).
		 */
		likesCount: integer('likes_count').notNull().default(0),

		/**
		 * Denormalized boost/announce count for efficient display (Task 4.3).
		 */
		boostsCount: integer('boosts_count').notNull().default(0)
	},
	(table) => {
		return {
			// Composite index for efficient outbox queries (sorted by date for a specific actor)
			// This is critical for User Story 2.2 - fetching activities by actorId ordered by createdAt
			actorCreatedAtIdx: index('activities_actor_created_at_idx').on(table.actorId, table.createdAt),
			remoteActorCreatedAtIdx: index('activities_remote_actor_created_at_idx').on(table.remoteActorId, table.createdAt),

			// Index for fast comment tree lookups (find all replies to a given post)
			inReplyToIdx: index('activities_in_reply_to_idx').using('btree', sql`((${table.activity}->'object'->>'inReplyTo'))`)
		};
	}
);

/**
 * Followers Table
 * Tracks who follows whom (local-to-local and local-to-remote).
 * Used for audience scoping (delivering to followers) and verifying read access.
 *
 * Follow request flow:
 *   1. User A clicks "Follow" on User B → row inserted with status = 'pending'
 *   2. User B accepts the request      → status updated to 'accepted'
 *   3. Only 'accepted' rows grant read access to followers-only posts.
 */
export const followers = pgTable(
	'followers',
	{
		/** Internal ID */
		id: uuid('id').defaultRandom().primaryKey(),

		/**
		 * The local user being followed (the target/leader).
		 */
		userId: uuid('user_id')
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * The remote user being followed.
		 */
		remoteUserId: uuid('remote_user_id')
			.references(() => remoteActors.id, { onDelete: 'cascade' }),

		/**
		 * The local user who is following (the follower/requester).
		 */
		followerId: uuid('follower_id')
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * The remote user who is following.
		 */
		remoteFollowerId: uuid('remote_follower_id')
			.references(() => remoteActors.id, { onDelete: 'cascade' }),

		/**
		 * Status of the follow relationship.
		 * 'pending'  – request sent, awaiting target user's approval
		 * 'accepted' – target user approved the follow
		 */
		status: text('status').notNull().default('pending'),

		/**
		 * When the follow relationship was created.
		 */
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => {
		return {
			// Prevent duplicate local-to-local follow relationships
			userFollowerUniqueIdx: uniqueIndex('followers_user_follower_idx').on(
				table.userId,
				table.followerId
			)
		};
	}
);

/**
 * Remote Actors Table
 * Caches Actor JSON-LD objects fetched from remote Fediverse instances.
 * Used to avoid repeated network calls when looking up remote users.
 * Cache is refreshed if older than 24 hours (handled in application logic).
 */
export const remoteActors = pgTable('remote_actors', {
	/**
	 * Unique identifier for this cached actor record.
	 */
	id: uuid('id').defaultRandom().primaryKey(),

	/**
	 * The full handle of the remote user (e.g., "gargron@mastodon.social").
	 * Unique so we don't store duplicates.
	 */
	handle: text('handle').notNull().unique(),

	/**
	 * The canonical Actor URI / ID (e.g., "https://mastodon.social/users/Gargron").
	 */
	actorUri: text('actor_uri').notNull().unique(),

	/**
	 * The domain of the remote instance (e.g., "mastodon.social").
	 * Indexed for efficient per-instance queries.
	 */
	domain: text('domain').notNull(),

	/**
	 * The full Actor JSON-LD object, cached as JSONB.
	 */
	actorJson: jsonb('actor_json').notNull(),

	/**
	 * When this actor was last fetched from the remote server.
	 * Used to determine if the cache needs refreshing (24h TTL).
	 */
	fetchedAt: timestamp('fetched_at').defaultNow().notNull(),

	/**
	 * When this record was first created.
	 */
	createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Interactions Table
 * Efficiently tracks user votes (upvotes/downvotes) on posts without parsing ActivityPub JSON blobs.
 */
export const interactions = pgTable(
	'interactions',
	{
		/**
		 * Unique identifier for the interaction.
		 */
		id: uuid('id').defaultRandom().primaryKey(),

		/**
		 * The URI/ID of the ActivityPub object being interacted with.
		 */
		postId: text('post_id').notNull(),

		/**
		 * The local Actor who performed this interaction.
		 * References the users table.
		 */
		actorId: uuid('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * Type of interaction ('upvote' or 'downvote').
		 */
		type: text('type').notNull(),

		/**
		 * When the interaction occurred.
		 */
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => {
		return {
			// Ensure a user can only have one active interaction per post at a time
			postActorUniqueIdx: uniqueIndex('interactions_post_actor_idx').on(table.postId, table.actorId)
		};
	}
);

/**
 * Federated Follows Table
 * Tracks follow relationships between local users and remote actors.
 * Used for the ActivityPub follow handshake:
 *   1. Local user sends Follow → status = "pending" (Task 3.2.4)
 *   2. Remote server sends Accept → status upgraded to "accepted" (Task 3.3.4)
 *
 * Separate from the `followers` table which only tracks local-to-local follows.
 */
export const federatedFollows = pgTable('federated_follows', {
	/**
	 * Unique identifier for this follow record.
	 */
	id: uuid('id').defaultRandom().primaryKey(),

	/**
	 * The local user who initiated the follow.
	 */
	localUserId: uuid('local_user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),

	/**
	 * The URI of the remote actor being followed
	 * (e.g., "https://mastodon.social/users/Gargron").
	 */
	remoteActorUri: text('remote_actor_uri').notNull(),

	/**
	 * Status of the follow handshake.
	 * "pending"  – Follow sent, awaiting Accept
	 * "accepted" – Remote server sent Accept
	 * "rejected" – Remote server sent Reject
	 */
	status: text('status').notNull().default('pending'),

	/**
	 * The ActivityPub ID of the outgoing Follow activity.
	 * Used to match incoming Accept/Reject activities to this record.
	 */
	followActivityId: text('follow_activity_id'),

	/**
	 * When this follow was created.
	 */
	createdAt: timestamp('created_at').defaultNow().notNull(),

	/**
	 * When this follow was last updated (e.g., status change).
	 */
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Custom Emojis Table
 * Stores metadata for custom emojis (shortcode and image URL).
 */
export const customEmojis = pgTable('custom_emojis', {
	/**
	 * Unique identifier for the emoji.
	 */
	id: uuid('id').defaultRandom().primaryKey(),

	/**
	 * The shortcode used in posts (e.g., ":blobcat:").
	 */
	shortcode: text('shortcode').notNull().unique(),

	/**
	 * The URL to the emoji image.
	 */
	imageUrl: text('image_url').notNull(),

	/**
	 * When this emoji was added.
	 */
	createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Likes Table (Task 4.2.2)
 * Tracks Like activities — which user liked which post.
 * Used to prevent duplicate likes and to generate Undo(Like) activities.
 */
export const likes = pgTable(
	'likes',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		/** The URI/ID of the post being liked. */
		postId: text('post_id').notNull(),

		/** The local user who liked the post. */
		actorId: uuid('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** The ActivityPub ID of the Like activity (used for Undo). */
		likeActivityId: text('like_activity_id').notNull(),

		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => {
		return {
			// One like per user per post
			postActorUniqueIdx: uniqueIndex('likes_post_actor_idx').on(table.postId, table.actorId)
		};
	}
);

/**
 * Notifications Table (Task 4.4.1)
 * Aggregates inbound activities directed at the user:
 * follow requests, likes, replies, mentions, boosts.
 */
export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		/** The local user receiving the notification. */
		recipientId: uuid('recipient_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** The actor who triggered the notification (local user ID or null for remote). */
		actorId: uuid('actor_id')
			.references(() => users.id, { onDelete: 'cascade' }),

		/** URI of the remote actor who triggered the notification (null for local). */
		remoteActorUri: text('remote_actor_uri'),

		/** Notification type. */
		type: text('type').notNull(), // 'follow' | 'like' | 'reply' | 'mention' | 'boost'

		/** The ActivityPub object ID related to this notification (e.g. post URI). */
		objectId: text('object_id'),

		/** Whether the user has read this notification. */
		read: boolean('read').notNull().default(false),

		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => {
		return {
			// Fast lookup of unread notifications for a user
			recipientReadIdx: index('notifications_recipient_read_idx').on(table.recipientId, table.read),
			recipientCreatedAtIdx: index('notifications_recipient_created_at_idx').on(table.recipientId, table.createdAt)
		};
	}
);
