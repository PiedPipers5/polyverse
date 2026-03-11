import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';

const resend = new Resend(RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `http://localhost:5173/reset-password/${token}`; // TODO: Use dynamic origin

    // Always log to console in development so the user can see the link even if email fails
    console.log('------------------------------------------');
    console.log('🔑 PASSWORD RESET REQUEST');
    console.log(`📧 To: ${email}`);
    console.log(`🔗 Link: ${resetLink}`);
    console.log('------------------------------------------');

    try {
        await resend.emails.send({
            from: 'Polyverse <onboarding@resend.dev>',
            to: email,
            subject: 'Reset your Polyverse password',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                    <h2 style="color: #8b5cf6;">Password Reset Request</h2>
                    <p>We received a request to reset your password for your Polyverse account.</p>
                    <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #666;">Polyverse - Decentralized Social Protocol</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Failed to send password reset email via Resend:', error);
    }
}
