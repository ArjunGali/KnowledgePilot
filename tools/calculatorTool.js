/**
 * tools/calculatorTool.js
 * -----------------------
 * The Calculator Tool — safely evaluates mathematical expressions with
 * mathjs. The previous implementation used `Function("return (...)")`,
 * which executes arbitrary JavaScript (remote code execution if exposed
 * over HTTP). mathjs parses math into its own AST and never touches the
 * JS runtime, and we additionally disable the mathjs functions that could
 * be used to escape the sandbox (the hardening pattern recommended by the
 * mathjs security docs).
 */

import { create, all } from "mathjs";

// Build an isolated mathjs instance so our hardening can't be undone by
// other consumers of the library.
const math = create(all);

// Capture the real evaluate BEFORE overriding it below. Expressions that
// try to call these functions from *inside* an expression (e.g.
// "evaluate(...)") will hit the disabled stubs instead.
const limitedEvaluate = math.evaluate.bind(math);

math.import(
  {
    import: () => { throw new Error("Function import is disabled"); },
    createUnit: () => { throw new Error("Function createUnit is disabled"); },
    evaluate: () => { throw new Error("Function evaluate is disabled"); },
    parse: () => { throw new Error("Function parse is disabled"); },
    simplify: () => { throw new Error("Function simplify is disabled"); },
    derivative: () => { throw new Error("Function derivative is disabled"); },
  },
  { override: true }
);

/**
 * Strip common natural-language wrappers so queries like
 * "what is 25 * (4 + 3)?" become the bare expression "25 * (4 + 3)".
 * mathjs handles the rest (functions like sqrt(), constants like pi, ...).
 */
function extractExpression(query) {
  return query
    .replace(/calculate|compute|evaluate|solve|what is|what's|the value of|result of|equals/gi, "")
    .replace(/[?=]/g, "")
    .trim();
}

/**
 * Evaluate a mathematical expression found in the user's query.
 *
 * @param {string} query - natural-language query containing an expression
 * @returns {Promise<{tool: string, answer: string, expression?: string}>}
 */
export async function calculatorTool(query) {
  const expression = extractExpression(query);

  try {
    const result = limitedEvaluate(expression);
    // format() avoids floating-point noise like 0.30000000000000004.
    const formatted = math.format(result, { precision: 14 });
    return {
      tool: "calculator",
      answer: `${expression} = ${formatted}`,
      expression,
    };
  } catch (error) {
    // Invalid/unparseable input is a normal user outcome, not a server
    // fault — return a friendly message instead of throwing.
    return {
      tool: "calculator",
      answer: `Sorry, I couldn't evaluate "${expression}" as a mathematical expression.`,
      expression,
    };
  }
}
