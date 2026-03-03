import { openai, isOpenAIConfigured } from './openaiClient';
import type { NormalizeInputTextOutput } from '../types';

/**
 * Parse a receipt image directly with GPT-4o Vision.
 *
 * Replaces the OCR → normalizeInputText → classifyItems pipeline with a single
 * multimodal API call. GPT-4o understands receipt layout natively and filters
 * out noise (totals, taxes, store info, barcodes) without regex patterns.
 *
 * Returns null on failure so the caller can fall back to the OCR pipeline.
 */
export async function parseReceiptWithVision(file: File): Promise<NormalizeInputTextOutput | null> {
  if (!isOpenAIConfigured()) return null;

  try {
    // Resize + compress before upload: phone cameras produce 4-8MB images which
    // inflate the base64 payload and add 3-5s of network latency. 1500px/0.8
    // quality brings this down to ~150KB with no meaningful accuracy loss.
    const tPreprocess = performance.now();
    const compressed = await compressImage(file, 1500, 0.8);
    const base64 = await fileToBase64(compressed);
    console.log(`⏱️ [Vision] Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${(performance.now() - tPreprocess).toFixed(0)}ms)`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 640,  // ~20 items × ~25 tokens each (name + quantity + item_code) + store_name overhead
      temperature: 0,   // deterministic output — same receipt → same items every time
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Receipt parser. Extract food/grocery items only.

Also capture:
- store_name: the retailer name if visible on the receipt (e.g. "Costco", "Trader Joe's", "Whole Foods"), else null
- item_code: per-item product code if printed next to the item (e.g. Costco item numbers like "47019"), else null

Return JSON:
{"store_name":"string or null","purchase_date":"YYYY-MM-DD or null","items":[{"raw_name":"clean product name","quantity":"number as string or null","item_code":"string or null"}]}

Include: produce, meat, seafood, dairy, eggs, grains, bread, snacks, beverages, condiments, frozen food, canned food.
Exclude: totals, taxes, non-food (medicine, cleaning supplies, pet supplies, batteries, gift cards).
- One entry per unique product — no duplicates even if the item appears multiple times on the receipt
- Clean names: remove unit suffixes (Each, lb, oz, fl oz, per lb), write the full readable product name`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Parse this receipt.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'auto',
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn('[Vision] Empty response from GPT-4o');
      return null;
    }

    const parsed = JSON.parse(content) as NormalizeInputTextOutput;

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.warn('[Vision] No items found in vision response');
      return null;
    }

    // Sanitize: remove empty names, then deduplicate by normalized name
    const seen = new Set<string>();
    parsed.items = parsed.items.filter((item) => {
      if (!item || typeof item.raw_name !== 'string' || !item.raw_name.trim()) return false;
      const key = item.raw_name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (parsed.items.length === 0) {
      console.warn('[Vision] All items filtered out during sanitization');
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[Vision] parseReceiptWithVision failed:', error);
    return null;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize and compress an image using the Canvas API.
 * Phone camera images are typically 4-8MB; this brings them down to ~100-200KB.
 */
function compressImage(file: File, maxPx: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
