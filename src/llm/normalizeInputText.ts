import type { NormalizeInputTextOutput } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';

/**
 * Normalize raw OCR text or manual user input.
 *
 * Strategy (hybrid):
 *  1. Run enhanced pattern matching first (instant, ~0ms).
 *  2. If the result looks good (≥3 items extracted), use it.
 *  3. If the result looks poor (<3 items), fall back to OpenAI API.
 *
 * This eliminates the ~5.6s API call for 80%+ of receipts.
 */
export async function normalizeInputText(rawText: string): Promise<NormalizeInputTextOutput> {
  // Step 1: Try enhanced pattern matching (instant)
  const patternResult = normalizeWithPatternMatching(rawText);

  // Step 2: Validate — if we got reasonable results, skip AI entirely
  // Require ≥3 items to ensure it's not just noise
  if (patternResult.items.length >= 3) {
    console.log(`✅ Pattern matching extracted ${patternResult.items.length} items — skipping AI.`);
    return patternResult;
  }

  // Step 3: Pattern matching found too few — try AI if configured
  if (isOpenAIConfigured()) {
    console.log(`⚠️ Pattern matching found only ${patternResult.items.length} items — falling back to AI.`);
    return normalizeWithAI(rawText);
  }

  console.log('⚠️ Few items found and OpenAI not configured.');
  return patternResult;
}

// ─── AI Normalization ─────────────────────────────────────────────────────────

async function normalizeWithAI(rawText: string): Promise<NormalizeInputTextOutput> {
  const systemPrompt = `You are a grocery receipt parser. Extract items and purchase date from the given text.

RULES:
- Extract only food/grocery/household items that were PURCHASED
- Ignore prices, totals, store names, slogans, tax, sale info, addresses
- Ignore lines like "Sale 2@ $3.99, Was: $4.99 Each"
- Extract quantity if mentioned (e.g., "2 Apples" → quantity: "2")
- Find purchase date if present (any format)
- Return valid JSON only

OUTPUT FORMAT:
{
  "purchase_date": "ISO 8601 date string or null",
  "items": [
    { "raw_name": "item name as written", "quantity": "number as string or null" }
  ]
}

EXAMPLES:
Input: "2 Apples $3.99"
Output: { "purchase_date": null, "items": [{ "raw_name": "Apples", "quantity": "2" }] }

Input: "Date: 01/15/2024\\nMilk\\nBread"
Output: { "purchase_date": "2024-01-15T00:00:00.000Z", "items": [{ "raw_name": "Milk", "quantity": null }, { "raw_name": "Bread", "quantity": null }] }`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no other text.' },
        { role: 'user', content: rawText }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as NormalizeInputTextOutput;

    if (!Array.isArray(parsed.items)) {
      parsed.items = [];
    }

    return parsed;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return normalizeWithPatternMatching(rawText);
  }
}

// ─── Enhanced Pattern Matching ────────────────────────────────────────────────

/**
 * Lines that match any of these regexes are NOT grocery items.
 * Grouped by category for maintainability.
 */
