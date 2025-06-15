const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { Groq } = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Groq Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Available models configuration
const AVAILABLE_MODELS = {
  'llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'mixtral-8x7b': 'mixtral-8x7b-32768',
  'gemma2-9b': 'gemma2-9b-it'
};

// Storage configuration
const PROJECTS_DIR = path.join(__dirname, 'generated_projects');
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    await fs.mkdir('uploads', { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Groq API client
class GroqClient {
  constructor(apiKey) {
    this.groq = new Groq({ apiKey });
  }

  async chat(model, messages, options = {}) {
    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages,
        model: AVAILABLE_MODELS[model] || model,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        top_p: options.top_p || 1,
        stream: false,
        stop: null
      });

      return {
        choices: [{
          message: {
            content: chatCompletion.choices[0]?.message?.content || ''
          }
        }]
      };
    } catch (error) {
      console.error('Groq API error:', error);
      throw new Error(`Groq API error: ${error.message}`);
    }
  }

  async chatStream(model, messages, options = {}) {
    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages,
        model: AVAILABLE_MODELS[model] || model,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        top_p: options.top_p || 1,
        stream: true,
        stop: null
      });

      return chatCompletion;
    } catch (error) {
      console.error('Groq API streaming error:', error);
      throw new Error(`Groq API streaming error: ${error.message}`);
    }
  }
}

// Project structure generator
class ProjectGenerator {
  constructor(groqClient) {
    this.client = groqClient;
  }

  async generateProjectStructure(prompt, model = 'llama-4-scout') {
    const systemPrompt = `You are a senior full-stack backend developer and architect. Generate a complete, production-ready backend project structure based on the user's prompt.

CRITICAL: Your response must be a valid JSON object with this EXACT structure:
{
  "projectName": "kebab-case-project-name",
  "description": "Brief project description",
  "technology": "primary technology stack (Node.js, Python, etc.)",
  "framework": "framework used (Express, FastAPI, Django, etc.)",
  "database": "database type (MongoDB, PostgreSQL, etc.)",
  "fileTree": {
    "src/": { "type": "directory" },
    "src/controllers/": { "type": "directory" },
    "src/models/": { "type": "directory" },
    "src/routes/": { "type": "directory" },
    "src/middleware/": { "type": "directory" },
    "src/utils/": { "type": "directory" },
    "src/config/": { "type": "directory" },
    "src/app.js": {
      "type": "file",
      "content": "complete file content here"
    },
    "package.json": {
      "type": "file", 
      "content": "complete package.json content"
    }
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.4"
  },
  "setupInstructions": [
    "Clone the repository",
    "Run npm install",
    "Set up environment variables",
    "Run npm start"
  ],
  "apiEndpoints": [
    {
      "method": "GET",
      "path": "/api/endpoint",
      "description": "endpoint description",
      "parameters": ["param1", "param2"],
      "response": "response description"
    }
  ],
  "environmentVariables": {
    "NODE_ENV": "development",
    "PORT": "3000",
    "DATABASE_URL": "your_database_url"
  }
}

Generate COMPLETE, FUNCTIONAL code:
- All files must have complete, working code (no placeholders)
- Include proper error handling and validation
- Add authentication/authorization if needed
- Include database models and schemas
- Add middleware for CORS, logging, error handling
- Include Docker support when appropriate
- Add comprehensive API documentation
- Include testing setup
- Follow best practices and security measures
- Make it production-ready

The code should be immediately runnable after setup.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const response = await this.client.chat(model, messages, {
      temperature: 0.3,
      maxTokens: 8000
    });

    const content = response.choices[0].message.content;
    
    // Extract JSON from response - handle markdown code blocks
    let jsonContent = content;
    if (content.includes('```json')) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    } else if (content.includes('```')) {
      const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    } else {
      // Try to find JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
    }

    try {
      return JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Content:', jsonContent);
      throw new Error('Invalid JSON response from AI model');
    }
  }

  async enhanceFileContent(filePath, currentContent, requirements, model = 'llama-4-scout') {
    const systemPrompt = `You are a senior developer. Enhance the provided code file to meet the specific requirements. 
    
IMPORTANT: Return ONLY the enhanced code content, no explanations, no markdown formatting, no code blocks.`;
    
    const userPrompt = `File: ${filePath}

Current content:
${currentContent}

Enhancement requirements:
${requirements}

Provide the complete enhanced file content:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.client.chat(model, messages, {
      temperature: 0.2,
      maxTokens: 6000
    });

    let content = response.choices[0].message.content.trim();
    
    // Remove code block markers if present
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      lines.shift(); // Remove first ```
      if (lines[lines.length - 1].trim() === '```') {
        lines.pop(); // Remove last ```
      }
      content = lines.join('\n');
    }

