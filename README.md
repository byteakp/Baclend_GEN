# AI Backend Generator

A powerful AI-driven backend project generator that creates complete, production-ready backend applications using Groq's advanced language models.

## Features

🤖 **AI-Powered Generation**: Uses Groq's latest models (Llama 4 Scout, Llama 3.3 70B, Mixtral 8x7B)  
📁 **Complete Project Structure**: Generates full backend projects with proper file organization  
💾 **Live Code Editing**: Edit generated files directly through the API  
🔄 **AI Enhancement**: Let AI improve or rewrite specific files  
💬 **Interactive Chat**: Get development help with project context  
📦 **Easy Download**: Download projects as ZIP files  
🐳 **Docker Ready**: Containerized deployment support  

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-backend-generator

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configuration

Edit `.env` file:
```bash
GROQ_API_KEY=your_groq_api_key_here
PORT=3000
NODE_ENV=development
```

Get your Groq API key from: https://console.groq.com/

### 3. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Using Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or run with Docker directly
docker build -t backend-generator .
docker run -p 3000:3000 -e GROQ_API_KEY=your_key backend-generator
```

## API Endpoints

### Project Generation
- `POST /api/generate` - Generate a new backend project
- `GET /api/download/:projectId` - Download project as ZIP
- `GET /api/projects` - List all generated projects
- `GET /api/project/:projectId` - Get project details
- `DELETE /api/project/:projectId` - Delete project

### File Management
- `GET /api/project/:projectId/file/*` - Get file content
- `PUT /api/project/:projectId/file/*` - Update file content
- `PUT /api/project/:projectId/enhance/*` - AI enhance file
- `PUT /api/project/:projectId/rewrite/*` - AI rewrite file

### AI Chat
- `POST /api/chat` - Chat with AI assistant
- `POST /api/chat/stream` - Stream chat responses

### System
- `GET /health` - Health check
- `GET /api/models` - Available AI models

## Usage Examples

### Generate a Backend Project

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a REST API for a task management app with user authentication, CRUD operations for tasks, and MongoDB integration",
    "model": "llama-4-scout"
  }'
```

### Enhance a File

```bash
curl -X PUT http://localhost:3000/api/project/{projectId}/enhance/src/routes/tasks.js \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Add input validation and error handling",
    "model": "llama-4-scout"
  }'
```

### Chat with AI

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I add JWT authentication to my Express app?",
    "model": "llama-4-scout",
    "projectId": "optional-project-id-for-context"
  }'
```

## Available AI Models

- **llama-4-scout**: Meta's latest Llama 4 Scout (17B parameters) - Best for code generation
- **llama-3.3-70b**: Llama 3.3 70B - Most capable for complex tasks
- **mixtral-8x7b**: Mixtral 8x7B - Good balance of speed and quality
- **gemma2-9b**: Google's Gemma 2 9B - Fast and efficient

## Generated Project Structure

The AI generates complete backend projects with:

```
project-name/
├── src/
│   ├── controllers/     # Route controllers
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── utils/          # Utility functions
│   ├── config/         # Configuration files
│   └── app.js          # Main application file
├── tests/              # Test files
├── package.json        # Dependencies
├── README.md          # Project documentation
├── .env.example       # Environment template
└── Dockerfile         # Docker configuration
```

## Features Included in Generated Projects

✅ **Complete CRUD Operations**  
✅ **Database Integration** (MongoDB, PostgreSQL, etc.)  
✅ **Authentication & Authorization**  
✅ **Input Validation**  
✅ **Error Handling**  
✅ **API Documentation**  
✅ **Docker Support**  
✅ **Testing Setup**  
✅ **Security Middleware**  
✅ **Environment Configuration**  

## Development

### Run Tests
```bash
npm test
npm run test:watch
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Project Structure
```
ai-backend-generator/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env.example          # Environment template
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
├── generated_projects/   # Generated projects storage
├── uploads/             # Temporary uploads
└── README.md            # This file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key (required) | - |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: Invalid input parameters
- **404 Not Found**: Project or file not found
- **500 Internal Server Error**: AI generation or server errors

All errors return JSON with descriptive messages:
```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

## Rate Limiting

Consider implementing rate limiting for production:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Security Considerations

- Always validate API keys
- Implement input sanitization
- Use HTTPS in production
- Consider file upload limits
- Monitor generated project content
- Implement user authentication for multi-user setups

## Deployment

### Heroku
```bash
heroku create your-app-name
heroku config:set GROQ_API_KEY=your_key
git push heroku main
```

### Railway
```bash
railway login
railway new
railway add
railway deploy
```

### DigitalOcean App Platform
Use the included `Dockerfile` for container-based deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- 📧 Email: your-email@example.com
- 💬 Discord: [Your Discord]
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/ai-backend-generator/issues)

---

**Made with ❤️ and AI**