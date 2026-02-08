import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

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
    avatarUrl: text('avatar_url'),
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
    encryptedPrivateKey: text('encrypted_private_key').notNull(),
});