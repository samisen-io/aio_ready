const fetch = require('node-fetch');
const { HttpError } = require('../../lib/httpError');

const CODE_FENCE_REGEX = /```json|```/gi;

class AnthropicClient {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.baseUrl = options.baseUrl || 'https://api.anthropic.com';
    this.defaultModel = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
  }

  resolveApiKey() {
    return optionsApiKey(this.apiKey, process.env.ANTHROPIC_API_KEY);
  }

  async generateMarkup(pageData) {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      throw new HttpError(
        500,
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY in your environment.'
      );
    }

    const payload = {
      model: this.defaultModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: this.buildPrompt(pageData),
        },
      ],
    };

    const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `Anthropic API returned ${response.status}`,
        body.slice(0, 500)
      );
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new HttpError(502, 'Anthropic API returned invalid JSON.');
    }

    return this.extractMarkup(json);
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

  extractMarkup(responseBody) {
    let rawText = '';
    const content = responseBody?.content;

    if (Array.isArray(content) && content.length > 0) {
      const first = content[0];
      if (typeof first === 'string') {
        rawText = first;
      } else if (typeof first?.text === 'string') {
        rawText = first.text;
      }
    } else if (typeof content === 'string') {
      rawText = content;
    }

    if (!rawText) {
      throw new HttpError(502, 'Anthropic response did not contain text content.');
    }

    const cleaned = rawText.replace(CODE_FENCE_REGEX, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      throw new HttpError(500, 'Anthropic response was not valid JSON-LD.', error.message);
    }
  }
}

function arrayOrPlaceholder(values) {
  if (!values || values.length === 0) {
    return 'None detected';
  }

  return values.join(', ');
}

function optionsApiKey(explicit, envValue) {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  if (envValue && envValue.trim().length > 0) {
    return envValue.trim();
  }

  return '';
}

module.exports = { AnthropicClient };
