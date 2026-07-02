import * as fs from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import "dotenv/config";

async function run() {
  console.log("Starting ingestion process...");

  // 1. Prepare sample data
  const dataDir = "./data";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    fs.writeFileSync(
      `${dataDir}/sample.txt`,
      "Qdrant is a vector database & vector similarity search engine. It deploys as an API service providing search for the nearest high-dimensional vectors. \n\n" +
      "OpenRouter is an AI model router that provides a unified API to access many LLMs including OpenAI, Anthropic, and open-source models."
    );
    console.log("Created sample data directory and file.");
  }

  // 2. Load the document
  console.log("Loading documents...");
  const text = fs.readFileSync(`${dataDir}/sample.txt`, "utf8");

  // 3. Split the text into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const docs = await splitter.createDocuments([text]);
  console.log(`Split document into ${docs.length} chunks.`);

  // 4. Initialize OpenRouter Embeddings
  // We use OpenAIEmbeddings but override the base URL to point to OpenRouter
  console.log("Initializing OpenRouter Embeddings...");
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelName: "nomic-ai/nomic-embed-text", // Free embedding model on OpenRouter
  });

  // 5. Store embeddings in Qdrant
  console.log("Connecting to Qdrant and storing vectors...");
  try {
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: "rag_collection",
    });
    console.log("Ingestion completed successfully!");
  } catch (error) {
    console.error("Error storing vectors in Qdrant:", error.message);
    console.log("\nMake sure Docker is running and you have started Qdrant:");
    console.log("docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant");
  }
}

run().catch(console.error);
