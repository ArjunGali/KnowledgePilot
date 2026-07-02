/**
 * ingest.js
 * ---------
 * CLI ingestion utility: `npm run ingest` / `node ingest.js [path-to-txt]`.
 *
 * Creates sample data on first run (original behaviour), splits it into
 * chunks and stores it in Qdrant through the shared services — which means
 * it now uses the SAME local Xenova embeddings as the server. (Previously
 * this script used 768-dim cloud embeddings while the server queried with
 * 384-dim local ones, breaking retrieval with a dimension mismatch.)
 */

import * as fs from "fs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ingestDocuments, QDRANT_URL, COLLECTION_NAME } from "./services/qdrant.js";

async function run() {
  console.log("Starting ingestion process...");

  // 1. Resolve input: an optional file path argument, else the sample file
  //    (created on first run — original behaviour preserved).
  let filePath = process.argv[2];
  if (!filePath) {
    const dataDir = "./data";
    filePath = `${dataDir}/sample.txt`;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        "Qdrant is a vector database & vector similarity search engine. It deploys as an API service providing search for the nearest high-dimensional vectors. \n\n" +
          "OpenRouter is an AI model router that provides a unified API to access many LLMs including OpenAI, Anthropic, and open-source models."
      );
      console.log("Created sample data directory and file.");
    }
  }

  // 2. Load the document (plain text only for the CLI; use the API for
  //    PDF/DOCX uploads).
  console.log(`Loading ${filePath}...`);
  const text = fs.readFileSync(filePath, "utf8");

  // 3. Split the text into chunks (same parameters as the server).
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const docs = await splitter.createDocuments([text], [{ source: filePath }]);
  console.log(`Split document into ${docs.length} chunks.`);

  // 4. Embed locally and store in Qdrant via the shared service.
  console.log(`Storing vectors in Qdrant (${QDRANT_URL}, collection "${COLLECTION_NAME}")...`);
  try {
    await ingestDocuments(docs);
    console.log("Ingestion completed successfully!");
  } catch (error) {
    console.error("Error storing vectors in Qdrant:", error.message);
    console.log("\nMake sure Docker is running and you have started Qdrant:");
    console.log("docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant");
  }
}

run().catch(console.error);
