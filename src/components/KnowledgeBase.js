import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const KnowledgeBase = () => {
  const { agentId } = useParams();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [newDocument, setNewDocument] = useState({ content: '', metadata: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [agentId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/knowledge`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch knowledge base');

      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      setError('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/agents/${agentId}/knowledge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload file');

      await fetchDocuments();
    } catch (error) {
      setError('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(newDocument),
      });

      if (!response.ok) throw new Error('Failed to add document');

      await fetchDocuments();
      setNewDocument({ content: '', metadata: {} });
    } catch (error) {
      setError('Failed to add document');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/knowledge/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete document');

      await fetchDocuments();
    } catch (error) {
      setError('Failed to delete document');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="knowledge-base-container">
      <h2>Knowledge Base Management</h2>
      {error && <div className="error-message">{error}</div>}
      
      <div className="upload-section">
        <h3>Upload Document</h3>
        <input
          type="file"
          onChange={handleFileUpload}
          disabled={uploadingFile}
          accept=".txt,.pdf,.doc,.docx"
        />
        {uploadingFile && <div>Uploading...</div>}
      </div>

      <div className="add-document-section">
        <h3>Add Document</h3>
        <form onSubmit={handleAddDocument}>
          <textarea
            value={newDocument.content}
            onChange={(e) => setNewDocument({ ...newDocument, content: e.target.value })}
            placeholder="Enter document content..."
            className="document-input"
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            Add to Knowledge Base
          </button>
        </form>
      </div>

      <div className="documents-list">
        <h3>Current Documents</h3>
        {documents.map((doc) => (
          <div key={doc.id} className="document-item">
            <div className="document-content">{doc.content}</div>
            <div className="document-actions">
              <button
                onClick={() => handleDeleteDocument(doc.id)}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBase; 