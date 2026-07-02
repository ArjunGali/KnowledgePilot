import express from "express";
import cors from "cors";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import "dotenv/config";
import { plan } from "./agent/planner.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@xenova/transformers";

class LocalEmbeddings extends Embeddings {
  constructor() {
    super({});
  }
  async getPipeline() {
    if (!this.pipeline) {
      this.pipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return this.pipeline;
  }
  async embedDocuments(documents) {
    const pipe = await this.getPipeline();
    const results = await Promise.all(documents.map(text => pipe(text, { pooling: "mean", normalize: true })));
    return results.map(res => Array.from(res.data));
  }
  async embedQuery(document) {
    const pipe = await this.getPipeline();
    const res = await pipe(document, { pooling: "mean", normalize: true });
    return Array.from(res.data);
  }
}

const embeddings = new LocalEmbeddings();

const getQdrantVectorStore = async () => {
  return await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    collectionName: "rag_collection",
  });
};

app.post("/api/ingest", async (req, res) => {
  try {
    const docPath = "c:\\Users\\phani\\OneDrive\\Documenten\\Rag\\Nvidia DOC.docx";
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ error: "Document not found at the specified path." });
    }

    console.log("Reading text from file...");
    const text = fs.readFileSync(docPath, "utf-8");

    console.log("Splitting text into chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const docs = await splitter.createDocuments([text]);
    console.log(`Split document into ${docs.length} chunks.`);

    console.log("Connecting to Qdrant and storing vectors...");
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: "rag_collection",
    });

    console.log("Ingestion completed successfully!");
    res.json({ message: "Ingestion completed successfully!", chunks: docs.length });
  } catch (error) {
    console.error("Error during ingestion:", error);
    res.status(500).json({ error: "Failed to ingest document", details: error.message });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Ask the planner which tool should be used
    const plannerResult = await plan(query);

    console.log("Planner Decision:", plannerResult);

    console.log(`Question: "${query}"`);
    let vectorStore;
    try {
      vectorStore = await getQdrantVectorStore();
    } catch (e) {
      return res.status(500).json({ error: "Failed to connect to Qdrant. Make sure it is running and ingest has been run." });
    }

    const retriever = vectorStore.asRetriever({ k: 3 });

    const llm = new ChatOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Node RAG App",
        }
      },
      modelName: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      temperature: 0.2,
    });

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

  const lowerQuery = query.toLowerCase();

let selectedTool = "document";

if (
    lowerQuery.includes("calculate") ||
    lowerQuery.includes("+") ||
    lowerQuery.includes("-") ||
    lowerQuery.includes("*") ||
    lowerQuery.includes("/")
) {
    selectedTool = "calculator";
}
else if (
    lowerQuery.includes("today") ||
    lowerQuery.includes("date") ||
    lowerQuery.includes("time")
) {
    selectedTool = "date";
}

if (selectedTool === "document") {
    // Existing RAG code
}
else if (selectedTool === "calculator") {
    // Calculator
}
else if (selectedTool === "date") {
    // Date
}

const context = retrievedDocs.map((doc) => doc.pageContent).join("\n\n");

    const chain = RunnableSequence.from([
      prompt,
      llm,
      new StringOutputParser()
    ]);

    const answer = await chain.invoke({
      context: context,
      input: query,
    });
    
    res.json({
      answer: answer,
      context: retrievedDocs.map(doc => doc.pageContent),
    });
  } catch (error) {
    console.error("Error during ask:", error);
    res.status(500).json({ error: "Failed to process query", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});

import { plan } from "./agent/planner.js";