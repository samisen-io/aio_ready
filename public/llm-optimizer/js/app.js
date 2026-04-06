(() => {
  const _scriptEl = document.currentScript || document.querySelector('script[data-base-path]');
  const basePath = (_scriptEl && _scriptEl.dataset.basePath) || '';
  const apiBase = `${basePath}/api`;
  const form = document.getElementById('analyzeForm');
  const urlInput = document.getElementById('url');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusCard = document.getElementById('statusCard');
  const loadingCard = document.getElementById('loading');
  const resultsSection = document.getElementById('results');
  const markupPre = document.getElementById('markup');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const summaryTitle = document.getElementById('summaryTitle');
  const summaryDescription = document.getElementById('summaryDescription');
  const summaryBusiness = document.getElementById('summaryBusiness');
  const summaryPhone = document.getElementById('summaryPhone');
  const summaryEmail = document.getElementById('summaryEmail');
  const summaryPrices = document.getElementById('summaryPrices');
  const summaryImages = document.getElementById('summaryImages');

  const defaultStatus = statusCard ? statusCard.innerHTML : '';
  let generatedMarkup = '';

  // Pre-fill URL from query string (e.g. when linked from audit results)
  const prefilledUrl = new URLSearchParams(window.location.search).get('url');
  if (prefilledUrl && urlInput) {
    urlInput.value = prefilledUrl;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const url = urlInput?.value.trim();
    if (!url) {
      showError('Please enter a valid URL.');
      return;
    }

    showLoading();

    try {
      const response = await fetch(`${apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorBody = await parseJsonSafe(response);
        const message =
          errorBody?.error ??
          errorBody?.detail ??
          `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      const payload = await response.json();
      generatedMarkup = payload.markup ?? '';

      if (!generatedMarkup) {
        throw new Error('The AI did not return any markup.');
      }

      markupPre.textContent = generatedMarkup;
      hydrateSummary(payload.pageData);
      showResults();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while analyzing the page.';
      showError(message);
    }
  });

  copyBtn?.addEventListener('click', async () => {
    if (!generatedMarkup) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedMarkup);
      copyBtn.classList.add('success');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('success');
        copyBtn.textContent = 'Copy JSON-LD';
      }, 1600);
    } catch {
      showError('Unable to copy to clipboard. Please copy manually.');
    }
  });

  downloadBtn?.addEventListener('click', () => {
    if (!generatedMarkup) {
      return;
    }

    const blob = new Blob([generatedMarkup], { type: 'application/ld+json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'schema-markup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });

  function showLoading() {
    statusCard?.classList.add('hidden');
    resultsSection?.classList.add('hidden');
    loadingCard?.classList.remove('hidden');
    mutateAnalyzeBtn(true);
  }

  function showResults() {
    loadingCard?.classList.add('hidden');
    statusCard?.classList.add('hidden');
    resultsSection?.classList.remove('hidden');
    mutateAnalyzeBtn(false);
  }

  function showError(message) {
    loadingCard?.classList.add('hidden');
    mutateAnalyzeBtn(false);

    if (statusCard) {
      statusCard.classList.remove('hidden');
      statusCard.classList.add('error');
      statusCard.innerHTML = `<p style="color: var(--danger);">${escapeHtml(message)}</p>`;
    }
  }

  function hydrateSummary(data) {
    if (!data) {
      return;
    }

    statusCard?.classList.remove('error');
    if (statusCard) {
      statusCard.innerHTML = defaultStatus || '<p>Analysis complete.</p>';
    }

    summaryTitle.textContent = fallback(data.title);
    summaryDescription.textContent = fallback(data.description);
    summaryBusiness.textContent = fallback(data.businessName);
    summaryPhone.textContent = fallback(data.contact?.phone);
    summaryEmail.textContent = fallback(data.contact?.email);

    renderList(summaryPrices, data.prices, 'No price points detected.');
    renderList(summaryImages, data.images, 'No relevant images found.');
  }

  function renderList(container, items, emptyText) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    if (!items || !Array.isArray(items) || items.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.textContent = emptyText;
      container.appendChild(placeholder);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      container.appendChild(li);
    });
  }

  function mutateAnalyzeBtn(disabled) {
    if (!analyzeBtn) {
      return;
    }

    analyzeBtn.disabled = disabled;
    analyzeBtn.textContent = disabled ? 'Analyzing...' : 'Analyze';
  }

  async function parseJsonSafe(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function fallback(value) {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      return 'N/A';
    }
    return value;
  }

  function escapeHtml(value) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(value).replace(/[&<>"']/g, (m) => map[m]);
  }
})();
