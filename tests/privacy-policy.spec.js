const { test, expect } = require('@playwright/test');
const { LANGUAGE_OPTIONS, PRIVACY_POLICY_LINK_LABELS } = require('../lib/i18n');

test('학생 하단 링크는 새 탭으로 방침을 열고 작성 중인 자료를 유지한다', async ({ page, context }) => {
  await page.goto('/');
  await page.getByTestId('topic-input').fill('문화유산 조사');
  await page.getByTestId('source-textarea').fill('읽던 자료를 그대로 보관합니다.');
  const link = page.getByTestId('privacy-policy-link');
  await expect(link).toHaveText('개인정보 처리방침');
  await expect(link).toHaveAttribute('href', '/privacy');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
  const newPagePromise = context.waitForEvent('page');
  await link.click();
  const policy = await newPagePromise;
  await expect(policy.getByRole('heading', { level: 1 })).toHaveText('뭐냐면 개인정보처리방침');
  await expect(page.getByTestId('topic-input')).toHaveValue('문화유산 조사');
  await expect(page.getByTestId('source-textarea')).toHaveValue('읽던 자료를 그대로 보관합니다.');
  await policy.close();
});

test('교사 하단 링크는 공급자 선택과 학교 입력을 유지한다', async ({ page, context }) => {
  await page.goto('/teacher');
  await page.getByTestId('teacher-provider').selectOption('openai');
  await page.getByTestId('teacher-school-input').fill('테스트초');
  const newPagePromise = context.waitForEvent('page');
  await page.getByTestId('privacy-policy-link').click();
  const policy = await newPagePromise;
  await expect(policy.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('teacher-provider')).toHaveValue('openai');
  await expect(page.getByTestId('teacher-school-input')).toHaveValue('테스트초');
  await policy.close();
});

test('본문 12개 조항과 표를 표시하고 작성 메모만 제외한다', async ({ page }) => {
  await page.goto('/privacy');
  const article = page.getByTestId('privacy-policy-content');
  await expect(article.getByRole('heading', { level: 2 })).toHaveCount(12);
  await expect(article.getByRole('table').getByRole('columnheader')).toHaveCount(3);
  await expect(article.getByRole('table').getByRole('row')).toHaveCount(10);
  await expect(article).not.toContainText('작성 기준:');
  await expect(article).toContainText('[확정된 개인정보 처리의 법적 근거]');
  await expect(article).toContainText('[확정된 운영 로그 내역]');
  await expect(article).toContainText('공고일: 2026. 11. 1.');
  await expect(article).toContainText('시행일: 2026. 11. 1.');
  await expect(page.getByRole('link', { name: '← 학생 화면으로' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: '교사용 설정으로 →' })).toHaveAttribute('href', '/teacher');
});

test('학생 언어를 바꾸면 하단 링크도 해당 언어로 바뀌고 한국어 본문임을 안내한다', async ({ page }) => {
  await page.goto('/');
  for (const language of LANGUAGE_OPTIONS) {
    await page.locator('select').first().selectOption(language.code);
    await expect(page.getByTestId('privacy-policy-link')).toHaveText(PRIVACY_POLICY_LINK_LABELS[language.code]);
    await expect(page.getByTestId('privacy-policy-link')).toHaveAttribute('hreflang', 'ko');
  }
});

for (const width of [390, 1920]) {
  test(`화면 폭 ${width}px에서 방침 표만 가로 스크롤되고 본문은 화면을 넘지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto('/privacy');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const region = page.getByRole('region', { name: '처리 목적과 항목' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toBeVisible();
  });
}

test('오프라인 데모에는 공개용 방침 링크를 넣지 않는다', async ({ page }) => {
  await page.goto('/offline-demo');
  await expect(page.getByTestId('privacy-footer')).toHaveCount(0);
});
