const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// OpenRouter Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Available models configuration
const AVAILABLE_MODELS = {
  'gemini-2.0-flash': 'google/gemini-2.0-flash-exp:free',
  'devstral-small': 'mistralai/devstral-small:free'
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

// OpenRouter API client
class OpenRouterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = OPENROUTER_BASE_URL;
  }

  async chat(model, messages, options = {}) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://backend-generator.ai',
        'X-Title': 'Backend Generator API'
      },
      body: JSON.stringify({
        model: AVAILABLE_MODELS[model] || model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// Project structure generator
class ProjectGenerator {
  constructor(openRouterClient) {
    this.client = openRouterClient;
  }

  async generateProjectStructure(prompt, model = 'gemini-2.0-flash') {
    const systemPrompt = `You are a senior backend developer. Generate a complete backend project structure based on the user's prompt. 

Response format should be a JSON object with this exact structure:
{
  "projectName": "project-name",
  "description": "Brief project description",
  "technology": "primary technology stack",
  "fileTree": {
    "folder/subfolder": {
      "type": "directory"
    },
    "folder/file.ext": {
      "type": "file",
      "content": "complete file content here"
    }
  },
  "dependencies": {
    "package.json dependencies or requirements": "version"
  },
  "setupInstructions": [
    "step by step setup instructions"
  ],
  "apiEndpoints": [
    {
      "method": "GET/POST/PUT/DELETE",
      "path": "/api/endpoint",
      "description": "what this endpoint does"
    }
  ]
}

Generate production-ready code with:
- Proper error handling
- Input validation
- Security measures
- Database models/schemas
- API documentation
- Configuration files
- Docker support when appropriate
- Tests when relevant

Make the code complete and functional, not placeholder code.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const response = await this.client.chat(model, messages, {
      temperature: 0.3,
      maxTokens: 8000
    });

    const content = response.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from LLM');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async enhanceFileContent(filePath, currentContent, requirements, model = 'devstral-small') {
    const systemPrompt = `You are a senior developer. Enhance the provided code file to meet the specific requirements. Return only the enhanced code content, no explanations or markdown formatting.`;
    
    const userPrompt = `File: ${filePath}
Current content:
${currentContent}

Requirements:
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

    return response.choices[0].message.content.trim();
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
}

// Initialize OpenRouter client
const openRouterClient = new OpenRouterClient(OPENROUTER_API_KEY);
const projectGenerator = new ProjectGenerator(openRouterClient);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    models: Object.keys(AVAILABLE_MODELS)
  });
});

// Get available models
app.get('/api/models', (req, res) => {
  res.json({
    models: Object.keys(AVAILABLE_MODELS),
    default: 'gemini-2.0-flash'
  });
});

// Generate backend project
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.0-flash', options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    const projectId = uuidv4();
    
    // Generate project structure
    const projectData = await projectGenerator.generateProjectStructure(prompt, model);
    
    // Create files on disk
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

    res.json({
      success: true,
      projectId,
      projectName: projectData.projectName,
      description: projectData.description,
      technology: projectData.technology,
      fileTree: Object.keys(projectData.fileTree),
      dependencies: projectData.dependencies,
      setupInstructions: projectData.setupInstructions,
      apiEndpoints: projectData.apiEndpoints,
      downloadUrl: `/api/download/${projectId}`
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate project',
      message: error.message 
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

    // Create zip archive
    const zipPath = path.join(PROJECTS_DIR, `${projectId}.zip`);
    await FileSystemManager.createZipArchive(projectPath, zipPath);

    // Send file
    res.download(zipPath, `backend-project-${projectId}.zip`, (err) => {
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
    const metadataPath = path.join(PROJECTS_DIR, projectId, 'project-metadata.json');
    
    try {
      const metadata = await fs.readFile(metadataPath, 'utf8');
      res.json(JSON.parse(metadata));
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
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({ content, path: filePath });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('File content error:', error);
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

// Enhance existing file
app.put('/api/project/:projectId/enhance/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = req.params[0];
    const { requirements, model = 'devstral-small' } = req.body;
    
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
        backupCreated: true
      });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Enhancement error:', error);
    res.status(500).json({ error: 'Failed to enhance file' });
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
          generated: projectData.generated
        });
      } catch {
        // Skip invalid projects
        continue;
      }
    }
    
    res.json({ projects });
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

// Chat with LLM for development questions
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'gemini-2.0-flash', context = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You are a helpful backend development assistant. Provide clear, practical advice for backend development questions. Include code examples when helpful.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...context,
      { role: 'user', content: message }
    ];

    const response = await openRouterClient.chat(model, messages);
    
    res.json({
      response: response.choices[0].message.content,
      model: model
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
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
    console.log(`🚀 Backend Generator API running on port ${PORT}`);
    console.log(`📚 Available endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/models - Available models`);
    console.log(`   POST /api/generate - Generate backend project`);
    console.log(`   GET  /api/download/:id - Download project`);
    console.log(`   GET  /api/project/:id - Get project details`);
    console.log(`   GET  /api/projects - List all projects`);
    console.log(`   POST /api/chat - Chat with LLM`);
    console.log(`\n🔑 Don't forget to set OPENROUTER_API_KEY environment variable`);
  });
}

startServer().catch(console.error);

module.exports = app;