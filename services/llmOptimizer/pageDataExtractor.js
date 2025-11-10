const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { TextDecoder } = require('util');
const { HttpError } = require('../../lib/httpError');

const PRICE_REGEX = /\$\s?\d[\d,.]*(?:\s?(?:USD|usd))?/g;
const PHONE_REGEX = /\+?\d{0,2}[\s\-\.]?(?:\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4})/g;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

class PageDataExtractor {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.userAgent = options.userAgent || 'LLM-Optimizer/1.0 (+https://example.com)';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxImages = options.maxImages ?? 5;
  }

  async extract(url) {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const title = this.extractTitle($);
    const description = this.extractMetaDescription($);
    const businessName = this.extractBusinessName($, title);
    const mainFragment = this.extractPrimaryFragment($);

    const bodyText = this.htmlToPlainText($.root().html() || '');
    const mainText = this.htmlToPlainText(mainFragment);
    const prices = this.extractUniqueMatches(PRICE_REGEX, bodyText);
    const contact = this.extractContactInfo(bodyText);
    const images = this.extractImages($, url);

    return {
      url,
      title,
      description,
      businessName,
      content: this.trimWithEllipsis(mainText, 3000),
      prices,
      contact,
      images,
    };
  }

  async fetchHtml(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          'user-agent': this.userAgent,
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) {
        const snippet = await response.text();
        throw new HttpError(
          response.status,
          `Failed to fetch page (status ${response.status}).`,
          snippet.slice(0, 280)
        );
      }

      const buffer = await response.buffer();
      const encoding = this.detectEncoding(response.headers.get('content-type'));
      return this.decodeBuffer(buffer, encoding);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpError(504, 'Fetching the target page took too long.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  detectEncoding(contentTypeHeader) {
    if (!contentTypeHeader) {
      return 'utf-8';
    }

    const match = /charset=([^;]+)/i.exec(contentTypeHeader);
    if (match?.[1]) {
      return match[1].trim();
    }

    return 'utf-8';
  }

  decodeBuffer(buffer, encoding) {
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(buffer);
    } catch {
      const fallback = new TextDecoder('utf-8');
      return fallback.decode(buffer);
    }
  }

  extractTitle($) {
    return $('title').first().text().trim();
  }

  extractMetaDescription($) {
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';
    return description.trim();
  }

  extractBusinessName($, title) {
    const heading = $('h1').first().text().trim();
    if (heading) {
      return heading;
    }

    if (!title) {
      return '';
    }

    const separators = ['|', '-', ':'];
    for (const separator of separators) {
      if (title.includes(separator)) {
        return title.split(separator)[0].trim();
      }
    }

    return title.trim();
  }

  extractPrimaryFragment($) {
    const main = $('main').first();
    if (main.length) {
      return main.html() || '';
    }
    const body = $('body').first();
    return body.html() || '';
  }

  htmlToPlainText(fragment) {
    if (!fragment) {
      return '';
    }

    const $ = cheerio.load(fragment);
    $('script, style, noscript').remove();
    const text = $.root().text();
    return text.replace(/\s+/g, ' ').trim();
  }

  extractUniqueMatches(regex, content) {
    if (!content) {
      return [];
    }

    const matches = new Set();
    let match;
    const pattern = new RegExp(regex.source, regex.flags);
    while ((match = pattern.exec(content)) !== null) {
      matches.add(match[0].trim());
    }

    return Array.from(matches).slice(0, 10);
  }

  extractContactInfo(bodyText) {
    const phoneMatch = bodyText.match(PHONE_REGEX);
    const emailMatch = bodyText.match(EMAIL_REGEX);

    return {
      phone: phoneMatch ? phoneMatch[0].trim() : '',
      email: emailMatch ? emailMatch[0].trim() : '',
    };
  }

  extractImages($, baseUrl) {
    const images = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (!src) {
        return;
      }

      const resolved = this.resolveUrl(src, baseUrl);
      if (resolved && !images.includes(resolved)) {
        images.push(resolved);
      }

      if (images.length >= this.maxImages) {
        return false;
      }
    });

    return images;
  }

  resolveUrl(raw, baseUrl) {
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return null;
    }
  }

  trimWithEllipsis(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength).trimEnd()}...`;
  }
}

module.exports = { PageDataExtractor };
