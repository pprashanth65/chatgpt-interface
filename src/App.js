// App.jsx
import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import MessageList from './components/MessageList';
import FileUpload from './components/FileUpload';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const messagesEndRef = useRef(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleFileUpload = (acceptedFiles) => {
    setFiles([...files, ...acceptedFiles]);
  };

  const removeFile = (index) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const sendMessage = async () => {
    if (!input.trim() && files.length === 0) return;
    
    const newMessage = {
      role: 'user',
      content: input,
      files: [...files],
      timestamp: new Date().toISOString()
    };
    
    setMessages([...messages, newMessage]);
    setInput('');
    setIsLoading(true);
    
    // Create form data to send files
    const formData = new FormData();
    formData.append('message', input);
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Create a simplified history for Gemini API
    // Gemini expects a specific format for chat history
    const simplifiedHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    formData.append('history', JSON.stringify(simplifiedHistory));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to get response');
      }
      
      const data = await response.json();
      
      setMessages(currentMessages => [
        ...currentMessages,
        {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(currentMessages => [
        ...currentMessages,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
      setFiles([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Gemini AI Assistant</h1>
      </header>
      
      <div className="messages-container">
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
        {isLoading && <div className="loading-indicator">AI is thinking...</div>}
      </div>
      
      <div className="input-area">
        <FileUpload 
          onUpload={handleFileUpload} 
          files={files} 
          onRemove={removeFile} 
        />
        <div className="text-input-container">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={3}
          />
          <button 
            onClick={sendMessage}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;