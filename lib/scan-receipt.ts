import Anthropic from '@anthropic-ai/sdk';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/constants';

export interface ParsedReceipt {
  amount: number;
  vendor: string;
  date: string | null;
  category: ExpenseCategory;
  description: string;
}

const SYSTEM_PROMPT = `You parse receipt photos for a landlord doing rental-property accounting. The
landlord uses IRS Schedule E categories. Map each receipt to the most accurate
category from this list:

- Advertising — listing photography, online rental ads
- Auto and Travel — gas/mileage related to managing the property
- Cleaning and Maintenance — lawn care, gutter cleaning, snow removal, janitorial
- Commissions — agent or referral fees
- Insurance — landlord insurance, umbrella policies
- Legal and Professional Fees — accountant, attorney, tax prep
- Management Fees — property manager fees
- Mortgage Interest — interest portion of mortgage payment
- Other Interest — other loan interest
- Repairs — fixing existing items (plumber, electrician, appliance repair)
- Supplies — hardware, paint, light bulbs, filters, small items
- Taxes — property tax, business license
- Utilities — water, gas, electric, internet, trash
- Depreciation — (rarely on receipts; usually computed)
- Other — anything that doesn't fit clearly

If a receipt is for both supplies AND a repair (e.g. parts at Home Depot), pick
the dominant intent: lumber/tools → Supplies; a hired technician's bill → Repairs.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  _client = new Anthropic();
  return _client;
}

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function normalizeMediaType(input: string): SupportedMediaType {
  const lower = input.toLowerCase();
  if (lower === 'image/jpeg' || lower === 'image/jpg') return 'image/jpeg';
  if (lower === 'image/png') return 'image/png';
  if (lower === 'image/gif') return 'image/gif';
  if (lower === 'image/webp') return 'image/webp';
  // Default to JPEG — Anthropic accepts it for most JPEG-like inputs.
  return 'image/jpeg';
}

export async function scanReceipt(
  imageBase64: string,
  mediaType: string,
): Promise<ParsedReceipt> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'record_receipt',
        description: 'Record the structured details extracted from the receipt photo.',
        input_schema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description:
                'Total amount paid in dollars (numeric, not a string). Example: 47.83',
            },
            vendor: {
              type: 'string',
              description: 'Business / merchant name as shown on the receipt.',
            },
            date: {
              type: ['string', 'null'],
              description:
                'Date on the receipt in YYYY-MM-DD format, or null if not visible.',
            },
            category: {
              type: 'string',
              enum: [...EXPENSE_CATEGORIES],
              description:
                'Most appropriate IRS Schedule E rental-property expense category.',
            },
            description: {
              type: 'string',
              description:
                'Brief one-sentence summary of what was purchased or serviced.',
            },
          },
          required: ['amount', 'vendor', 'category', 'description'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_receipt' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: normalizeMediaType(mediaType),
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract the receipt details using the record_receipt tool.',
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error('Receipt could not be parsed (no tool_use block in response)');
  }

  const raw = toolUse.input as Partial<ParsedReceipt>;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Receipt parsing returned an invalid amount');
  }
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(
    raw.category ?? '',
  )
    ? (raw.category as ExpenseCategory)
    : 'Other';

  return {
    amount,
    vendor: (raw.vendor ?? '').trim() || 'Unknown',
    date: raw.date ?? null,
    category,
    description: (raw.description ?? '').trim(),
  };
}
