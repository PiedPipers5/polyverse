import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

/**
 * Evaluates a given text for NSFW content and identifies specific explicit words.
 * 
 * @param text The text content to evaluate
 * @returns { isNsfw: boolean, flaggedWords: string[] } Object containing NSFW status and specific terms tagged
 */
export async function isContentNsfw(text: string): Promise<{ isNsfw: boolean, flaggedWords: string[] }> {
    if (!text || text.trim() === '') return { isNsfw: false, flaggedWords: [] };

    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
        console.warn('DEBUG: GOOGLE_GENERATIVE_AI_API_KEY is missing. Skipping NSFW check.');
        return { isNsfw: false, flaggedWords: [] }; // Fail open if no API key
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a strict content moderation AI. Analyze the following text and determine if it contains NSFW (Not Safe For Work) content. This includes, but is not limited to:
- Sexually explicit content or nudity descriptions
- Extreme violence or gore
- Hate speech or severe harassment
- Illegal acts
- Profanity, swearing, strong language, or cursing

If the content is safe, respond ONLY with:
[]

If the content contains NSFW elements or profanity, respond ONLY with a valid JSON array of strings containing the exact explicit/NSFW words or phrases that should be censored from the text. Make sure the words precisely match the text.
Example response: ["f-word", "gore-word"]

Text to analyze:
"${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const answer = response.text().trim();

        try {
            const flaggedWords = JSON.parse(answer);
            if (Array.isArray(flaggedWords) && flaggedWords.length > 0) {
                return { isNsfw: true, flaggedWords };
            }
            return { isNsfw: false, flaggedWords: [] };
        } catch (e) {
            // Fallback if AI didn't return valid JSON
            return { isNsfw: false, flaggedWords: [] };
        }
    } catch (e) {
        console.error('DEBUG: AI NSFW check failed:', e);
        return { isNsfw: false, flaggedWords: [] }; // Fail open on error
    }
}
