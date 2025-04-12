// server.js
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Extract text from different file types
async function extractTextFromFile(file) {
  const filePath = file.path;
  const fileType = file.mimetype;
  
  try {
    if (fileType.includes('pdf')) {
      // Only require PDF parser when needed
      const PDFParser = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await PDFParser(dataBuffer);
      return data.text;
    } 
    else if (fileType.includes('word')) {
      // Only require mammoth when needed
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    else if (fileType.includes('text')) {
      return fs.readFileSync(filePath, 'utf8');
    }
    else if (fileType.includes('image')) {
      // For images, we'll encode them to base64 and use OpenAI's vision capabilities
      const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });
      return { type: 'image', data: base64Image };
    }
    return null;
  } catch (error) {
    console.error('Error extracting text:', error);
    return null;
  }
}

// API endpoint for chat
app.post('/api/chat', upload.array('files'), async (req, res) => {
  try {
    const message = req.body.message || '';
    const files = req.files || [];
    let history = [];
    
    try {
      if (req.body.history) {
        history = JSON.parse(req.body.history);
      }
    } catch (e) {
      console.error('Error parsing history:', e);
    }
    
    // Process files
    const fileContents = await Promise.all(
      files.map(async (file) => {
        return await extractTextFromFile(file);
      })
    );
    
    // Build message history for OpenAI API
    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add the new user message
    let userMessageContent = [];
    
    // Add text content if present
    if (message) {
      userMessageContent.push({
        type: 'text',
        text: message
      });
    }
    
    // Add file contents
    for (let i = 0; i < fileContents.length; i++) {
      const content = fileContents[i];
      if (content) {
        if (content.type === 'image') {
          userMessageContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${files[i].mimetype};base64,${content.data}`
            }
          });
        } else {
          // For text-based files, append their content to the message
          userMessageContent.push({
            type: 'text',
            text: `Content from file "${files[i].originalname}":\n${content}`
          });
        }
      }
    }
    
    // If using older OpenAI API versions, we need to format differently
    let userMessage;
    
    // Check if the API supports the content array format
    if (userMessageContent.length > 0) {
      try {
        userMessage = {
          role: 'user',
          content: userMessageContent
        };
        
        messages.push(userMessage);
        
        // Make API call to OpenAI with content array
        const completion = await openai.chat.completions.create({
          model: "gpt-4-vision-preview", // Use vision model to handle images
          messages: messages,
          max_tokens: 1000
        });
        
        // Return the response
        res.json({
          message: completion.choices[0].message.content
        });
      } catch (error) {
        // If content array format fails, try the fallback format
        console.error('Error with content array format:', error);
        
        // Build a simple string message as fallback
        let fallbackContent = message || '';
        
        for (let i = 0; i < fileContents.length; i++) {
          const content = fileContents[i];
          if (content && content.type !== 'image') {
            fallbackContent += `\n\nContent from file "${files[i].originalname}":\n${content}`;
          }
        }
        
        userMessage = {
          role: 'user',
          content: fallbackContent
        };
        
        // Replace the last message if it existed
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
          messages[messages.length - 1] = userMessage;
        } else {
          messages.push(userMessage);
        }
        
        // Try again with simpler format
        const completion = await openai.chat.completions.create({
          model: "gpt-4", // Fallback to non-vision model
          messages: messages,
          max_tokens: 1000
        });
        
        res.json({
          message: completion.choices[0].message.content
        });
      }
    } else {
      // No content to send
      res.status(400).json({ error: 'No message or file content provided' });
    }
    
    // Clean up uploaded files
    for (const file of files) {
      fs.unlinkSync(file.path);
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from the React app if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});