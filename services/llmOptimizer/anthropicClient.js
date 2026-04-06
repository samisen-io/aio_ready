const Anthropic = require('@anthropic-ai/sdk');
const { HttpError } = require('../../lib/httpError');

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

class AnthropicClient {
  constructor(options = {}) {
    this.model = options.model || ANTHROPIC_MODEL;
    this._client = options.client || null;
  }

  _getClient() {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey.trim()) {
        throw new HttpError(
          500,
          'Anthropic API key is not configured. Set ANTHROPIC_API_KEY in your environment.'
        );
      }
      this._client = new Anthropic({ apiKey });
    }
    return this._client;
  }

  async generateMarkup(pageData) {
    const client = this._getClient();

    let message;
    try {
      message = await client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: this.buildPrompt(pageData) }],
      });
    } catch (err) {
      const status = err.status || 500;
      throw new HttpError(status, `Anthropic API error: ${err.message}`);
    }

    return this.extractMarkup(message);
  }

  buildPrompt(pageData) {
    const prices = arrayOrPlaceholder(pageData.prices);
    const images = arrayOrPlaceholder(pageData.images);
    const phone = pageData.contact?.phone || 'None detected';
    const email = pageData.contact?.email || 'None detected';

    return [
      'You are an expert at creating Schema.org structured data markup.',
      'Analyze this webpage and generate appropriate Schema.org JSON-LD markup.',
      '',
      'PAGE DATA:',
      `URL: ${pageData.url}`,
      `Title: ${pageData.title}`,
      `Description: ${pageData.description}`,
      `Business Name: ${pageData.businessName}`,
      `Prices Found: ${prices}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Images: ${images}`,
      '',
      'Content Preview:',
      pageData.content,
      '',
      'INSTRUCTIONS:',
      '1. Determine the most appropriate Schema.org type (Restaurant, LocalBusiness, Product, Service, etc.)',
      '2. Generate valid JSON-LD markup',
      '3. Include as many relevant fields as possible based on the data provided',
      "4. If it's a restaurant, include menu items if visible",
      "5. If it's a store, include products if visible",
      '6. Always include: name, description, address (if found), contact info',
      '',
      'OUTPUT ONLY VALID JSON-LD MARKUP. NO EXPLANATIONS. NO MARKDOWN CODE BLOCKS.',
    ].join('\n');
  }

  extractMarkup(message) {
    const block = message?.content?.[0];
    const rawText = typeof block?.text === 'string' ? block.text.trim() : '';

    if (!rawText) {
      throw new HttpError(502, 'Anthropic response did not contain text content.');
    }

    const cleaned = rawText.replace(/```json|```/gi, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 2);
    } catch (err) {
      throw new HttpError(500, 'Anthropic response was not valid JSON-LD.', err.message);
    }
  }
}

function arrayOrPlaceholder(values) {
  if (!values || values.length === 0) return 'None detected';
  return values.join(', ');
}

module.exports = { AnthropicClient };
