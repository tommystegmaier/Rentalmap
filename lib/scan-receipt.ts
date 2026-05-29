import Anthropic from '@anthropic-ai/sdk';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/constants';

export interface ParsedReceipt {
  amount: number;
  vendor: string;
  date: string | null;
  category: ExpenseCategory;
  description: string;
  isMortgageStatement: boolean;
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
the dominant intent: lumber/tools → Supplies; a hired technician's bill → Repairs.

IMPORTANT: If the document is a mortgage statement or mortgage payment coupon
(it shows a payment broken into principal + interest, and often escrow for
taxes/insurance), set is_mortgage_statement to true. In that case the "amount"
you report is the TOTAL payment — it should be split separately — so do not try
to force it all into one category.`;

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

// Build the right content block for the upload: a PDF document block for PDFs,
// otherwise an image block. Lets the scanners read PDF statements/receipts too.
function fileSourceBlock(
  data: string,
  mediaType: string,
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (mediaType.toLowerCase() === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: normalizeMediaType(mediaType), data },
  };
}

export interface ParsedMortgageStatement {
  lender: string;
  date: string | null;
  principal: number;
  interest: number;
  escrowTaxes: number;
  escrowInsurance: number;
  total: number;
}

const MORTGAGE_SYSTEM_PROMPT = `You read a monthly mortgage statement for a landlord doing rental-property
accounting. Extract the breakdown of the payment so the deductible and
non-deductible portions can be recorded separately for IRS Schedule E:

- principal — the principal portion of the payment (NOT tax-deductible)
- interest — the mortgage interest portion (tax-deductible, Schedule E line 12)
- escrowTaxes — property taxes paid from escrow this period (deductible, line 16)
- escrowInsurance — hazard/homeowner insurance paid from escrow (deductible, line 9)
- total — the total payment amount

Use the current period / this statement's amounts (not year-to-date totals).
Report every amount in dollars as a number (e.g. 1234.56). Use 0 for anything
not shown. If escrow isn't itemized into taxes vs insurance, put the escrow
amount under escrowTaxes and 0 for insurance.`;

export async function scanMortgageStatement(
  imageBase64: string,
  mediaType: string,
): Promise<ParsedMortgageStatement> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: MORTGAGE_SYSTEM_PROMPT,
    tools: [
      {
        name: 'record_mortgage_statement',
        description: 'Record the payment breakdown from the mortgage statement.',
        input_schema: {
          type: 'object',
          properties: {
            lender: { type: 'string', description: 'Mortgage lender / servicer name.' },
            date: {
              type: ['string', 'null'],
              description: 'Statement or payment date in YYYY-MM-DD, or null.',
            },
            principal: { type: 'number', description: 'Principal portion in dollars.' },
            interest: { type: 'number', description: 'Interest portion in dollars.' },
            escrowTaxes: {
              type: 'number',
              description: 'Property taxes paid from escrow this period, in dollars.',
            },
            escrowInsurance: {
              type: 'number',
              description: 'Insurance paid from escrow this period, in dollars.',
            },
            total: { type: 'number', description: 'Total payment in dollars.' },
          },
          required: ['lender', 'principal', 'interest', 'escrowTaxes', 'escrowInsurance', 'total'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_mortgage_statement' },
    messages: [
      {
        role: 'user',
        content: [
          fileSourceBlock(imageBase64, mediaType),
          {
            type: 'text',
            text: 'Extract the mortgage payment breakdown using the record_mortgage_statement tool.',
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) {
    throw new Error('Mortgage statement could not be parsed');
  }
  const raw = toolUse.input as Partial<ParsedMortgageStatement>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return {
    lender: (raw.lender ?? '').trim() || 'Mortgage',
    date: raw.date ?? null,
    principal: num(raw.principal),
    interest: num(raw.interest),
    escrowTaxes: num(raw.escrowTaxes),
    escrowInsurance: num(raw.escrowInsurance),
    total: num(raw.total),
  };
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
            is_mortgage_statement: {
              type: 'boolean',
              description:
                'True if this document is a mortgage statement / payment coupon (principal + interest, often escrow). False for ordinary receipts.',
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
          fileSourceBlock(imageBase64, mediaType),
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
    isMortgageStatement:
      (raw as { is_mortgage_statement?: boolean }).is_mortgage_statement === true,
  };
}
