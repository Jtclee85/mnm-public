// 이해모드 결과(analysisByMode.understand)에서 왼쪽 '쉬운설명' 참고 패널에
// 필요한 세 섹션만 골라낸다. 이해모드 결과는 이미 태그 기반으로 파싱된 구조화
// 객체이므로(각 필드가 markdown 헤딩이 아니라 최종 텍스트) 필드를 그대로 옮기고,
// 세 필드가 모두 비어 있는 경우에만 hasContent를 false로 표시해 빈 화면 대신
// 안내 문구를 보여줄 수 있게 한다.
export function extractEasyExplanationSections(understandResult) {
  const oneSentence = understandResult?.understandingSentence || '';
  const easyFullText = understandResult?.easy || '';
  const glossaryText = understandResult?.understandingVocabulary || '';
  const glossaryFallbackLines = understandResult?.vocabularyLines || [];

  const hasContent = !!(
    oneSentence || easyFullText || glossaryText || glossaryFallbackLines.length > 0
  );

  return { oneSentence, easyFullText, glossaryText, glossaryFallbackLines, hasContent };
}
