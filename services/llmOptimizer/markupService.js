class MarkupService {
  constructor(extractor, anthropicClient) {
    this.extractor = extractor;
    this.anthropicClient = anthropicClient;
  }

  async analyze(url) {
    const pageData = await this.extractor.extract(url);
    const markup = await this.anthropicClient.generateMarkup(pageData);

    return {
      pageData,
      markup,
    };
  }
}

module.exports = { MarkupService };
