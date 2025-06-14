# Backend Generator API

A powerful API that uses OpenRouter's free LLMs (Gemini 2.0 Flash & Devstral Small) to generate complete backend projects based on user prompts.

## Features

- 🤖 **AI-Powered Generation**: Uses Gemini 2.0 Flash and Devstral Small models
- 📁 **Complete Project Structure**: Generates full file trees with actual code
- 💾 **File Management**: Create, read, update, and enhance generated files
- 📦 **Project Download**: Download generated projects as ZIP files
- 🔧 **Code Enhancement**: Improve existing code with AI assistance
- 💬 **Chat Interface**: Ask development questions to the AI
- 🐳 **Docker Support**: Ready for containerized deployment

## Quick Start

### Prerequisites
- Node.js 16+
- OpenRouter API key (free tier available)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend-generator-api
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

4. Start the server:
```bash
npm run dev
```

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `GET /api/models` - Available AI models
- `POST /api/generate` - Generate backend project
- `GET /api/download/:projectId` - Download project as ZIP
- `GET /api/projects` - List all generated projects

### Project Management

- `GET /api/project/:projectId` - Get project details
- `GET /api/project/:projectId/file/*` - Get file content
- `PUT /api/project/:projectId/enhance/*` - Enhance file with AI
- `DELETE /api/project/:projectId` - Delete project

### AI Chat

- `POST /api/chat` - Chat with AI for development questions

## Usage Examples

### Generate a Backend Project

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a REST API for a blog platform with user authentication, posts, comments, and categories using Node.js and MongoDB",
    "model": "gemini-2.0-flash"
  }'
```

### Chat with AI

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I implement JWT authentication in Express.js?",
    "model": "devstral-small"
  }'
```

## Available AI Models

- **gemini-2.0-flash**: Google's Gemini 2.0 Flash (fast, high-quality)
- **devstral-small**: Mistral's Devstral Small (specialized for coding)

## Docker Deployment

### Build and run with Docker:

```bash
docker build -t backend-generator-api .
docker run -p 3000:3000 -e OPENROUTER_API_KEY=your_key backend-generator-api
```

### Using Docker Compose:

```bash
docker-compose up -d
```

## Project Structure

```
backend-generator-api/
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Multi-container setup
├── nginx.conf           # Nginx reverse proxy config
├── .env.example         # Environment variables template
├── generated_projects/  # Generated projects directory
└── uploads/            # Temporary uploads directory
```

## Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (required)
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

## API Response Format

### Successful Generation Response:
```json
{
  "success": true,
  "projectId": "uuid-here",
  "projectName": "project-name",
  "description": "Project description",
  "technology": "Node.js/Express",
  "fileTree": ["file1.js", "file2.js", "..."],
  "dependencies": {...},
  "setupInstructions": [...],
  "apiEndpoints": [...],
  "downloadUrl": "/api/download/uuid-here"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check OpenRouter documentation for API-related questions