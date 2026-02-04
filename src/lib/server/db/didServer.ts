import * as jose from 'jose';
import { env } from "$env/dynamic/private";

// Type definition for the result
interface DidGenerationResult {
    did: string;
    didDocument: any; // Using 'any' for simplicity, but strictly this is a DID Document interface
    privateKey: string; // The private key (JWK format) to store securely
    publicKey: string;  // The public key (JWK format)
}


/**
 * Generates a did:web identifier and document for a new user.
 * @param username - The username being registered (e.g., 'karthik')
 * @param domain - The domain of your instance (e.g., 'social.example.com')
 */
export async function generateDidWeb(username: string): Promise<DidGenerationResult> {
    // get the domain from the environment variable
    const domain: string = env.DOMAIN!;

    // Generate a Ed25519 Key Pair 
    // 'EdDSA' is the algorithm family for Ed25519
    const { privateKey, publicKey } = await jose.generateKeyPair('EdDSA', {
        extractable: true, // Allows us to export the key to save it
    });

    // Create a DID string
    // Format: did:web:<domain>:u:<username>
    // Note: Standard did:web usually maps to the root domain. 
    // For users, we often namespace them. We decided to do it as did:web:instance.com:u:karthik
    const did = `did:web:${domain}:u:${username}`;

    // Export keys to JSON web key (JWK)
    const privateKeyJWK = await jose.exportJWK(privateKey);
    const publicKeyJWK = await jose.exportJWK(publicKey);

    // Create the Verification Method ID
    // This is a unique ID for the specific key within the document
    const keyId = `${did}#owner`;

    // Construct a W3C-compliant DID Document JSON 
    const didDocument = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/jws-2020/v1"
        ],
        "id": did,
        "verificationMethod": [
            {
                "id": keyId,
                "type": "JsonWebKey2020",
                "controller": did,
                "publicKeyJwk": publicKeyJWK
            }
        ],
        // authentication to prove you are the one logging in or acting
        "authentication": [
            keyId
        ],
        // assertionMethod is for signing posts/activities
        "assertionMethod": [
            keyId
        ]
    };

    return {
        did,
        didDocument,
        privateKey: JSON.stringify(privateKeyJWK), // TODO: Save this private key securely
        publicKey: JSON.stringify(publicKeyJWK)
    };
}