    return content;
  }

  async rewriteFileContent(filePath, currentContent, instructions, model = 'llama-4-scout') {
    const systemPrompt = `You are a senior developer. Completely rewrite the provided code file based on the instructions.
    
IMPORTANT: Return ONLY the rewritten code content, no explanations, no markdown formatting, no code blocks.`;
    
    const userPrompt = `File: ${filePath}

Current content:
${currentContent}

Rewrite instructions:
${instructions}

Provide the complete rewritten file content:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.client.chat(model, messages, {
      temperature: 0.3,
      maxTokens: 6000
    });

    let content = response.choices[0].message.content.trim();
    
    // Remove code block markers if present
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      lines.shift(); // Remove first ```
      if (lines[lines.length - 1].trim() === '```') {
        lines.pop(); // Remove last ```
      }
      content = lines.join('\n');
    }

    return content;
  }
}

// File system utilities
class FileSystemManager {
  static async createProjectFiles(projectId, fileTree) {
    const projectPath = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(projectPath, { recursive: true });

    for (const [filePath, fileData] of Object.entries(fileTree)) {
      const fullPath = path.join(projectPath, filePath);
      
      if (fileData.type === 'directory') {
        await fs.mkdir(fullPath, { recursive: true });
      } else if (fileData.type === 'file') {
        // Ensure parent directory exists
        const dirPath = path.dirname(fullPath);
        await fs.mkdir(dirPath, { recursive: true });
        
        // Write file content
        await fs.writeFile(fullPath, fileData.content || '', 'utf8');
      }
    }

    return projectPath;
  }

  static async createZipArchive(projectPath, outputPath) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      output.on('close', () => resolve(outputPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(projectPath, false);
      archive.finalize();
    });
  }

  static async getFileTree(projectPath, relativePath = '') {
    const items = await fs.readdir(path.join(projectPath, relativePath));
    const tree = {};

    for (const item of items) {
      const itemPath = path.join(projectPath, relativePath, item);
      const stats = await fs.stat(itemPath);
      const key = relativePath ? `${relativePath}/${item}` : item;

      if (stats.isDirectory()) {
        tree[key] = { type: 'directory' };
        const subtree = await this.getFileTree(projectPath, key);
        Object.assign(tree, subtree);
      } else {
        tree[key] = { type: 'file' };
      }
    }

    return tree;
  }
}

// Initialize Groq client
const groqClient = new GroqClient(GROQ_API_KEY);
const projectGenerator = new ProjectGenerator(groqClient);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    models: Object.keys(AVAILABLE_MODELS),
    groqConfigured: !!GROQ_API_KEY
  });
});

// Get available models
app.get('/api/models', (req, res) => {
  res.json({
    models: Object.keys(AVAILABLE_MODELS),
    default: 'llama-4-scout',
    details: AVAILABLE_MODELS
  });
});

// Generate backend project
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model = 'llama-4-scout', options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    const projectId = uuidv4();
    
    // Generate project structure
    console.log('Generating project structure...');
    const projectData = await projectGenerator.generateProjectStructure(prompt, model);
    
    // Create files on disk
    console.log('Creating project files...');
    const projectPath = await FileSystemManager.createProjectFiles(projectId, projectData.fileTree);
    
    // Create metadata file
    const metadata = {
      id: projectId,
      prompt,
      model,
      generated: new Date().toISOString(),
      ...projectData
    };
    
    await fs.writeFile(
      path.join(projectPath, 'project-metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );

    // Create README.md
    const readmeContent = `# ${projectData.projectName}

${projectData.description}

## Technology Stack
- **Framework**: ${projectData.framework || 'N/A'}
- **Database**: ${projectData.database || 'N/A'}
- **Technology**: ${projectData.technology}

## Setup Instructions
${projectData.setupInstructions.map(instruction => `1. ${instruction}`).join('\n')}

## Environment Variables
${Object.entries(projectData.environmentVariables || {}).map(([key, value]) => `- ${key}=${value}`).join('\n')}

## API Endpoints
${projectData.apiEndpoints.map(endpoint => 
  `### ${endpoint.method} ${endpoint.path}\n${endpoint.description}\n${endpoint.parameters ? `**Parameters**: ${endpoint.parameters.join(', ')}\n` : ''}${endpoint.response ? `**Response**: ${endpoint.response}\n` : ''}`
).join('\n\n')}

## Dependencies
### Production
${Object.entries(projectData.dependencies || {}).map(([pkg, version]) => `- ${pkg}: ${version}`).join('\n')}

