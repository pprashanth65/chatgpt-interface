// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());

// Configure Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

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

// Function to convert file to base64
function fileToGenerativePart(file, mimeType) {
  const fileData = fs.readFileSync(file.path);
  return {
    inlineData: {
      data: fileData.toString("base64"),
      mimeType
    }
  };
}

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
    
    // Initialize the model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash" 
    });
    
    // Start a chat session
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    
    // Build message content for Gemini API
    const messageParts = [];
    
    // Add text message
    if (message) {
      messageParts.push({ text: message });
    }
    
    // Process images and other files
    for (const file of files) {
      if (file.mimetype.includes('image')) {
        // Process image files directly
        messageParts.push(fileToGenerativePart(file, file.mimetype));
      } else {
        // For non-image files, extract text and add as text content
        const textContent = await extractTextFromFile(file);
        if (textContent) {
          messageParts.push({ 
            text: `Content from file "${file.originalname}":\n${textContent}`
          });
        }
      }
    }
    
    // Send the message to Gemini
    const result = await chat.sendMessage(messageParts);
    const response = await result.response;
    
    // Return the response
    res.json({
      message: response.text()
    });
    
    // Clean up uploaded files
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing your request', details: error.message });
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