import { GoogleGenAI } from "@google/genai";
async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('No API key'); process.exit(1); }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.list();
  for await (const model of response) {
    if (model.name.includes("flash") && !model.name.includes("-vision")) {
      console.log(model.name);
    }
  }
}
listModels();
