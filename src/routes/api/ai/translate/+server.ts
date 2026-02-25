import { error, json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    const user = locals.user;

    // 1. Authentication Check
    if (!user) {
        throw error(401, 'Unauthorized');
    }

    const { text, targetLanguage = 'en' } = await request.json();

    if (!text) {
        throw error(400, 'Text is required for translation.');
    }

    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
        console.error('DEBUG: GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables.');
        throw error(500, 'AI Translation is not configured. Please check your .env file.');
    }

    console.log('DEBUG: Attempting translation using Gemini API...');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Translate the following text into the language with ISO code "${targetLanguage}". 
Respond ONLY with the translated text. Do not include any explanations or extra information.

Text to translate:
"${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = response.text().trim();

        return json({ translatedText });
    } catch (e: any) {
        console.error('DEBUG: AI Translation error details:', e);
        const errorMessage = e?.message || 'Failed to translate text.';
        throw error(500, errorMessage);
    }
};
