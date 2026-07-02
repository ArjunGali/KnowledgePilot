import { ChatOpenAI } from "@langchain/openai";

const plannerLLM = new ChatOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI Agent"
    }
  },
  modelName: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  temperature: 0
});

export async function plan(query) {

  const prompt = `
You are an AI planner.

Choose ONLY one tool.

Available tools:

document
calculator
date
web

Respond ONLY with valid JSON.

Example:

{
  "tool":"document",
  "reason":"..."
}

Question:

${query}
`;

  const response = await plannerLLM.invoke(prompt);

  try {
    return JSON.parse(response.content);
  } catch {

    return {
      tool: "document",
      reason: "Fallback"
    };

  }

}