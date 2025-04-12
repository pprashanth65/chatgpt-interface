// components/Message.jsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import FilePreview from './FilePreview';

function Message({ message }) {
  const { role, content, files, timestamp } = message;
  
  return (
    <div className={`message ${role === 'user' ? 'user-message' : 'assistant-message'}`}>
      <div className="message-header">
        <span className="role">{role === 'user' ? 'You' : 'AI'}</span>
        <span className="timestamp">{new Date(timestamp).toLocaleTimeString()}</span>
      </div>
      
      <div className="message-content">
        {files && files.length > 0 && (
          <div className="file-previews">
            {files.map((file, index) => (
              <FilePreview key={index} file={file} />
            ))}
          </div>
        )}
        <div className="text-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default Message;