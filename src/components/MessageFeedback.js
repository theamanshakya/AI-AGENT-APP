import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const MessageFeedback = ({ messageId, onFeedbackSubmit }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          rating,
          feedback,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      onFeedbackSubmit?.();
      setIsExpanded(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="message-feedback">
      <div className="rating-buttons">
        <button
          onClick={() => {
            setRating(1);
            setIsExpanded(true);
          }}
          className={`rating-btn ${rating === 1 ? 'active' : ''}`}
        >
          👎
        </button>
        <button
          onClick={() => {
            setRating(5);
            setIsExpanded(true);
          }}
          className={`rating-btn ${rating === 5 ? 'active' : ''}`}
        >
          👍
        </button>
      </div>

      {isExpanded && (
        <div className="feedback-expanded">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Additional feedback (optional)"
            className="feedback-input"
          />
          <div className="feedback-actions">
            <button
              onClick={() => setIsExpanded(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageFeedback; 