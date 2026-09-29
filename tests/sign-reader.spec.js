const { test, expect } = require('@playwright/test');

// 브라우저 컨텍스트 안에서 canvas로 PNG를 직접 그려 테스트용 이미지 버퍼를 만든다.
// (디스크의 고정 픽스처 파일이 없어도 되고, 큰 이미지/작은 이미지를 자유롭게 만들 수 있다)
async function makeTestImageBuffer(page, { width, height, color = '#1a3fa8' }) {
  const dataUrl = await page.evaluate(({ width, height, color }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
  }, { width, height, color });

  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

async function openPermissionNotice(page) {
  await page.getByTestId('sign-reader-button').click();
  await expect(page.getByTestId('sign-reader-permission-notice')).toBeVisible();
}

async function acceptPermissionAndGetFileChooser(page) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('sign-reader-permission-agree').click();
  return chooserPromise;
}

test.describe('뭐냐면 — 안내판 사진에서 글자 읽기', () => {
  test('[sign-reader] 기존 텍스트 직접 입력은 그대로 동작한다', async ({ page }) => {
    await page.goto('/');
    const sourceTextarea = page.getByTestId('source-textarea');
    await sourceTextarea.fill('직접 입력한 조사자료 내용입니다.');
    await expect(sourceTextarea).toHaveValue('직접 입력한 조사자료 내용입니다.');
  });

  test('[sign-reader] 사진 접근 전에 선택적 접근권한 항목·목적·거부 가능성을 안내한다', async ({ page }) => {
    await page.goto('/');
    await openPermissionNotice(page);
    const modal = page.getByTestId('sign-reader-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('선택적 접근권한');
    await expect(modal).toContainText('카메라 및 사진');
    await expect(modal).toContainText('전시 안내판을 촬영하거나 기기에 저장된 사진을 선택');
    await expect(modal).toContainText('동의하지 않아도 조사자료를 직접 입력');
  });

  test('[sign-reader] 접근권한에 동의하지 않아도 조사자료를 직접 입력할 수 있다', async ({ page }) => {
    await page.goto('/');
    await openPermissionNotice(page);
    await page.getByTestId('sign-reader-permission-decline').click();
    await expect(page.getByTestId('sign-reader-modal')).toBeHidden();

    const sourceTextarea = page.getByTestId('source-textarea');
    await sourceTextarea.fill('권한 없이 직접 입력한 조사자료입니다.');
    await expect(sourceTextarea).toHaveValue('권한 없이 직접 입력한 조사자료입니다.');
  });

  test('[sign-reader] 잘못된 파일 형식은 차단된다', async ({ page }) => {
    await page.goto('/');
    await openPermissionNotice(page);
    const fileChooser = await acceptPermissionAndGetFileChooser(page);

    await fileChooser.setFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('이것은 이미지가 아닙니다'),
    });

    await expect(page.getByTestId('sign-reader-error')).toBeVisible();
    await expect(page.getByTestId('sign-reader-extract-button')).toBeDisabled();
  });

  test('[sign-reader] 큰 이미지를 올리면 1280px 이하로 리사이즈되어 서버로 전송된다', async ({ page }) => {
    await page.goto('/');

    let sentImageDataUrl = '';
    await page.route('**/api/extract-sign-text', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      sentImageDataUrl = body.image || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: '추출된 안내판 원문입니다.', warnings: [] }),
      });
    });

    await openPermissionNotice(page);
    const bigImage = await makeTestImageBuffer(page, { width: 2400, height: 1800 });
    const fileChooser = await acceptPermissionAndGetFileChooser(page);
    await fileChooser.setFiles({
      name: 'big-sign.png',
      mimeType: 'image/png',
      buffer: bigImage,
    });

    await page.getByTestId('sign-reader-extract-button').click();
    await expect(page.getByTestId('sign-reader-success')).toBeVisible();

    expect(sentImageDataUrl).toMatch(/^data:image\/jpeg;base64,/);

    const dims = await page.evaluate((dataUrl) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    }), sentImageDataUrl);

    expect(Math.max(dims.width, dims.height)).toBeLessThanOrEqual(1280);
  });

  test('[sign-reader] 추출 성공 시 텍스트가 조사자료 입력창에 자동으로 들어간다', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/extract-sign-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: '추출된 안내판 원문입니다.', warnings: ['사진이 흐려 일부 문장이 부정확할 수 있습니다.'] }),
      });
    });

    await openPermissionNotice(page);
    const smallImage = await makeTestImageBuffer(page, { width: 400, height: 300 });
    const fileChooser = await acceptPermissionAndGetFileChooser(page);
    await fileChooser.setFiles({
      name: 'sign.png',
      mimeType: 'image/png',
      buffer: smallImage,
    });

    await page.getByTestId('sign-reader-extract-button').click();
    await expect(page.getByTestId('sign-reader-success')).toBeVisible();
    await expect(page.getByTestId('sign-reader-success')).toContainText('사진이 흐려 일부 문장이 부정확할 수 있습니다.');

    // 모달 닫기 — 추출된 텍스트가 입력창에 남아 있는지 확인
    await page.getByTestId('sign-reader-success').getByRole('button').click();
    await expect(page.getByTestId('source-textarea')).toHaveValue('추출된 안내판 원문입니다.');
  });

  test('[sign-reader] 추출 실패 시 에러 메시지가 보이고 다시 시도할 수 있다', async ({ page }) => {
    await page.goto('/');

    await page.route('**/api/extract-sign-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: '사진에서 글자를 읽지 못했습니다. 더 밝고 정면에 가까운 사진으로 다시 시도해 주세요.' }),
      });
    });

    await openPermissionNotice(page);
    const img = await makeTestImageBuffer(page, { width: 400, height: 300 });
    const fileChooser = await acceptPermissionAndGetFileChooser(page);
    await fileChooser.setFiles({
      name: 'sign.png',
      mimeType: 'image/png',
      buffer: img,
    });

    await page.getByTestId('sign-reader-extract-button').click();
    await expect(page.getByTestId('sign-reader-error')).toBeVisible();
    await expect(page.getByTestId('sign-reader-error')).toContainText('더 밝고 정면에 가까운 사진으로 다시 시도해 주세요');

    // 다시 시도 가능 — 버튼이 다시 활성 상태
    await expect(page.getByTestId('sign-reader-extract-button')).toBeEnabled();
  });
});
