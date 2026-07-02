/**
 * tools/documentTool.js
 * ---------------------
 * The Document Tool — this IS the original RAG pipeline, extracted into a
 * reusable module. It performs classic retrieval-augmented generation:
 *
 *   1. Embed the user's question with the shared LOCAL embeddings.
 *   2. Retrieve the top-k most similar chunks from Qdrant.
 *   3. Stuff those chunks into a grounding prompt.
 *   4. Ask the OpenRouter chat model to answer using ONLY that context.
 *
 * Nothing about the retrieval behaviour changed from the original app —
 * same system prompt, same k=3, same chain — it just lives behind a clean
 * function interface now so the agent executor can call it as a tool.
 */

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getVectorStore } from "../services/qdrant.js";
import { createLLM } from "../services/llm.js";

/** Number of chunks to retrieve per question (kept from the original app). */
const TOP_K = 3;

/**
 * System prompt for the RAG chain. `{context}` is filled with retrieved
 * chunks at invoke time; the prior conversation is supplied separately via a
 * MessagesPlaceholder (see below).
 *
 * IMPORTANT (memory fix): the previous prompt said "use ONLY the retrieved
 * context ... otherwise say you don't know", which made the model discard
 * facts the user had stated earlier in the conversation (e.g. "my company is
 * OpenAI"). It now explicitly answers from BOTH the conversation and the
 * retrieved context, and only falls back to "I don't know" when neither has
 * the answer.
 */
const RAG_SYSTEM_TEMPLATE = `You are a helpful, conversational assistant with memory of this chat.

Answer the user's question using BOTH sources below:
1. The earlier conversation — the user may have told you facts about themselves
   (their name, employer, preferences, etc.). Treat those as true.
2. The retrieved document context.

Rules:
- If the user told you something earlier, use it and refer back to it naturally
  (e.g. "You previously told me you work for OpenAI.").
- If the answer is in the document context, answer from it.
- Only say you don't know if neither the conversation nor the context contains
  the answer. Keep the answer concise.

Retrieved document context:
{context}`;

/**
 * Convert the frontend's plain history array into LangChain chat messages.
 * Unknown/malformed entries are skipped so a bad payload can never crash the
 * request. Returns an empty array when no usable history is supplied.
 *
 * @param {Array<{role: string, content: string}>} history
 * @returns {import("@langchain/core/messages").BaseMessage[]}
 */
function toHistoryMessages(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );
}

/**
 * Answer a question from the ingested knowledge base, optionally aware of the
 * prior conversation so follow-up questions ("who do I work for?") resolve.
 *
 * @param {string} query - the user's natural-language question
 * @param {Array<{role: string, content: string}>} [history] - prior turns
 * @returns {Promise<{tool: string, answer: string, context: string[]}>}
 *          unified tool result; `context` carries the retrieved chunks so
 *          the frontend can show "Retrieved from N chunks."
 */
export async function documentTool(query, history = []) {
  // 1–2. Connect to Qdrant and retrieve the most relevant chunks.
  //      getVectorStore() throws a descriptive error if Qdrant is down
  //      or nothing has been ingested yet.
  const vectorStore = await getVectorStore();
  const retriever = vectorStore.asRetriever({ k: TOP_K });
  const retrievedDocs = await retriever.invoke(query);

  // 3. Concatenate the chunk texts into a single context block.
  const context = retrievedDocs.map((doc) => doc.pageContent).join("\n\n");

  // 4. Build the grounding prompt (system + prior turns + current question)
  //    and run: prompt -> LLM -> plain string. The MessagesPlaceholder is
  //    filled with an empty list when no history is provided, so behaviour
  //    for old { query } requests is unchanged.
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", RAG_SYSTEM_TEMPLATE],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
  const llm = createLLM({ temperature: 0.2 });
  const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);

  const answer = await chain.invoke({
    context,
    input: query,
    history: toHistoryMessages(history),
  });

  return {
    tool: "document",
    answer,
    context: retrievedDocs.map((doc) => doc.pageContent),
  };
}