### Development
${Object.entries(projectData.devDependencies || {}).map(([pkg, version]) => `- ${pkg}: ${version}`).join('\n')}

Generated by AI Backend Generator
`;

    await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

    res.json({
      success: true,
      projectId,
      projectName: projectData.projectName,
      description: projectData.description,
      technology: projectData.technology,
      framework: projectData.framework,
      database: projectData.database,
      fileTree: Object.keys(projectData.fileTree),
      dependencies: projectData.dependencies,
      devDependencies: projectData.devDependencies,
      setupInstructions: projectData.setupInstructions,
      apiEndpoints: projectData.apiEndpoints,
      environmentVariables: projectData.environmentVariables,
      downloadUrl: `/api/download/${projectId}`,
      viewUrl: `/api/project/${projectId}`
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate project',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Download generated project
app.get('/api/download/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(PROJECTS_DIR, projectId);
    
    // Check if project exists
    try {
      await fs.access(projectPath);
    } catch {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project metadata for filename
    let projectName = projectId;
    try {
      const metadataPath = path.join(projectPath, 'project-metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      projectName = metadata.projectName || projectId;
    } catch {
      // Use default projectId if metadata not found
    }

    // Create zip archive
    const zipPath = path.join(PROJECTS_DIR, `${projectId}.zip`);
    await FileSystemManager.createZipArchive(projectPath, zipPath);

    // Send file
    res.download(zipPath, `${projectName}.zip`, (err) => {
      if (!err) {
        // Clean up zip file after download
        fs.unlink(zipPath).catch(console.error);
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download project' });
  }
});

// Get project details
app.get('/api/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const metadataPath = path.join(projectPath, 'project-metadata.json');
    
    try {
      await fs.access(projectPath);
      const metadata = await fs.readFile(metadataPath, 'utf8');
      const projectData = JSON.parse(metadata);
      
      // Get current file tree
      const currentFileTree = await FileSystemManager.getFileTree(projectPath);
      
      res.json({
        ...projectData,
        currentFileTree: Object.keys(currentFileTree)
      });
    } catch {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    console.error('Project details error:', error);
    res.status(500).json({ error: 'Failed to get project details' });
  }
});

// Get file content
app.get('/api/project/:projectId/file/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0]; // Get the rest of the path
    const fullPath = path.join(PROJECTS_DIR, projectId, filePath);
    
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory, not a file' });
      }
      
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({ 
        content, 
        path: filePath,
        size: stats.size,
        modified: stats.mtime
      });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('File content error:', error);
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

// Update file content
app.put('/api/project/:projectId/file/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { content } = req.body;
    
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const fullPath = path.join(PROJECTS_DIR, projectId, filePath);
    
    // Ensure parent directory exists
    const dirPath = path.dirname(fullPath);
    await fs.mkdir(dirPath, { recursive: true });
    
    // Write file content
    await fs.writeFile(fullPath, content, 'utf8');
    
    res.json({ 
      success: true,
      message: 'File updated successfully',
      path: filePath
    });
  } catch (error) {
    console.error('File update error:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// Enhance existing file
app.put('/api/project/:projectId/enhance/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { requirements, model = 'llama-4-scout' } = req.body;
    
    if (!requirements) {
      return res.status(400).json({ error: 'Requirements are required' });
    }

    const fullPath = path.join(PROJECTS_DIR, projectId, filePath);
    
    try {
      const currentContent = await fs.readFile(fullPath, 'utf8');
      const enhancedContent = await projectGenerator.enhanceFileContent(
        filePath, 
        currentContent, 
        requirements, 
        model
      );
      
      // Backup original file
      const backupPath = `${fullPath}.backup`;
      await fs.writeFile(backupPath, currentContent);
      
      // Write enhanced content
      await fs.writeFile(fullPath, enhancedContent);
      
      res.json({ 
        success: true,
        message: 'File enhanced successfully',
        backupCreated: true,
        content: enhancedContent
      });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Enhancement error:', error);
    res.status(500).json({ error: 'Failed to enhance file' });
  }
});

// Rewrite file content using AI
app.put('/api/project/:projectId/rewrite/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { instructions, model = 'llama-4-scout' } = req.body;
    
    if (!instructions) {
      return res.status(400).json({ error: 'Instructions are required' });
    }

    const fullPath = path.join(PROJECTS_DIR, projectId, filePath);
    
    try {
      const currentContent = await fs.readFile(fullPath, 'utf8');
      const rewrittenContent = await projectGenerator.rewriteFileContent(
        filePath, 
        currentContent, 
        instructions, 
        model
      );
      
      // Backup original file
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, currentContent);
      
      // Write rewritten content
      await fs.writeFile(fullPath, rewrittenContent);
      
      res.json({ 
        success: true,
        message: 'File rewritten successfully',
        backupCreated: true,
        content: rewrittenContent
      });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Rewrite error:', error);
    res.status(500).json({ error: 'Failed to rewrite file' });
  }
});

// List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = [];
    const projectDirs = await fs.readdir(PROJECTS_DIR);
    
    for (const dir of projectDirs) {
      if (dir.endsWith('.zip')) continue;
      
      try {
        const metadataPath = path.join(PROJECTS_DIR, dir, 'project-metadata.json');
        const metadata = await fs.readFile(metadataPath, 'utf8');
        const projectData = JSON.parse(metadata);
        
        projects.push({
          id: projectData.id,
          name: projectData.projectName,
          description: projectData.description,
          technology: projectData.technology,
          framework: projectData.framework,
          database: projectData.database,
          generated: projectData.generated,
          model: projectData.model
        });
      } catch {
        // Skip invalid projects
        continue;
      }
    }
    
    // Sort by generation date (newest first)
    projects.sort((a, b) => new Date(b.generated) - new Date(a.generated));
    
    res.json({ projects, total: projects.length });
  } catch (error) {
    console.error('Projects list error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Delete project
app.delete('/api/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectPath = path.join(PROJECTS_DIR, projectId);
    
    await fs.rm(projectPath, { recursive: true, force: true });
    
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Chat with AI for development questions
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'llama-4-scout', context = [], projectId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let systemPrompt = `You are a helpful backend development assistant. Provide clear, practical advice for backend development questions. Include code examples when helpful.`;
    
    // If projectId is provided, add project context
    if (projectId) {
      try {
        const metadataPath = path.join(PROJECTS_DIR, projectId, 'project-metadata.json');
        const metadata = await fs.readFile(metadataPath, 'utf8');
        const projectData = JSON.parse(metadata);
        
        systemPrompt += `\n\nContext: You are helping with a project called "${projectData.projectName}". 
