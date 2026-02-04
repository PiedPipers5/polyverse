import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Ensure existance of encryption key
if (!env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is missing from .env");
}

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

// Algorithm Parameters
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;


/**
 * Encrypts a the user's private key)
 * Return something like: "iv:authTag:encryptedContent"
 */
export function encrypt(text: string): string {
    // Generate a random Initialization Vector (IV)
    // iv is used so that encrypting the same data twice results in different outputs
    const iv = randomBytes(IV_LENGTH);

    // Create the cipher
    const cipher = createCipheriv(ALGORITHM, KEY, iv);

    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the Auth Tag (integrity check)
    const authTag = cipher.getAuthTag().toString('base64');

    // Return the combined string
    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}


/**
 * Decrypts the data back to the original string.
 */
export function decrypt(encryptedText: string): string {
    // Split the string back into parts
    const [ivHex, authTagB64, contentB64] = encryptedText.split(':');

    if (!ivHex || !authTagB64 || !contentB64) {
        throw new Error('Invalid encrypted string format');
    }

    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // Create the decipher
    const decipher = createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(contentB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}