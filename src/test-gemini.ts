import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

async function testGemini() {
    try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) throw new Error("No API key");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent('Hi');
        console.log("Success with gemini-2.5-flash:", result.response.text());
    } catch (e) {
        console.error("Error with gemini-2.5-flash:", e.message);
    }
}
testGemini();
