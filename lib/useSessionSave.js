import { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_KEY = 'mnm-sessions';
const NOTES_KEY   = 'mnm-student-notes';

export function useSessionSave() {
  const [savedTopics, setSavedTopics] = useState([]);
  const debounceRef   = useRef(null);
  const statusTimerRef = useRef(null);

  const refreshTopicList = useCallback(() => {
    try {
      const sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      const list = Object.values(sessions)
        .filter(s => s.topic?.trim())
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(s => ({ topic: s.topic, updatedAt: s.updatedAt }));
      setSavedTopics(list);
    } catch {
      setSavedTopics([]);
    }
  }, []);

  useEffect(() => { refreshTopicList(); }, [refreshTopicList]);

  // debounce 1500ms — 조사자료/채팅처럼 큰 데이터를 너무 자주 쓰지 않도록
  const triggerSave = useCallback((data) => {
    if (!data.topic?.trim()) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
        sessions[data.topic] = { ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
        refreshTopicList();
      } catch {}
    }, 1500);
  }, [refreshTopicList]);

  // 세션 불러오기: notes를 mnm-student-notes에도 동기화해
  // useStudentNotes가 topic 변경 시 자동으로 최신 notes를 읽어가도록
  const loadSession = useCallback((topic) => {
    try {
      const sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      const session = sessions[topic];
      if (!session) return null;

      if (session.notes) {
        const stored = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
        stored[topic] = session.notes;
        localStorage.setItem(NOTES_KEY, JSON.stringify(stored));
      }
      return session;
    } catch {
      return null;
    }
  }, []);

  const deleteSession = useCallback((topic) => {
    try {
      clearTimeout(debounceRef.current);
      const sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      delete sessions[topic];
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));

      const storedNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
      delete storedNotes[topic];
      localStorage.setItem(NOTES_KEY, JSON.stringify(storedNotes));

      refreshTopicList();
    } catch {}
  }, [refreshTopicList]);

  // 현재 세션을 즉시(동기) 저장 — 다른 세션 불러오기 직전에 사용
  const saveNow = useCallback((data) => {
    if (!data.topic?.trim()) return;
    clearTimeout(debounceRef.current);
    try {
      const sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      sessions[data.topic] = { ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
      refreshTopicList();
    } catch {}
  }, [refreshTopicList]);

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    clearTimeout(statusTimerRef.current);
  }, []);

  return { savedTopics, triggerSave, saveNow, loadSession, deleteSession };
}