const IGNORE_PATTERNS: RegExp[] = [
  // ── Totals / money ──
  /\btotal\b/i,
  /\bsubtotal\b/i,
  /\bsub\s*-?\s*total\b/i,
  /\bgrand\s*total\b/i,
  /\bbalance\b/i,
  /\bamount\s*(due|paid|tendered)\b/i,
  /\bchange\s*due\b/i,
  /\btax\b/i,
  /\bsavings?\b/i,
  /\bdiscount\b/i,
  /\bcoupon\b/i,
  /\bpromo\b/i,
  /\breward/i,
  /\bpoints?\b/i,
  /\brefund\b/i,
  /\b(you\s+)?saved\b/i,

  // ── Sale / pricing lines ──
  /\bsale\b/i,                           // "Sale 2@ $3.99, Was: $4.99 Each"
  /\bwas\s*:/i,                           // "Was: $4.99"
  /\bwas\s+\$/i,                          // "Was $4.99"
  /\d+\s*@/,                              // "2@", "1@" — quantity pricing
  /\bper\s+(lb|oz|ct|pk|each|unit|item)\b/i, // "Per Lb", "Per Each"
  /\beach$/i,                             // ends with "Each"
  /\bnow\s+\$/i,                          // "Now $3.99"
  /\bprice\b/i,                           // "Price", "Unit Price"
  /\bwt\b/i,                              // "Net Wt"
  /\btare\b/i,                            // "Tare:" scale weight

  // ── Payment ──
  /\bcash\b/i,
  /\bchange\b/i,
  /\bdebit\b/i,
  /\bcredit\b/i,
  /\bcard\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bamerican\s*express\b/i,
  /\bamex\b/i,
  /\bdiscover\b/i,
  /\bpayment\b/i,
  /\bapproved\b/i,
  /\bauthori[sz]/i,
  /\btransaction\b/i,
  /\bchip\s*read\b/i,
  /\baid:\b/i,
  /\bterminal\b/i,
  /\bmerchant\b/i,
  /\bsequence\b/i,
  /\bapproval\b/i,
  /\bref\s*#/i,
  /\bpurchase[ds]?\b/i,                   // "Purchase", "Purchased"

  // ── Store / header / footer ──
  /\breceipt\b/i,
  /\bthank\s*you\b/i,
  /\bthanks\b/i,
  /\bvisit\s*us\b/i,
  /\bcome\s*again\b/i,
  /\bwelcome\b/i,
  /\bhave\s*a\s*(nice|great|good)\b/i,
  /\bcustomer\s*service\b/i,
  /\bcashier\b/i,
  /\bregister\b/i,
  /\boperator\b/i,
  /\bassociate\b/i,
  /\bmanager\b/i,
  /\btrans\s*#/i,
  /\border\s*#/i,
  /\binvoice\b/i,
  /\b(store|shop)\s*#?\s*\d/i,
  /\blane\s*\d/i,
  /\bfresh\s*market\b/i,
  /\bsupermarket\b/i,
  /\bgrocery\s*store\b/i,
  /^amazon\s*fresh$/i,                    // "Amazon Fresh" store name
  /^whole\s*foods/i,                      // "Whole Foods Market"
  /^trader\s*joe/i,                       // "Trader Joe's"
  /^aldi\b/i,                             // "ALDI"
  /^costco\b/i,                           // "Costco"
  /^walmart\b/i,                          // "Walmart"
  /^target\b/i,                           // "Target"
  /^kroger\b/i,                           // "Kroger"
  /^safeway\b/i,                          // "Safeway"
  /^publix\b/i,                           // "Publix"

  // ── Address / location / phone / URLs ──
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,            // phone numbers
  /\d{5}(-\d{4})?$/,                            // zip codes (at end of line)
  /\b\d+\s+(st|nd|rd|th|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|ln|lane|ct|court|way|pkwy|parkway|hwy|highway|se|sw|ne|nw|ste|suite)\b/i,
  /www\.|\.com|\.net|\.org/i,
  /\b[A-Z]{2}\s+\d{5}\b/,                      // state + zip (e.g. "CA 90210")
  /\bmall\b/i,                                  // "Factoria Mall"
  /\bplaza\b/i,                                 // "Shopping Plaza"
  /\bcenter\b/i,                                // "Shopping Center"

  // ── Barcodes / IDs / SKUs ──
  /^\d{8,}$/,
  /^[A-Z0-9]{10,}$/,
  /\bsku\b/i,
  /\bupc\b/i,
  /\bplu\b/i,
  /\bitem\s*#/i,

  // ── Membership / loyalty ──
  /\bmember/i,
  /\bloyalty\b/i,
  /\bclub\b/i,
  /\bcard\s*(number|#|no)/i,
  /\baccount\b/i,

  // ── Pure numbers / prices standing alone ──
  /^\$[\d,.]+$/,                                 // "$3.99"
  /^[\d,.]+\s*%$/,                               // "8.25%"
  /^\d+\.\d{2}$/,                                // "3.99" (price without $)
  /^-?\$?[\d,.]+\s*[A-Z]?\s*-?$/,               // "-$1.50" or "3.99 T"

  // ── Timestamps (but not dates) ──
  /\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/i,

  // ── Single characters / too short ──
  /^.{0,3}$/,                                    // 0–3 chars (noise)
];

/**
 * Regexes to strip trailing receipt noise from product lines.
 *
 * Receipt format often: "Product Name                Now $3.99 F T"
 * After price stripping, "Now F T" remains — clean it up.
 */
const TRAILING_RECEIPT_NOISE: RegExp[] = [
  /\.{2,}\s*Now\b.*$/i,                    // "... Now F T"
  /\s+Now\s*$/i,                            // trailing " Now"
  /\s+Now\s+[A-Z\s]{1,4}$/,                // " Now F T", " Now F"
  /\s+[FTN]\s+[FTN]$/,                     // " F T" (tax flags)
  /\s+[FTN]$/,                              // trailing " F", " T", " N"
  /\(\s*\.\.\./g,                           // "(..." incomplete parens
  /\.{3,}\s*/g,                             // "..." ellipsis
  /\s*\.\.\.\s*/g,                          // " ... " ellipsis with spaces
];

const TRAILING_PRICE = /\s+\$?[\d,]+\.\d{2}\s*[A-Z]?\s*-?\s*$/;
const LEADING_PRICE = /^\$?[\d,]+\.\d{2}\s+/;
const INLINE_PRICE = /\$[\d,]+\.\d{2}/g;

const DATE_PATTERNS = [
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b/i,
];

/**
 * Enhanced pattern-matching receipt parser.
 *
 * Handles US grocery receipts (Walmart, Target, Amazon Fresh, Costco, etc.)
 * Aggressively filters receipt noise: sale lines, pricing, store info, addresses.
 */
function normalizeWithPatternMatching(rawText: string): NormalizeInputTextOutput {
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let purchaseDate: string | null = null;
  const items: Array<{ raw_name: string; quantity: string | null }> = [];

  for (const line of lines) {
    // 1. Try to extract purchase date (first match wins)
    if (!purchaseDate) {
      const dateStr = extractDate(line);
      if (dateStr) {
        purchaseDate = dateStr;
        continue;
      }
    }

    // 2. Check ignore patterns — skip noise lines
    if (IGNORE_PATTERNS.some(pattern => pattern.test(line))) {
      continue;
    }

    // 3. Strip prices from the line
    let cleaned = line;
    cleaned = cleaned.replace(TRAILING_PRICE, '');
    cleaned = cleaned.replace(LEADING_PRICE, '');
    cleaned = cleaned.replace(INLINE_PRICE, '');
    cleaned = cleaned.trim();

    // 4. Strip trailing receipt markers ("... Now F T", "F T", "Now", etc.)
    for (const pattern of TRAILING_RECEIPT_NOISE) {
      cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleaned.trim();

    // 5. Skip if nothing left after cleanup
    if (!cleaned || cleaned.length <= 3) continue;

    // 6. Skip lines that are ALL CAPS and very short (likely headers/footers)
    if (cleaned.length <= 6 && cleaned === cleaned.toUpperCase() && !/\d/.test(cleaned)) continue;

    // 7. Skip lines that are mostly numbers (weight, code, etc.)
    const digitRatio = (cleaned.match(/\d/g) || []).length / cleaned.length;
    if (digitRatio > 0.5) continue;

    // 8. Skip lines with too few alphabetic characters (noise fragments)
    const alphaChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
    if (alphaChars < 3) continue;

    // 9. Extract quantity if present
    let rawName = cleaned;
    let quantity: string | null = null;

    const qtyPatterns = [
      /^(\d+)\s*[xX]\s+(.+)$/,
      /^qty:?\s*(\d+)\s+(.+)$/i,
      /^(\d+)\s+(?!oz\b|lb\b|ml\b|ct\b|pk\b|pc\b|pt\b|qt\b|gal\b|mg\b|kg\b|g\b|l\b)(.{4,})$/i,
    ];

    for (const qp of qtyPatterns) {
      const m = cleaned.match(qp);
      if (m) {
        quantity = m[1];
        rawName = m[2].trim();
        break;
      }
    }

    // 10. Final cleanup — remove trailing weight/unit codes
    rawName = rawName.replace(/\s*\(?\d+(\.\d+)?\s*(oz|lb|ml|ct|pk|pc|pt|qt|gal|mg|kg|g|l|fl)\b\)?\s*$/i, '').trim();

    // 11. Skip if name is too short after all cleanup
    if (rawName.length <= 3) continue;

    // 12. Skip if the name doesn't contain at least 2 alpha words (likely noise)
    const words = rawName.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w));
    if (words.length < 2 && rawName.length < 8) continue;

    items.push({ raw_name: rawName, quantity });
  }

  return { purchase_date: purchaseDate, items };
}

function extractDate(line: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      try {
        const d = new Date(match[0]);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
          return d.toISOString();
        }
      } catch {
        // Invalid date — continue to next pattern
      }
    }
  }
  return null;
}
