import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterviewSession, submitInterviewAnswer } from '../services/endpoints';
import CandidateShell from '../components/CandidateShell';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ── Mic icon ───────────────────────────────────────── */
const IconMic = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const IconMicOff = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const InterviewPage = () => {
  const { token }   = useParams();
  const navigate    = useNavigate();

  const [candidateName, setCandidateName] = useState('');
  const [jobTitle, setJobTitle]           = useState('');
  const [questions, setQuestions]         = useState([]);
  const [currentIdx, setCurrentIdx]       = useState(0);

  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewFinished, setInterviewFinished] = useState(false);

  const [isListening, setIsListening]       = useState(false);
  const [transcript, setTranscript]         = useState('');
  const [showTextInput, setShowTextInput]   = useState(false);
  const [recognition, setRecognition]       = useState(null);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [micBlocked, setMicBlocked]         = useState(false);

  const [submitting, setSubmitting]   = useState(false);
  const [answerError, setAnswerError] = useState(null);

  /* Fetch session */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getInterviewSession(token);
        setCandidateName(res.candidate_name || '');
        setJobTitle(res.job_title || '');
        setQuestions(res.questions || []);
        setCurrentIdx(res.current_question_index || 0);
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired interview link.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  /* Init speech recognition */
  useEffect(() => {
    if (SpeechRecognition) {
      setRecognitionSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous    = true;
      rec.interimResults = true;
      rec.lang          = 'en-US';

      rec.onresult = (event) => {
        let interim = '', final = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) final  += event.results[i][0].transcript;
          else                          interim += event.results[i][0].transcript;
        }
        setTranscript(final || interim);
      };
      rec.onerror = (e) => {
        console.error('Speech error', e);
        if (e.error === 'not-allowed') setMicBlocked(true);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      setRecognition(rec);
    }
  }, []);

  const speakQuestion = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  };

  const handleStart = () => {
    if (!questions.length) { setError('No questions loaded.'); return; }
    setInterviewStarted(true);
    speakQuestion(questions[currentIdx]?.question);
  };

  const handleMicToggle = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop(); setIsListening(false);
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setTranscript(''); setAnswerError(null); setIsListening(true);
      try { recognition.start(); } catch (e) { console.error(e); }
    }
  };

  const handleDoneSpeaking = async () => {
    if (isListening && recognition) { recognition.stop(); setIsListening(false); }
    if (!transcript.trim()) { setAnswerError('Please provide an answer.'); return; }
    await submitAnswer();
  };

  const submitAnswer = async () => {
    setSubmitting(true); setAnswerError(null);
    try {
      const res = await submitInterviewAnswer(token, {
        question_id: currentIdx,
        answer_type: 'speech',
        answer: transcript,
      });
      if (res.is_last_question) {
        setInterviewFinished(true);
        setTimeout(() => navigate(`/result/${token}`), 2000);
      } else {
        setTranscript(''); setShowTextInput(false);
        const next = currentIdx + 1;
        setCurrentIdx(next);
        if (res.next_question) speakQuestion(res.next_question.question);
      }
    } catch (err) {
      setAnswerError(err.response?.data?.error || 'Error submitting answer.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner spinner-lg" />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading interview session…</span>
      </div>
    );
  }

  /* ── Pre-start error ── */
  if (error && !interviewStarted) {
    const isCompleted = error.toLowerCase().includes('completed') || error.toLowerCase().includes('used');
    return (
      <CandidateShell header={
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>
          {isCompleted ? '✅ Interview Completed' : '⚠️ Access Restricted'}
        </div>
      }>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>{error}</p>
      </CandidateShell>
    );
  }

  /* ── Finished ── */
  if (interviewFinished) {
    return (
      <CandidateShell header={<div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>🎉 Interview Complete!</div>}>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
            Generating your personalised results report…
          </p>
          <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
        </div>
      </CandidateShell>
    );
  }

  /* ── Welcome screen ── */
  if (!interviewStarted) {
    return (
      <CandidateShell maxWidth="540px" header={
        <>
          <div style={{ color: '#fff', fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
            {jobTitle || 'Interview Session'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px' }}>
            {questions.length} questions · Speak or type your answers
          </div>
        </>
      }>
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎙️</div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Ready to begin?</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '24px' }}>
            Hello <strong style={{ color: 'var(--text-primary)' }}>{candidateName}</strong>, questions will be read aloud.
            You can speak your answer or type it below.
          </p>
          {!recognitionSupported && (
            <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>
              Speech recognition is not supported in this browser. You can type your answers instead.
            </div>
          )}
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px' }}
            onClick={handleStart} id="start-interview-btn">
            {currentIdx > 0 ? `Resume from Question ${currentIdx + 1}` : 'Start Interview →'}
          </button>
        </div>
      </CandidateShell>
    );
  }

  /* ── Active Interview ── */
  const currentQ = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <CandidateShell maxWidth="560px" header={
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
              HireFlow AI Interview
            </div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{jobTitle}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>{candidateName}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>Question {currentIdx + 1} of {questions.length}</div>
          </div>
        </div>
        {/* Progress bar inside header */}
        <div style={{ marginTop: '14px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'rgba(255,255,255,0.85)', borderRadius: '10px', transition: 'width 0.4s ease' }} />
        </div>
      </>
    }>

      {/* Category tags */}
      {(currentQ?.category || currentQ?.difficulty) && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {currentQ?.category && (
            <span className="badge badge-accent">{currentQ.category.charAt(0).toUpperCase() + currentQ.category.slice(1)}</span>
          )}
          {currentQ?.difficulty && (
            <span className="badge badge-neutral">{currentQ.difficulty.charAt(0).toUpperCase() + currentQ.difficulty.slice(1)}</span>
          )}
        </div>
      )}

      {/* Question box */}
      <div style={{
        background: 'var(--accent-50)',
        border: '0.5px solid var(--accent-100)',
        borderLeft: '3px solid var(--accent-400)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginBottom: '20px',
        lineHeight: 1.7, fontSize: '15px',
        color: '#1a1a2e',
        fontWeight: '500',
      }}>
        {currentQ?.question}
      </div>

      {answerError && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          {answerError}
        </div>
      )}

      {/* Mic section */}
      {!showTextInput && recognitionSupported && !micBlocked && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {/* Pulsing mic button */}
          <div style={{ position: 'relative' }}>
            {isListening && (
              <div style={{
                position: 'absolute', inset: '-8px',
                borderRadius: '50%',
                background: 'var(--accent-400)',
                opacity: 0.2,
                animation: 'hf-pulse 1.4s ease-in-out infinite',
              }} />
            )}
            <button
              id="mic-button"
              onClick={handleMicToggle}
              disabled={submitting}
              title={isListening ? 'Stop listening' : 'Start speaking'}
              style={{
                width: '72px', height: '72px', borderRadius: '50%', border: 'none',
                background: isListening ? '#dc2626' : 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isListening ? '0 4px 20px rgba(220,38,38,0.4)' : '0 4px 20px rgba(127,119,221,0.35)',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {isListening ? <IconMicOff /> : <IconMic />}
            </button>
          </div>

          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
            {isListening ? '🔴 Listening…' : submitting ? 'Evaluating…' : 'Tap to speak'}
          </span>

          {/* Transcript preview */}
          {transcript && (
            <div style={{
              background: 'var(--surface-1)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
              fontSize: '13px', color: 'var(--text-secondary)',
              lineHeight: 1.6, width: '100%', maxHeight: '120px', overflowY: 'auto',
              fontStyle: 'italic',
            }}>
              "{transcript}"
            </div>
          )}
        </div>
      )}

      {/* Blocked mic notice */}
      {micBlocked && (
        <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '0.5px solid var(--warning-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          Microphone blocked. Please allow mic access or type your answer below.
        </div>
      )}

      {/* Text input */}
      {showTextInput && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Your answer</label>
          <textarea
            className="input-field"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Type your answer here…"
            disabled={submitting}
            id="answer-textarea"
            style={{ minHeight: '110px', resize: 'vertical' }}
          />
        </div>
      )}

      {/* Done speaking button */}
      {(transcript.trim() || showTextInput) && !isListening && (
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', marginBottom: '12px' }}
          onClick={handleDoneSpeaking}
          disabled={submitting || !transcript.trim()}
          id="done-speaking-btn"
        >
          {submitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              Evaluating response…
            </span>
          ) : 'Done speaking →'}
        </button>
      )}

      {/* Toggle text/mic */}
      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
        {showTextInput ? (
          <span style={{ cursor: 'pointer', color: 'var(--accent-600)' }} onClick={() => setShowTextInput(false)}>
            Use microphone instead
          </span>
        ) : (
          <>Or <a href="#" style={{ color: 'var(--accent-600)' }} onClick={e => { e.preventDefault(); setShowTextInput(true); }} id="type-instead-link">type your answer instead</a></>
        )}
      </p>
    </CandidateShell>
  );
};

export default InterviewPage;
