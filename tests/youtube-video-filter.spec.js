const { test, expect } = require('@playwright/test');
const { filterVideosForStudents } = require('../lib/youtubeVideoFilter');
const {
  buildVideoSearchQueries,
  buildYoutubeSearchPlan,
} = require('../pages/api/recommended-videos');

function makeVideo(overrides) {
  return {
    videoId: 'video-id',
    title: '교육 영상',
    channelTitle: '승인 교육 채널',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/video-id/mqdefault.jpg',
    approvedChannelId: 'UC-approved-channel',
    durationSeconds: 300,
    viewCount: 10000,
    ...overrides,
  };
}

test.describe('YouTube 승인 영상 주제 관련성 필터', () => {
  test('강화 고인돌에서는 장소명·동사 강화만 겹치는 영상을 제외한다', () => {
    const videos = [
      makeVideo({
        videoId: 'ganghwa-field-trip',
        title: '[교원 답사] 강화도 포함외교와 개항',
        description: '강화도 초지진과 개항의 현장을 걷는 역사 답사 영상',
      }),
      makeVideo({
        videoId: 'student-record-guide',
        title: '2026학년도 학교생활기록부 기재요령',
        description: '학교생활기록부 작성 역량을 강화할 수 있도록 만든 안내 영상',
      }),
      makeVideo({
        videoId: 'dolmen-guide',
        title: '강화 고인돌과 지석묘 알아보기',
        description: '청동기시대 고인돌의 구조와 강화 고인돌 유적을 설명하는 교육 영상',
      }),
    ];

    const result = filterVideosForStudents(videos, '강화 고인돌');

    expect(result.map(video => video.videoId)).toEqual(['dolmen-guide']);
  });

  test('실시간 YouTube 검색 계획은 요청당 최대 3회로 제한한다', () => {
    const channels = Array.from({ length: 8 }, (_, index) => ({
      name: `승인 채널 ${index + 1}`,
      channelId: `UC-approved-${index + 1}`,
    }));
    const queries = ['고인돌', '지석묘', '선사시대 고인돌', '강화 고인돌'];

    const plan = buildYoutubeSearchPlan(channels, queries);

    expect(plan).toHaveLength(3);
    expect(plan.map(item => item.query)).toEqual(['고인돌', '고인돌', '고인돌']);
    expect(plan.map(item => item.channel.channelId)).toEqual([
      'UC-approved-1',
      'UC-approved-2',
      'UC-approved-3',
    ]);
  });

  test('강화가 지명으로만 쓰인 주제를 고인돌 검색으로 바꾸지 않는다', () => {
    const nonDolmenTopics = [
      '강화 고려궁지',
      '강화 장정리 석조여래입상',
    ];

    nonDolmenTopics.forEach(topic => {
      const queries = buildVideoSearchQueries(topic);

      expect(queries[0]).toBe(topic);
      expect(queries.some(query => /고인돌|지석묘/.test(query))).toBe(false);
    });
  });

  test('실제 고인돌 주제와 다른 지역사 주제는 각각의 검색어를 유지한다', () => {
    expect(buildVideoSearchQueries('강화 고인돌')[0]).toBe('고인돌');
    expect(buildVideoSearchQueries('제물포구락부')[0]).toBe('제물포구락부');
  });

  test('넓은 지역명만 같은 영상은 핵심 조사 대상이 다르면 제외한다', () => {
    const videos = [
      makeVideo({
        videoId: 'incheon-chinatown',
        title: '인천 차이나타운의 역사와 문화',
        description: '인천의 대표 관광지 차이나타운을 소개하는 교육 영상',
      }),
      makeVideo({
        videoId: 'jemulpo-club',
        title: '인천 제물포구락부를 만나다',
        description: '개항기 제물포구락부의 역사와 건축을 설명하는 영상',
      }),
    ];

    const result = filterVideosForStudents(videos, '인천 제물포구락부');

    expect(result.map(video => video.videoId)).toEqual(['jemulpo-club']);
  });

  test('강화 지역 안에서도 세부 문화유산 명칭이 다른 영상은 제외한다', () => {
    const videos = [
      makeVideo({
        videoId: 'ganghwa-jangjeongri',
        title: '강화 장정리 마을의 역사 유적',
        description: '장정리에서 만나는 강화도의 여러 문화유산을 소개합니다',
      }),
      makeVideo({
        videoId: 'stone-buddha',
        title: '강화 장정리 석조여래입상',
        description: '장정리 석조여래입상의 모습과 역사적 특징을 알아봅니다',
      }),
    ];

    const result = filterVideosForStudents(videos, '강화 장정리 석조여래입상');

    expect(result.map(video => video.videoId)).toEqual(['stone-buddha']);
  });

  test('세계문화유산이라는 표현만으로 고인돌 핵심어를 요구하지 않는다', () => {
    const videos = [
      makeVideo({
        videoId: 'suwon-hwaseong',
        title: '세계문화유산 수원 화성 알아보기',
        description: '수원 화성의 축성 과정과 역사적 가치를 설명합니다',
      }),
    ];

    const result = filterVideosForStudents(videos, '수원 화성 세계문화유산');

    expect(result.map(video => video.videoId)).toEqual(['suwon-hwaseong']);
  });
});
