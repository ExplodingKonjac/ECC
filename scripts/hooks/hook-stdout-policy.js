'use strict';

function getHookStdoutMode(env = process.env) {
  const override = String(env.ECC_HOOK_STDOUT_MODE || '').trim().toLowerCase();
  if (override === 'codex' || override === 'silent') {
    return 'codex';
  }
  if (override === 'passthrough' || override === 'claude') {
    return 'passthrough';
  }
  if (env.PLUGIN_ROOT || env.PLUGIN_DATA) {
    return 'codex';
  }
  return 'passthrough';
}

function isCodexStdoutMode(env = process.env) {
  return getHookStdoutMode(env) === 'codex';
}

function passthroughStdout(raw, env = process.env) {
  return isCodexStdoutMode(env) ? '' : raw;
}

function defaultSuccessStdout(raw, env = process.env) {
  return passthroughStdout(raw, env);
}

module.exports = {
  defaultSuccessStdout,
  getHookStdoutMode,
  isCodexStdoutMode,
  passthroughStdout,
};
