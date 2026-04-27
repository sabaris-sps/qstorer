import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import MarkdownRenderer from '../components/MarkdownRenderer';
import './ReviewAssignment.css';

const ReviewAssignment = () => {
  const { reviewQuestions, tags, showTags, invertImages } = useContext(AppContext);
  const navigate = useNavigate();

  const [qIndex, setQIndex] = useState(0);
  const [contentIndex, setContentIndex] = useState(0);
  
  // View toggles
  const [viewText, setViewText] = useState(true);
  const [viewColor, setViewColor] = useState(true);
  const [viewTagsLocal, setViewTagsLocal] = useState(showTags);

  const currentQuestion = reviewQuestions[qIndex];

  // Prepare sequential content for the current question
  const sequentialContent = useMemo(() => {
    if (!currentQuestion) return [];
    const content = [];
    
    // First image
    if (currentQuestion.images && currentQuestion.images.length > 0) {
      content.push({ type: 'image', url: currentQuestion.images[0], index: 0 });
    }
    
    // Note/Text second (if exists)
    if (currentQuestion.note && currentQuestion.note.trim() && viewText) {
      content.push({ type: 'text', text: currentQuestion.note });
    }
    
    // Remaining images
    if (currentQuestion.images && currentQuestion.images.length > 1) {
      currentQuestion.images.slice(1).forEach((url, idx) => {
        content.push({ type: 'image', url, index: idx + 1 });
      });
    }
    
    return content;
  }, [currentQuestion, viewText]);

  // Handle navigation
  const nextStep = () => {
    if (contentIndex < sequentialContent.length - 1) {
      setContentIndex(contentIndex + 1);
    } else {
      // Move to next question
      if (qIndex < reviewQuestions.length - 1) {
        setQIndex(qIndex + 1);
        setContentIndex(0);
      }
    }
  };

  const prevStep = () => {
    if (contentIndex > 0) {
      setContentIndex(contentIndex - 1);
    } else {
      // Move to previous question's last content
      if (qIndex > 0) {
        const prevQ = reviewQuestions[qIndex - 1];
        const prevQContentCount = (prevQ.images?.length || 0) + (prevQ.note && viewText ? 1 : 0);
        setQIndex(qIndex - 1);
        setContentIndex(Math.max(0, prevQContentCount - 1));
      }
    }
  };

  const handleContentClick = (e) => {
    const { clientX } = e;
    const { innerWidth } = window;
    if (clientX < innerWidth / 2) {
      prevStep();
    } else {
      nextStep();
    }
  };

  const nextQuestion = () => {
    if (qIndex < reviewQuestions.length - 1) {
      setQIndex(qIndex + 1);
      setContentIndex(0);
    }
  };

  const prevQuestion = () => {
    if (qIndex > 0) {
      setQIndex(qIndex - 1);
      setContentIndex(0);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) prevStep();
        else nextStep();
      } else if (e.key === 'ArrowRight') {
        if (e.ctrlKey || e.metaKey) nextQuestion();
        else nextStep();
      } else if (e.key === 'ArrowLeft') {
        if (e.ctrlKey || e.metaKey) prevQuestion();
        else prevStep();
      } else if (e.key === 'Escape') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qIndex, contentIndex, sequentialContent, reviewQuestions.length]);

  if (!reviewQuestions || reviewQuestions.length === 0) {
    return (
      <div className="review-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <h2>No questions selected for review</h2>
        <button className="nav-btn back-btn" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  const currentContent = sequentialContent[contentIndex];

  return (
    <div className="review-page">
      <header className="review-header">
        <div className="review-info">
          <div className="question-number-container">
            <span>Q{currentQuestion.number}</span>
            {viewColor && currentQuestion.color && (
              <span 
                className="color-dot" 
                style={{ backgroundColor: currentQuestion.color }}
                title="Question color"
              />
            )}
          </div>
          <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            {qIndex + 1} of {reviewQuestions.length}
          </span>
        </div>

        <div className="review-actions">
          <button 
            className={`nav-btn toggle-btn ${viewText ? 'active' : ''}`}
            onClick={() => setViewText(!viewText)}
            title="Toggle Text View"
          >
            T
          </button>
          <button 
            className={`nav-btn toggle-btn ${viewColor ? 'active' : ''}`}
            onClick={() => setViewColor(!viewColor)}
            title="Toggle Color View"
          >
            C
          </button>
          <button 
            className={`nav-btn toggle-btn ${viewTagsLocal ? 'active' : ''}`}
            onClick={() => setViewTagsLocal(!viewTagsLocal)}
            title="Toggle Tags View"
          >
            #
          </button>
          <button className="nav-btn back-btn" onClick={() => navigate('/')}>
            Back to Edit
          </button>
        </div>
      </header>

      <main className="review-content" onClick={handleContentClick}>
        {currentContent?.type === 'image' ? (
          <div className="review-image-container">
            <img 
              src={currentContent.url} 
              alt={`Question ${currentQuestion.number}`} 
              className={`review-image ${invertImages ? 'invert' : ''}`}
            />
          </div>
        ) : currentContent?.type === 'text' ? (
          <div className="review-text-container" onClick={(e) => e.stopPropagation()}>
            <MarkdownRenderer content={currentContent.text} />
          </div>
        ) : (
          <div className="placeholder">No content available for this question</div>
        )}

        {viewTagsLocal && currentQuestion.tags && currentQuestion.tags.length > 0 && (
          <div className="review-tags">
            {currentQuestion.tags.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <span 
                  key={tagId} 
                  className="review-tag"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}

        <div className="progress-indicator">
          {sequentialContent.map((_, idx) => (
            <div 
              key={idx} 
              className={`progress-dot ${idx === contentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </main>

      <footer className="review-footer">
        <button 
          className="nav-btn" 
          onClick={prevQuestion} 
          disabled={qIndex === 0}
        >
          &laquo; Prev Question
        </button>
        <button 
          className="nav-btn" 
          onClick={prevStep}
          disabled={qIndex === 0 && contentIndex === 0}
        >
          &lsaquo; Prev
        </button>
        <button 
          className="nav-btn" 
          onClick={nextStep}
          disabled={qIndex === reviewQuestions.length - 1 && contentIndex === sequentialContent.length - 1}
        >
          Next &rsaquo;
        </button>
        <button 
          className="nav-btn" 
          onClick={nextQuestion}
          disabled={qIndex === reviewQuestions.length - 1}
        >
          Next Question &raquo;
        </button>
      </footer>
    </div>
  );
};

export default ReviewAssignment;
