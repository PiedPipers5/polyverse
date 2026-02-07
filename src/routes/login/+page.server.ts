import { fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import z from "zod";
import * as argon2 from "argon2";
import type { Actions } from "./$types";

/* ============================
   Validation Schema
   ============================ */
const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
});

type LoginData = z.infer<typeof loginSchema>;

export const actions: Actions = {
    default: async ({ request, cookies }) => {
        const formData = await request.formData();

        const usernameRaw = formData.get("username");
        const passwordRaw = formData.get("password");

        /* Validate input */
        const parsed = loginSchema.safeParse({
            username: usernameRaw?.toString(),
            password: passwordRaw?.toString()
        });

        if (!parsed.success) {
            return fail(400, {
                errors: z.prettifyError(parsed.error)
            });
        }

        const credentials: LoginData = parsed.data;

        try {
            /* Fetch user */
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.username, credentials.username));

            if (!user) {
                return fail(401, { errors: "Invalid username or password" });
            }

            /* Verify password */
            const validPassword = await argon2.verify(
                user.passwordHash,
                credentials.password
            );

            if (!validPassword) {
                return fail(401, { errors: "Invalid username or password" });
            }

            /* =====================================
               JWT is set by BACKEND ONLY
               (example placeholder)
               ===================================== */

            // cookies.set("auth_token", JWT, {
            // 	httpOnly: true,
            // 	secure: true,
            // 	sameSite: "strict",
            // 	path: "/"
            // });

            /* Return safe user object */
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.username
                }
            };
        } catch (err) {
            console.error("Login error:", err);
            return fail(500, { errors: "Internal Server Error" });
        }
    }
};
