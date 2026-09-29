const { test, expect } = require('@playwright/test');
const { isDirectTopicQuestion } = require('../lib/chatRelevance');

test.describe('후속 질문 주제 관련성 빠른 판정', () => {
  test('조사 주제의 구체적인 핵심어를 직접 물으면 관련 질문으로 인정한다', () => {
    expect(isDirectTopicQuestion('강화 고인돌', '고인돌은 어떻게 만들어?')).toBe(true);
    expect(isDirectTopicQuestion('세종대왕과 훈민정음', '훈민정음은 왜 만들었나요?')).toBe(true);
  });

  test('주제 단어를 끼워 넣은 아이돌·게임 질문은 자동 허용하지 않는다', () => {
    expect(isDirectTopicQuestion('강화 고인돌', '유명한 걸그룹이 고인돌에 가봤다는데 알아?')).toBe(false);
    expect(isDirectTopicQuestion('강화 고인돌', '고인돌이 나오는 게임 추천해 줘')).toBe(false);
  });

  test('모호한 장소명이나 무관한 질문만 겹치면 자동 허용하지 않는다', () => {
    expect(isDirectTopicQuestion('강화 고인돌', '공부 역량을 강화하는 방법은?')).toBe(false);
    expect(isDirectTopicQuestion('강화 고인돌', '오늘 날씨는 어때?')).toBe(false);
  });
});
