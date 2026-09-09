import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MANUAL_REVIEW_EXACT_PATHS = new Map([
  ['AGENTS.md', 'Codex 작업·병합 규칙'],
  ['.github/pull_request_template.md', 'PR 검증·병합 정책'],
  ['.ai/policies/verification.md', '검증·병합 정책'],
  ['.ai/policies/review-automation.md', 'self-review·자동 병합 정책'],
  ['package.json', '검증 명령 또는 의존성'],
  ['package-lock.json', '의존성 잠금'],
  ['wxt.config.ts', 'Manifest 권한 설정'],
  ['src/shared/sites.ts', 'content script host 범위'],
  ['scripts/assess-merge-risk.mjs', '위험 판정기 자체'],
  ['scripts/assess-merge-risk.test.mjs', '위험 판정기 검증'],
]);

const MANUAL_REVIEW_PREFIXES = [
  ['.github/workflows/', 'GitHub Actions workflow'],
  ['.github/actions/', 'GitHub Actions 구성 요소'],
  ['src/storage/', '사용자 로컬 저장 정책'],
];

const MANUAL_REVIEW_PATH_PATTERNS = [
  [/^src\/entrypoints\/[^/]+\.content\.[cm]?[jt]sx?$/, 'content script host 범위'],
  [/^src\/entrypoints\/background\.[cm]?[jt]s$/, 'background 실행·외부 통신 경계'],
  [/(^|\/)(auth|account|analytics|telemetry|payment|billing|donation)(\/|\.|-)/i, '민감 기능 경계'],
];

function normalizeRepositoryPath(filePath) {
  const normalized = filePath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return null;
  }

  return normalized;
}

export function assessChangedPaths(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return {
      verdict: 'manual-review-required',
      reasons: ['변경 파일 목록이 비어 있거나 확인되지 않음'],
      files: [],
    };
  }

  const normalizedPaths = [];
  const reasons = new Set();

  for (const filePath of filePaths) {
    if (typeof filePath !== 'string') {
      reasons.add('변경 파일 경로 형식을 해석할 수 없음');
      continue;
    }

    const normalizedPath = normalizeRepositoryPath(filePath);
    if (normalizedPath === null) {
      reasons.add('변경 파일 경로 형식을 해석할 수 없음');
      continue;
    }

    normalizedPaths.push(normalizedPath);

    const exactReason = MANUAL_REVIEW_EXACT_PATHS.get(normalizedPath);
    if (exactReason !== undefined) {
      reasons.add(`${normalizedPath}: ${exactReason}`);
    }

    for (const [prefix, reason] of MANUAL_REVIEW_PREFIXES) {
      if (normalizedPath.startsWith(prefix)) {
        reasons.add(`${normalizedPath}: ${reason}`);
      }
    }

    for (const [pattern, reason] of MANUAL_REVIEW_PATH_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        reasons.add(`${normalizedPath}: ${reason}`);
      }
    }
  }

  return {
    verdict: reasons.size === 0 ? 'auto-merge-eligible' : 'manual-review-required',
    reasons: [...reasons],
    files: [...new Set(normalizedPaths)].sort(),
  };
}

function verifyCommitReference(reference) {
  const result = spawnSync('git', ['rev-parse', '--verify', `${reference}^{commit}`], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`Git 참조를 확인할 수 없습니다: ${reference}`);
  }
}

export function parseNameStatus(output) {
  const tokens = output.split('\0');
  if (tokens.at(-1) === '') {
    tokens.pop();
  }

  const paths = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index];
    index += 1;
    if (status === undefined || !/^[A-Z][0-9]*$/.test(status)) {
      throw new Error('Git 변경 상태를 해석할 수 없습니다.');
    }

    const pathCount = /^[RC]/.test(status) ? 2 : 1;
    for (let offset = 0; offset < pathCount; offset += 1) {
      const filePath = tokens[index];
      index += 1;
      if (filePath === undefined || filePath.length === 0) {
        throw new Error('Git 변경 경로를 해석할 수 없습니다.');
      }
      paths.push(filePath);
    }
  }

  return paths;
}

function readChangedPaths(baseReference, headReference) {
  verifyCommitReference(baseReference);
  verifyCommitReference(headReference);

  const result = spawnSync(
    'git',
    [
      'diff',
      '--name-status',
      '--find-renames',
      '-z',
      `${baseReference}...${headReference}`,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || '변경 파일 목록을 읽지 못했습니다.');
  }

  return parseNameStatus(result.stdout);
}

function runCli() {
  const [baseReference, headReference = 'HEAD', ...unexpectedArguments] = process.argv.slice(2);
  if (baseReference === undefined || unexpectedArguments.length > 0) {
    throw new Error(
      '사용법: node scripts/assess-merge-risk.mjs <base-ref> [head-ref]',
    );
  }

  const result = assessChangedPaths(readChangedPaths(baseReference, headReference));
  process.stdout.write(`${JSON.stringify({ baseReference, headReference, ...result }, null, 2)}\n`);

  if (result.verdict !== 'auto-merge-eligible') {
    process.exitCode = 2;
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`manual-review-required: ${message}\n`);
    process.exitCode = 1;
  }
}
