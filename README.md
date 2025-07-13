# AIO Ready - Website AI Optimization Audit Tool

A comprehensive web application that audits websites for AI optimization readiness. This tool performs real-time analysis of website content, structure, and technical implementation to determine how well a site is optimized for AI agents and automated systems.

## Features

- **Real-time Analysis**: All scores are computed from actual website analysis, no mock data
- **Comprehensive Auditing**: Analyzes 8 key areas of AI optimization
- **Detailed Recommendations**: Provides actionable insights for improvement
- **Export Functionality**: Download audit results as JSON reports
- **Modern UI**: Clean, responsive interface with real-time feedback

## Audit Categories

1. **Content Structure & Markup** - Semantic HTML, heading hierarchy, meta descriptions
2. **AI Agent Accessibility** - Robots.txt, sitemaps, content without JavaScript
3. **Data Quality & Format** - Content formatting, image optimization, contact info
4. **Performance & Speed** - HTTPS, mobile responsiveness, compression, caching
5. **Structured Data & Schema** - JSON-LD, microdata, Open Graph, Twitter Cards
6. **Social Media & Sharing** - Social links, sharing buttons, RSS feeds
7. **Accessibility & Usability** - ARIA attributes, form accessibility, semantic markup
8. **Security & Privacy** - HTTPS, security headers, external resource security

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aio_ready
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional):
```bash
PORT=3000
NODE_ENV=development
```

## Running the Application

1. Start the backend server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter a website URL and click "Run Audit" to perform real-time analysis

## Important Notes

- **Backend Required**: This application requires a running backend server to perform analysis
- **Real Analysis Only**: All scores are computed from actual website analysis - no mock or simulated data
- **Internet Access**: The backend needs internet access to fetch and analyze target websites
- **Rate Limiting**: Built-in rate limiting to prevent abuse (10 requests per 15 minutes per IP)

## API Endpoints

- `GET /` - Main application interface
- `POST /api/audit` - Perform website audit
- `GET /api/health` - Health check endpoint
- `GET /api/docs` - API documentation

## Dependencies

### Core Dependencies
- `express` - Web framework
- `ejs` - Template engine
- `axios` - HTTP client for fetching websites
- `cheerio` - HTML parsing and analysis
- `robots-parser` - Robots.txt parsing
- `validator` - URL validation
- `url-parse` - URL parsing utilities

### Security & Performance
- `helmet` - Security headers
- `cors` - Cross-origin resource sharing
- `compression` - Response compression
- `morgan` - HTTP request logging

## Development

To run in development mode with additional logging:
```bash
NODE_ENV=development npm start
```

## Troubleshooting

### Backend Connection Issues
- Ensure the server is running on the correct port
- Check that all dependencies are installed
- Verify internet connectivity for website fetching

### Analysis Failures
- Some websites may block automated requests
- Check the error messages for specific issues
- Try with different websites to test functionality

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests. 