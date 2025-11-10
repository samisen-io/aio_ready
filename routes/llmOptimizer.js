const express = require('express');
const { HttpError } = require('../lib/httpError');

function createLlmOptimizerRouter(markupService) {
  const router = express.Router();

  router.post('/analyze', async (req, res, next) => {
    const { url } = req.body ?? {};

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ error: 'URL is required.' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({ error: 'URL must be an absolute HTTP or HTTPS address.' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'URL must use HTTP or HTTPS.' });
    }

    try {
      const result = await markupService.analyze(parsedUrl.href);
      return res.json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        const payload = { error: error.message };
        if (error.details) {
          payload.detail = error.details;
        }
        const statusCode = typeof error.status === 'number' ? error.status : 500;
        return res.status(statusCode).json(payload);
      }

      if (error?.name === 'AbortError') {
        return res
          .status(504)
          .json({ error: 'Request timed out.', detail: 'Fetching the target page took too long.' });
      }

      return next(error);
    }
  });

  return router;
}

module.exports = { createLlmOptimizerRouter };
