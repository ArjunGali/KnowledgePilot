/**
 * ask.js
 * ------
 * CLI question-answering utility: `node ask.js "Your question here"`.
 *
 * Now a thin wrapper around the Document Tool, so the CLI exercises the
 * exact same RAG pipeline as the server (same local embeddings, same
 * prompt, same retrieval). Note: the previous version imported
 * "langchain/chains/*" entrypoints that were removed in LangChain v1 and
 * used mismatched cloud embeddings — both fixed by reusing the tool.
 */

import { documentTool } from "./tools/documentTool.js";

async function run() {
  const query = process.argv[2];
  if (!query) {
    console.error('Please provide a question. Usage: node ask.js "Your question here"');
    process.exit(1);
  }

  console.log(`Question: "${query}"\n`);
  console.log("Thinking...");

  // Run the same RAG pipeline the server's document tool uses.
  const result = await documentTool(query);

  console.log("\n=============================================");
  console.log("Answer:");
  console.log(result.answer);
  console.log("=============================================\n");
  console.log("Source Documents used:");
  result.context.forEach((chunk, i) => {
    console.log(`[${i + 1}] ${chunk.substring(0, 100)}...`);
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
