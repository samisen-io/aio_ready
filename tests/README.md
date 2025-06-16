# AIO Audit Tool - Testing Guide

This document describes the testing strategy and how to run tests for the AIO Audit Tool.

## Test Structure

```
tests/
├── setup.js              # Global test configuration and utilities
├── unit/                  # Unit tests
│   ├── server.test.js     # Server endpoint tests
│   ├── analysis.test.js   # Analysis function tests
│   └── frontend.test.js   # Frontend JavaScript tests
├── integration/           # Integration tests
│   └── api.test.js        # Full API workflow tests
└── README.md             # This file
```

## Test Categories

### Unit Tests
- **Server Tests**: Test individual API endpoints and middleware
- **Analysis Tests**: Test content analysis functions in isolation
- **Frontend Tests**: Test JavaScript functions and DOM manipulation

### Integration Tests
- **API Integration**: Test complete audit workflows
- **Error Handling**: Test various error scenarios
- **Performance**: Test response times and concurrent requests

## Running Tests

### Quick Start
```bash
# Install dependencies (including test dependencies)
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode (for development)
npm run test:watch
```

### Continuous Integration
```bash
# Run tests in CI mode (no watch, with coverage)
npm run test:ci
```

## Test Configuration

### Jest Configuration
Located in `package.json` under the `jest` key:

- **Test Environment**: Node.js
- **Coverage Threshold**: 75% for branches, functions, lines, and statements
- **Setup Files**: `tests/setup.js` for global configuration
- **Test Patterns**: `**/*.test.js` and `**/*.spec.js`

### ESLint Configuration
Located in `.eslintrc.js`:

- **Standard JS**: Base configuration
- **Jest Plugin**: Jest-specific linting rules
- **Relaxed Rules**: For test files to allow longer descriptions

## Writing Tests

### Test Utilities

The `testUtils` global object provides helpful functions:

```javascript
// Create mock HTML content
const html = testUtils.createMockHTML({
  hasStructuredData: true,
  hasSemanticElements: true,
  hasMetaDescription: true
});

// Create mock HTTP headers
const headers = testUtils.createMockHeaders({
  contentEncoding: 'gzip',
  cacheControl: 'max-age=3600'
});

// Create mock axios response
const response = testUtils.createMockAxiosResponse(html, 200, headers);

// Wait for async operations
await testUtils.wait(100);
```

### Unit Test Example

```javascript
describe('URL Validation', () => {
  test('should validate correct URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  test('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});
```

### Integration Test Example

```javascript
describe('Full Audit Workflow', () => {
  test('should complete full audit for HTTPS site', async () => {
    // Mock external API calls
    mockedAxios.get
      .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
      .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'));

    const response = await request(app)
      .post('/api/audit')
      .send({ url: 'https://example.com' })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      audit: expect.objectContaining({
        domain: 'example.com',
        overallScore: expect.any(Number)
      })
    });
  });
});
```

## Mocking Strategy

### External Dependencies
- **Axios**: Mocked to control HTTP responses
- **Console**: Mocked to reduce test noise
- **DOM**: Mocked using JSDOM for frontend tests

### Mock Data
- **HTML Content**: Generated with various configurations
- **HTTP Headers**: Configurable mock headers
- **API Responses**: Structured mock responses

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **Text Summary**: Displayed in terminal

### Coverage Targets
- **Branches**: 75%
- **Functions**: 75%
- **Lines**: 75%
- **Statements**: 75%

## Test Data

### Mock HTML Templates
The test utilities create realistic HTML documents with configurable features:

```javascript
const html = testUtils.createMockHTML({
  title: 'Custom Title',
  hasH1: true,
  hasMetaDescription: true,
  hasStructuredData: false,
  hasImages: true,
  hasSemanticElements: true,
  isHttps: true
});
```

### Error Scenarios
Tests cover various error conditions:

- **403 Forbidden**: Bot blocking scenarios
- **404 Not Found**: Missing resources
- **Timeout**: Slow server responses
- **Network Errors**: Connection failures
- **Malformed HTML**: Invalid markup

## Performance Testing

Integration tests include performance checks:

- **Response Time**: Audits complete within 5 seconds
- **Concurrent Requests**: Handle multiple simultaneous audits
- **Rate Limiting**: Enforce request limits properly
- **Memory Usage**: No memory leaks during testing

## Debugging Tests

### Verbose Output
```bash
# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/server.test.js

# Run tests matching pattern
npm test -- --testNamePattern="audit"
```

### Debug Mode
```bash
# Run with Node.js debugger
node --inspect node_modules/.bin/jest --runInBand
```

### Console Debugging
```javascript
// Temporarily enable console output in tests
beforeEach(() => {
  global.console = console;
});
```

## Best Practices

### Test Organization
- **Descriptive Names**: Use clear, descriptive test names
- **Group Related Tests**: Use `describe` blocks for organization
- **Setup/Teardown**: Use `beforeEach`/`afterEach` for test isolation

### Assertions
- **Specific Expectations**: Use precise matchers
- **Error Cases**: Test both success and failure scenarios
- **Edge Cases**: Test boundary conditions and unusual inputs

### Mocking
- **Minimal Mocking**: Only mock what's necessary
- **Reset Mocks**: Clear mocks between tests
- **Realistic Data**: Use realistic mock data

### Performance
- **Fast Tests**: Keep tests fast and focused
- **Parallel Execution**: Tests should be independent
- **Timeout Handling**: Set appropriate timeouts for async tests

## Common Issues

### Mock Cleanup
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
```

### Async Test Handling
```javascript
// Use async/await for async tests
test('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### DOM Testing
```javascript
// Set up DOM environment for frontend tests
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = window.document;
```

## Contributing

When adding new features:

1. **Write Tests First**: Use TDD approach when possible
2. **Maintain Coverage**: Ensure tests maintain coverage thresholds
3. **Update Documentation**: Update this README for new test patterns
4. **Run Full Suite**: Ensure all existing tests still pass

## Continuous Integration

The test suite is designed to run in CI environments:

- **No Interactive Prompts**: All tests run non-interactively
- **Deterministic Results**: Tests produce consistent results
- **Fast Execution**: Optimized for CI/CD pipelines
- **Clear Reporting**: Detailed output for debugging failures