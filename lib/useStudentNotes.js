import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'mnm-student-notes';

export function useStudentNotes(topic) {
  const [notes, setNotes] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

  const debounceRef = useRef(null);
  const statusTimerRef = useRef(null);
  // stateRef keeps the latest topic + notes so the debounced callback can access them
  // without stale-closure issues
  const stateRef = useRef({ topic, notes: {} });
  stateRef.current.topic = topic;

  // Load notes whenever topic changes; also cancel any in-flight save for the old topic
  useEffect(() => {
    clearTimeout(debounceRef.current);
    setSaveStatus('idle');
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const loaded = stored[topic || '__draft__'] || {};
      stateRef.current.notes = loaded;
      setNotes(loaded);
    } catch {
      stateRef.current.notes = {};
      setNotes({});
    }
  }, [topic]);

  const updateNote = useCallback((field, value) => {
    setNotes(prev => {
      const updated = { ...prev, [field]: value };
      stateRef.current.notes = updated;

      clearTimeout(debounceRef.current);
      setSaveStatus('saving');

      debounceRef.current = setTimeout(() => {
        try {
          const key = stateRef.current.topic || '__draft__';
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          stored[key] = stateRef.current.notes;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

          setSaveStatus('saved');
          clearTimeout(statusTimerRef.current);
          statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
        } catch {
          setSaveStatus('idle');
        }
      }, 700);

      return updated;
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    clearTimeout(statusTimerRef.current);
  }, []);

  return { notes, updateNote, saveStatus };
}
