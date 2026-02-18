import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

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
		 * The Actor who performed this activity.
		 * References the users table.
		 */
		actorId: uuid('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

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
		type: text('type').notNull()
	},
	(table) => {
		return {
			// Composite index for efficient outbox queries (sorted by date for a specific actor)
			// This is critical for User Story 2.2 - fetching activities by actorId ordered by createdAt
			actorCreatedAtIdx: index('activities_actor_created_at_idx').on(table.actorId, table.createdAt)

			// Note: GIN index on JSONB column for filtering by to/cc fields
			// will be created via SQL migration as Drizzle doesn't support .using() in type-safe API
			// This helps with User Story 2.3 - filtering activities by audience/visibility
		};
	}
);

/**
 * Followers Table
 * Tracks who follows whom.
 * Used for audience scoping (delivering to followers) and verifying read access.
 */
export const followers = pgTable(
	'followers',
	{
		/**
		 * The user being followed (the leader/target).
		 */
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * The user who is following (the follower).
		 */
		followerId: uuid('follower_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/**
		 * When the follow relationship was established.
		 */
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => {
		return {
			pk: { columns: [table.userId, table.followerId] } // Composite primary key
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
