import assert from 'node:assert/strict';
import test from 'node:test';

import { assessChangedPaths, parseNameStatus } from './assess-merge-risk.mjs';

test('일반 기능 파일은 자동 병합 후보로 분류한다', () => {
  assert.deepEqual(assessChangedPaths(['src/filtering/contracts.ts']), {
    verdict: 'auto-merge-eligible',
    reasons: [],
    files: ['src/filtering/contracts.ts'],
  });
});

test('workflow와 정책 변경은 수동 확인 대상으로 분류한다', () => {
  const result = assessChangedPaths([
    '.github/workflows/ci.yml',
    '.ai/policies/review-automation.md',
  ]);

  assert.equal(result.verdict, 'manual-review-required');
  assert.match(result.reasons.join('\n'), /GitHub Actions workflow/);
  assert.match(result.reasons.join('\n'), /self-review·자동 병합 정책/);
});

test('실제 manifest 권한과 content script 범위 정의 위치를 차단한다', () => {
  const result = assessChangedPaths([
    'wxt.config.ts',
    'src/shared/sites.ts',
    'src/entrypoints/youtube.content.ts',
  ]);

  assert.equal(result.verdict, 'manual-review-required');
  assert.match(result.reasons.join('\n'), /Manifest 권한 설정/);
  assert.match(result.reasons.join('\n'), /content script host 범위/);
});

test('저장·인증·telemetry 경계는 수동 확인 대상으로 분류한다', () => {
  const result = assessChangedPaths([
    'src/storage/contracts.ts',
    'src/auth/session.ts',
    'src/shared/telemetry-client.ts',
  ]);

  assert.equal(result.verdict, 'manual-review-required');
  assert.match(result.reasons.join('\n'), /사용자 로컬 저장 정책/);
  assert.match(result.reasons.join('\n'), /민감 기능 경계/);
});

test('빈 목록과 해석할 수 없는 경로는 fail-closed로 처리한다', () => {
  assert.equal(assessChangedPaths([]).verdict, 'manual-review-required');
  assert.equal(assessChangedPaths(['../outside']).verdict, 'manual-review-required');
});

test('rename의 이전 경로와 새 경로를 모두 검사한다', () => {
  const changedPaths = parseNameStatus(
    'R100\0.github/workflows/ci.yml\0docs/archived-ci.yml\0',
  );

  assert.deepEqual(changedPaths, [
    '.github/workflows/ci.yml',
    'docs/archived-ci.yml',
  ]);
  assert.equal(assessChangedPaths(changedPaths).verdict, 'manual-review-required');
});

test('잘못된 Git 변경 목록 형식은 허용 결과로 바꾸지 않는다', () => {
  assert.throws(() => parseNameStatus('R100\0only-one-path\0'));
  assert.throws(() => parseNameStatus('unknown\0file.txt\0'));
});
