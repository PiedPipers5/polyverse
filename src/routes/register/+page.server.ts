import { fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { users, userSecrets } from "$lib/server/db/schema";
import { generateDidWeb } from "$lib/server/didServer";
import { encrypt } from "$lib/server/encryption";
import { eq } from "drizzle-orm";
import z from "zod";
import * as argon2 from "argon2";
import { createToken, AUTH_COOKIE_NAME, cookieOptions } from '$lib/server/auth';
import type { Actions, PageServerLoad } from "./$types";

// Redirect if already logged in
export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) {
        throw redirect(302, '/profile');
    }
    return {};
};

// Zod Schema for validation
const registerSchema = z.object({
    username: z.string()
        .min(5, { message: "Username must be at least 5 characters" })
        .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string()
        .min(8, { message: "Password must be at least 8 characters" })
        .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
        .regex(/[0-9]/, { message: "Password must contain at least one number" })
        .regex(/[!@#$%^&*\-+]/, { message: "Password must contain at least one special character [!,@,#,$,%,^,&,*,-,+]" }),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type UserAuthData = z.infer<typeof registerSchema>;

export const actions: Actions = {
    default: async ({ request, cookies }) => {
        const formData = await request.formData();

        const usernameRaw = formData.get("username");
        const passwordRaw = formData.get("password");
        const confirmPasswordRaw = formData.get("confirmPassword");

        // Validate username and password with zod
        const isValid = registerSchema.safeParse({
            username: usernameRaw?.toString(),
            email: formData.get("email")?.toString(),
            password: passwordRaw?.toString(),
            confirmPassword: confirmPasswordRaw?.toString()
        })

        // Return failure if validation fails
        if (!isValid.success) {
            // Flatten errors for easier frontend handling
            const formattedErrors = isValid.error.flatten();
            return fail(400, {
                errors: formattedErrors.fieldErrors.username?.[0] ||
                    formattedErrors.fieldErrors.email?.[0] ||
                    formattedErrors.fieldErrors.password?.[0] ||
                    formattedErrors.fieldErrors.confirmPassword?.[0] ||
                    "Invalid input"
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
                email: validatedUserData.email,
                passwordHash: pswdHash,
                didDocument: didResult.didDocument
            }).returning({ id: users.id });

            // Add secrets to separate db
            await db.insert(userSecrets).values({
                userId: newUser.id,
                encryptedPrivateKey: encryptedPrivateKey
            });

            // --- Auto Login Logic ---

            // Create JWT token
            const token = await createToken({
                userId: newUser.id,
                did: didResult.did,
                username: validatedUserData.username,
            });

            // Set auth cookie
            cookies.set(AUTH_COOKIE_NAME, token, cookieOptions);

            // Redirect to profile
            throw redirect(302, '/profile');

        } catch (e) {
            // Handle redirects explicitly
            if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
                throw e;
            }

            console.log("Error when trying to register new user: ", e);
            return fail(500, { errors: "Internal Server Error" });
        }
    }
}