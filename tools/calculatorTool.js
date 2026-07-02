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

/** mathjs functions we allow to survive the "strip stray words" pass below. */
const ALLOWED_FUNCS =
  "sqrt|cbrt|abs|round|floor|ceil|log|log10|log2|ln|exp|sin|cos|tan|asin|acos|atan|pi|tau|e|mod|pow|min|max|gcd|lcm|factorial";

/**
 * Normalize a natural-language math query into a mathjs-evaluable expression
 * using ordered regex passes. mathjs stays the evaluator — this only rewrites
 * the human phrasing into arithmetic. Examples:
 *   "Calculate 18% GST on 42000." -> "(42000*(18/100))"      => 7560
 *   "What is 25% of 800?"         -> "(800*(25/100))"        => 200
 *   "42000 + 18%"                 -> "(42000+(42000*(18/100)))" => 49560
 *   "15% discount on 2000"        -> "(2000*(15/100))"       => 300
 *   "100*25" / "2*(5+8)"          -> unchanged
 */
function normalizeExpression(query) {
  let e = ` ${query.toLowerCase()} `;

  // 1. Drop currency symbols/words and thousands separators (42,000 -> 42000).
  e = e.replace(/[₹$€£]|\brs\.?\b|\binr\b|\busd\b/g, " ");
  e = e.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
  e = e.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1"); // 2nd pass for 1,234,567

  // 2. Strip filler / question words (but NOT "of"/"on" — needed in step 3).
  e = e.replace(
    /\b(please|kindly|calculate|compute|evaluate|work out|solve for|solve|find|tell me|what\s+is|what's|whats|how much is|the value of|value of|result of|equals?)\b/g,
    " "
  );

  // 3. "X% of Y"  and  "X% <word(s)> on Y"  ->  (Y*(X/100))
  //    covers "25% of 800", "18% gst on 42000", "15% discount on 2000".
  e = e.replace(
    /(\d+(?:\.\d+)?)\s*%\s*(?:of|(?:[a-z]+\s+)*on)\s+(\d+(?:\.\d+)?)/g,
    "($2*($1/100))"
  );

  // 4. "Y + X%" / "Y - X%"  ->  (Y ± (Y*(X/100)))   e.g. "42000 + 18%".
  e = e.replace(
    /(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)\s*%/g,
    "($1$2($1*($3/100)))"
  );

  // 5. Any remaining bare "X%"  ->  (X/100).
  e = e.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");

  // 6. Remove sentence dots (keep decimals like 3.14) and question marks.
  e = e.replace(/\.(?!\d)/g, " ").replace(/[?=]/g, " ");

  // 7. Drop leftover words/units (e.g. "gst") that aren't allowed mathjs funcs.
  e = e.replace(new RegExp(`\\b(?!(?:${ALLOWED_FUNCS})\\b)[a-z]+\\b`, "g"), " ");

  return e.replace(/\s+/g, " ").trim();
}

/**
 * Evaluate a mathematical expression found in the user's query.
 *
 * @param {string} query - natural-language query containing an expression
 * @returns {Promise<{tool: string, answer: string, expression: string}>}
 *          `expression` is the normalized form (shown in the UI/logs).
 */
export async function calculatorTool(query) {
  const expression = normalizeExpression(query);

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
      answer: `Sorry, I couldn't evaluate "${query}" as a mathematical expression.`,
      expression,
    };
  }
}
