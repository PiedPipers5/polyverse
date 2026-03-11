import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

/**
 * Evaluates if a given text contains NSFW (Not Safe For Work) content
 * using the Google Gemini API.
 * 
 * @param text The text content to evaluate
 * @returns true if flagged as NSFW, false otherwise
 */
export async function isContentNsfw(text: string): Promise<boolean> {
    if (!text || text.trim() === '') return false;

    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
        console.warn('DEBUG: GOOGLE_GENERATIVE_AI_API_KEY is missing. Skipping NSFW check.');
        return false; // Fail open if no API key
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a strict content moderation AI. Analyze the following text and determine if it contains NSFW (Not Safe For Work) content. This includes, but is not limited to:
- Sexually explicit content or nudity descriptions
- Extreme violence or gore
- Hate speech or severe harassment
- Illegal acts

If the content is NSFW, respond ONLY with "true".
If the content is safe, respond ONLY with "false".
Do not include any other text or explanations.

Text to analyze:
"${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const answer = response.text().trim().toLowerCase();

        return answer === 'true';
    } catch (e) {
        console.error('DEBUG: AI NSFW check failed:', e);
        return false; // Fail open on error
    }
}
