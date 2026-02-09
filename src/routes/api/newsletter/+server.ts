import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { RESEND_API_KEY, POLYVERSE_NOTIFICATION_EMAIL } from '$env/static/private';

// Email validation schema
const emailSchema = z.object({
    email: z.string().email('Invalid email address')
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Parse request body
        const body = await request.json();

        // Validate email
        const result = emailSchema.safeParse(body);

        if (!result.success) {
            return json(
                {
                    success: false,
                    error: 'Invalid email address'
                },
                { status: 400 }
            );
        }

        const { email } = result.data;

        // Send email notification using Resend
        try {
            console.log('🔍 Starting email send process...');
            console.log('📧 Recipient email:', email);
            console.log('🔑 API Key present:', !!RESEND_API_KEY);
            console.log('📬 Notification email:', POLYVERSE_NOTIFICATION_EMAIL);

            const { Resend } = await import('resend');
            const resend = new Resend(RESEND_API_KEY);

            const emailSendResult = await resend.emails.send({
                from: 'POLYVERSE <onboarding@resend.dev>',
                to: POLYVERSE_NOTIFICATION_EMAIL || 'hello@polyverse.com',
                subject: '🎉 New Newsletter Signup - POLYVERSE',
                html: `
					<h2>New Newsletter Signup!</h2>
					<p><strong>Email:</strong> ${email}</p>
					<p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
					<hr>
					<p style="color: #666; font-size: 12px;">This notification was sent from your POLYVERSE landing page newsletter form.</p>
				`
            });

            console.log('✅ Email sent successfully!', emailSendResult);
            console.log('📨 Email ID:', emailSendResult.data?.id);
        } catch (emailError: any) {
            // Log detailed error
            console.error('❌ Failed to send email notification:');
            console.error('Error details:', emailError);
            console.error('Error message:', emailError?.message);
            console.error('Error name:', emailError?.name);

            // Still log the signup
            console.log('📧 Newsletter signup (email failed):', {
                email,
                timestamp: new Date().toISOString()
            });
        }

        return json({
            success: true,
            message: 'Successfully subscribed to newsletter!'
        });
    } catch (error) {
        console.error('Newsletter signup error:', error);
        return json(
            {
                success: false,
                error: 'An error occurred. Please try again later.'
            },
            { status: 500 }
        );
    }
};