Technology: ${projectData.technology}
Framework: ${projectData.framework || 'N/A'}
Database: ${projectData.database || 'N/A'}
Description: ${projectData.description}`;
      } catch {
        // Continue without project context if metadata not found
      }
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: message }
    ];

    const response = await groqClient.chat(model, messages);
    
    res.json({
      response: response.choices[0].message.content,
      model: model,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Stream chat response
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, model = 'llama-4-scout', context = [], projectId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let systemPrompt = `You are a helpful backend development assistant. Provide clear, practical advice for backend development questions. Include code examples when helpful.`;
    
    // If projectId is provided, add project context
    if (projectId) {
      try {
        const metadataPath = path.join(PROJECTS_DIR, projectId, 'project-metadata.json');
        const metadata = await fs.readFile(metadataPath, 'utf8');
        const projectData = JSON.parse(metadata);
        
        systemPrompt += `\n\nContext: You are helping with a project called "${projectData.projectName}". 
Technology: ${projectData.technology}
Framework: ${projectData.framework || 'N/A'}
Database: ${projectData.database || 'N/A'}
Description: ${projectData.description}`;
      } catch {
        // Continue without project context if metadata not found
      }
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: message }
    ];

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const chatCompletion = await groqClient.chatStream(model, messages);
    
    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(content);
      }
    }
    
    res.end();
    
  } catch (error) {
    console.error('Stream chat error:', error);
    res.status(500).json({ error: 'Failed to process stream chat message' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function startServer() {
  await ensureDirectories();
  
  app.listen(PORT, () => {
    console.log(`🚀 AI Backend Generator API running on port ${PORT}`);
    console.log(`📚 Available endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/models - Available models`);
    console.log(`   POST /api/generate - Generate backend project`);
    console.log(`   GET  /api/download/:id - Download project`);
    console.log(`   GET  /api/project/:id - Get project details`);
    console.log(`   GET  /api/project/:id/file/* - Get file content`);
    console.log(`   PUT  /api/project/:id/file/* - Update file content`);
    console.log(`   PUT  /api/project/:id/enhance/* - AI enhance file`);
    console.log(`   PUT  /api/project/:id/rewrite/* - AI rewrite file`);
    console.log(`   GET  /api/projects - List all projects`);
    console.log(`   DELETE /api/project/:id - Delete project`);
    console.log(`   POST /api/chat - Chat with AI`);
    console.log(`   POST /api/chat/stream - Stream chat with AI`);
    console.log(`\n🔑 Don't forget to set GROQ_API_KEY environment variable`);
    console.log(`🤖 Using Groq AI with models: ${Object.keys(AVAILABLE_MODELS).join(', ')}`);
  });
}

startServer().catch(console.error);

module.exports = app;