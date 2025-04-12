// components/FilePreview.jsx
import React from 'react';

function FilePreview({ file }) {
  const isImage = file.type.startsWith('image/');
  
  if (isImage) {
    const objectUrl = URL.createObjectURL(file);
    return (
      <div className="file-preview image-preview">
        <img src={objectUrl} alt={file.name} onLoad={() => URL.revokeObjectURL(objectUrl)} />
        <span className="file-name">{file.name}</span>
      </div>
    );
  }
  
  // For non-image files
  return (
    <div className="file-preview document-preview">
      <div className="file-icon">
        {file.type.includes('pdf') ? '📄' : 
         file.type.includes('word') ? '📝' : 
         file.type.includes('text') ? '📋' : '📎'}
      </div>
      <span className="file-name">{file.name}</span>
    </div>
  );
}

export default FilePreview;