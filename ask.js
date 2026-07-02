import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import "dotenv/config";

async function run() {
  const query = process.argv[2];
  if (!query) {
    console.error("Please provide a question. Usage: node ask.js \"Your question here\"");
    process.exit(1);
  }

  console.log(`Question: "${query}"\n`);

  // 1. Initialize OpenRouter Embeddings (same as ingest.js)
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelName: "nomic-ai/nomic-embed-text",
  });

  // 2. Connect to Qdrant Vector Store
  let vectorStore;
  try {
    vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: "rag_collection",
    });
  } catch (error) {
    console.error("Failed to connect to Qdrant. Make sure it's running and ingest.js has been run.");
    console.error(error.message);
    process.exit(1);
  }

  const retriever = vectorStore.asRetriever({ k: 3 }); // Retrieve top 3 chunks

  // 3. Initialize OpenRouter Chat Model
  // We use ChatOpenAI but point it to OpenRouter
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://localhost:3000", // Required by OpenRouter
        "X-Title": "Node RAG App",
      }
    },
    modelName: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // Using the model you provided, or any other free model like "mistralai/mistral-7b-instruct:free"
    temperature: 0.2,
  });

  // 4. Create the RAG Prompt Template
  const systemTemplate = `You are a helpful assistant for question-answering tasks. 
Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know. 
Keep the answer concise.

Context:
{context}

Answer:`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["human", "{input}"],
  ]);

  // 5. Build and run the retrieval chain
  console.log("Thinking...");
  const questionAnswerChain = await createStuffDocumentsChain({ llm, prompt });
  const ragChain = await createRetrievalChain({
    retriever,
    combineDocsChain: questionAnswerChain,
  });

  const response = await ragChain.invoke({ input: query });

  console.log("\n=============================================");
  console.log("Answer:");
  console.log(response.answer);
  console.log("=============================================\n");
  console.log("Source Documents used:");
  response.context.forEach((doc, i) => {
    console.log(`[${i + 1}] ${doc.pageContent.substring(0, 100)}...`);
  });
}

run().catch(console.error);
