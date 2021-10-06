import assert from 'assert';

function assertEnvProvided(
  env: Record<string, string | undefined>
): asserts env is Record<string, string> {
  for (const key in env) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      const value = env[key];
      assert(
        typeof value == 'string' && value.length != 0,
        `환경변수 ${key}가 없습니다.`
      );
    }
  }
}

export default assertEnvProvided;
