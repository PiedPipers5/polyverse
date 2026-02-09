# Email Newsletter Configuration

The newsletter signup form now sends emails to a real API endpoint. Here's how to set it up:

## Current Implementation

The API endpoint is at `/api/newsletter` and currently:
- ✅ Validates email addresses
- ✅ Logs submissions to console
- ✅ Returns proper success/error responses
- 🔄 Ready for email service integration

## Quick Start (Console Logging)

**Right now**, when someone submits their email:
1. It validates the email format
2. Logs to your terminal console:
   ```
   📧 Newsletter signup: {
     email: "user@example.com",
     timestamp: "2026-02-09T...",
     notifyTo: "hello@polyverse.com"
   }
   ```
3. Shows success message to user

**Check your dev server terminal** to see email submissions in real-time!

---

## Email Service Integration (Choose One)

### Option 1: Resend (Recommended - Easy & Free Tier)

1. **Sign up**: https://resend.com
2. **Install package**:
   ```bash
   bun add resend
   ```
3. **Add to `.env`**:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   POLYVERSE_NOTIFICATION_EMAIL=your-email@polyverse.com
   ```
4. **Update `src/routes/api/newsletter/+server.ts`**:
   ```typescript
   import { Resend } from 'resend';
   
   const resend = new Resend(process.env.RESEND_API_KEY);
   const POLYVERSE_EMAIL = process.env.POLYVERSE_NOTIFICATION_EMAIL;
   
   // In the POST handler, replace the TODO section:
   await resend.emails.send({
     from: 'POLYVERSE <onboarding@resend.dev>',
     to: POLYVERSE_EMAIL,
     subject: 'New Newsletter Signup',
     html: `<p>New signup: <strong>${email}</strong></p>`
   });
   ```

### Option 2: Store in Database

If you want to collect emails in your database for later:

1. **Create schema** in `src/lib/server/db/schema.ts`:
   ```typescript
   export const newsletterSignups = pgTable('newsletter_signups', {
     id: serial('id').primaryKey(),
     email: text('email').notNull().unique(),
     createdAt: timestamp('created_at').defaultNow().notNull()
   });
   ```

2. **Run migration**:
   ```bash
   bun run db:generate
   bun run db:push
   ```

3. **Update API endpoint**:
   ```typescript
   import { db } from '$lib/server/db';
   import { newsletterSignups } from '$lib/server/db/schema';
   
   // In POST handler:
   await db.insert(newsletterSignups).values({
     email: email
   });
   ```

### Option 3: Mailchimp/ConvertKit

1. Sign up for service
2. Get API key
3. Install SDK: `bun add @mailchimp/mailchimp_marketing` or equivalent
4. Add to API endpoint

---

## Testing the Integration

1. **Start dev server**: `bun run dev`
2. **Open**: http://localhost:5173
3. **Scroll to CTA section**
4. **Enter email**: test@example.com
5. **Submit**:
   - ✅ Should show "Subscribing..." loading state
   - ✅ Should show success checkmark after submission
   - ✅ Check terminal console for log entry
6. **Try invalid email**: test@
   - ❌ Should show error message

## Current Configuration

Environment variable in `.env`:
```env
POLYVERSE_NOTIFICATION_EMAIL=hello@polyverse.com
```

Change this to your actual email address where you want to receive notifications!

---

## What Happens Now

**User enters email** → **Form validates** → **Sends to /api/newsletter** → **Logs to console** → **Shows success message**

**Next step**: Choose an integration option above to actually send/store emails!
