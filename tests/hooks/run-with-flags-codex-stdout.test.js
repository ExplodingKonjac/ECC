/**
 * Codex stdout policy tests for scripts/hooks/run-with-flags.js.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RUNNER = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'run-with-flags.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-with-flags-codex-'));
}

function cleanup(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function writeHook(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    input: options.input || '{"tool_name":"Bash"}',
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: '',
      ECC_PLUGIN_ROOT: '',
      PLUGIN_ROOT: options.root || '',
      PLUGIN_DATA: options.pluginData || '',
      ECC_HOOK_STDOUT_MODE: 'codex',
      ...(options.env || {}),
    },
    cwd: options.cwd || process.cwd(),
    timeout: 10000,
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing run-with-flags.js Codex stdout policy ===\n');

  let passed = 0;
  let failed = 0;

  if (test('disabled hook emits empty stdout in Codex mode', () => {
    const result = run(['pre:example', 'scripts/hooks/noop.js', 'standard'], {
      input: '{"tool_name":"Bash","tool_input":{"command":"ls"}}',
      env: { ECC_DISABLED_HOOKS: 'pre:example' },
    });

    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(result.stdout, '');
  })) passed++; else failed++;

  if (test('run export with no output emits empty stdout in Codex mode', () => {
    const root = createTempDir();
    try {
      writeHook(root, path.join('scripts', 'hooks', 'noop.js'), `
module.exports = {
  run() {}
};
`);

      const result = run(['pre:noop', 'scripts/hooks/noop.js', 'standard'], {
        root,
        input: '{"tool_name":"Bash","tool_input":{"command":"ls"}}',
      });

      assert.strictEqual(result.status, 0, result.stderr);
      assert.strictEqual(result.stdout, '');
    } finally {
      cleanup(root);
    }
  })) passed++; else failed++;

  if (test('additionalContext remains valid Codex JSON stdout', () => {
    const root = createTempDir();
    try {
      writeHook(root, path.join('scripts', 'hooks', 'context.js'), `
module.exports = {
  run() {
    return { additionalContext: 'Review generated files before editing.' };
  }
};
`);

      const result = run(['pre:context', 'scripts/hooks/context.js', 'standard'], {
        root,
        input: '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git status"}}',
      });
      const parsed = JSON.parse(result.stdout);

      assert.strictEqual(result.status, 0, result.stderr);
      assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
      assert.ok(parsed.hookSpecificOutput.additionalContext.includes('generated files'));
    } finally {
      cleanup(root);
    }
  })) passed++; else failed++;

  if (test('legacy spawned hook with no stdout emits empty stdout in Codex mode', () => {
    const root = createTempDir();
    try {
      writeHook(root, path.join('scripts', 'hooks', 'legacy-silent.js'), 'process.exit(0);\n');

      const result = run(['post:legacy', 'scripts/hooks/legacy-silent.js', 'standard'], {
        root,
        input: '{"tool_name":"Bash","tool_response":{"output":"ok"}}',
      });

      assert.strictEqual(result.status, 0, result.stderr);
      assert.strictEqual(result.stdout, '');
    } finally {
      cleanup(root);
    }
  })) passed++; else failed++;

  if (test('blocking legacy hook preserves exit 2 and stderr reason without raw stdout', () => {
    const root = createTempDir();
    try {
      writeHook(root, path.join('scripts', 'hooks', 'legacy-block.js'), `
process.stderr.write('blocked by policy\\n');
process.exit(2);
`);

      const result = run(['pre:block', 'scripts/hooks/legacy-block.js', 'standard'], {
        root,
        input: '{"tool_name":"Bash","tool_input":{"command":"rm -rf dist"}}',
      });

      assert.strictEqual(result.status, 2);
      assert.strictEqual(result.stdout, '');
      assert.strictEqual(result.stderr, 'blocked by policy\n');
    } finally {
      cleanup(root);
    }
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
