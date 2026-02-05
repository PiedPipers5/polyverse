import { fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { users, userSecrets } from "$lib/server/db/schema";
import { generateDidWeb } from "$lib/server/didServer";
import { encrypt } from "$lib/server/encryption";
import { eq } from "drizzle-orm";
import z from "zod";
import * as argon2 from "argon2";
import type { Actions } from "./$types";

// Zod Schema for validation
const registerSchema = z.object({
    username: z.string()
        .min(5, { message: "Username must be at least 5 characters" })
        .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" }),
    password: z.string()
        .min(12, { message: "Password must be at least 12 characters" })
        .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
        .regex(/[0-9]/, { message: "Password must contain at least one number" })
        .regex(/[!@#$%^&*\-+]/, { message: "Password must contain at least one special character [!,@,#,$,%,^,&,*,-,+]" }),
});

type UserAuthData = z.infer<typeof registerSchema>;


export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();

        const usernameRaw = formData.get("username");
        const passwordRaw = formData.get("password");

        // Validate username and password with zod
        const isValid = registerSchema.safeParse({
            username: usernameRaw?.toString(),
            password: passwordRaw?.toString()
        })

        // Return failure if validation fails
        if (!isValid.success) {
            return fail(400, {
                errors: z.prettifyError(isValid.error)
            });
        }

        const validatedUserData: UserAuthData = isValid.data;

        try {

            // Check if user is already existing:
            const userExisting = await db.select().from(users).where(eq(users.username, validatedUserData.username));


            if (userExisting.length > 0) {
                return fail(409, { errors: "Username already taken" });
            }

            // Hash Password with Argon2
            const pswdHash = await argon2.hash(validatedUserData.password);

            // Generate a new DID Identity for this user
            const didResult = await generateDidWeb(validatedUserData.username);

            // Encrypt Private key
            const encryptedPrivateKey = encrypt(didResult.privateKey);

            // Add public viewable user data
            const [newUser] = await db.insert(users).values({
                username: validatedUserData.username,
                passwordHash: pswdHash,
                didDocument: didResult.didDocument
            }).returning({ id: users.id });

            // Add secrets to separate db
            await db.insert(userSecrets).values({
                userId: newUser.id,
                encryptedPrivateKey: encryptedPrivateKey
            });

            return {
                success: true,
                did: didResult.did
            }

        } catch (e) {
            console.log("Error when trying to register new user: ", e);
            return fail(500, { errors: "Internal Server Error" });
        }
    }
}