import assert from 'assert';

import { WebClient as SlackClient } from '@slack/web-api';

import assertEnvProvided from '../assertEnvProvided';
import { clearPreviousInstances } from '../clearPreviousInstances';
import { createTagForInstance } from '../createTagForInstance';
import { ec2 } from '../ec2';
import getInstanceName from '../getInstanceName';
import { getPublicIpAddressOfInstance } from '../getPublicIpAddressOfInstance';
import { octokit, prInfo } from '../octokit';
import { runCommandOnEC2 } from '../runCommandOnEC2';
import { terminateInstance } from '../terminateInstance';
import { waitForInstanceReady } from '../waitForInstanceReady';

const {
  PR_NUMBER = '',
  GITHUB_TOKEN = '',
  AWS_ACCESS_KEY_ID = '',
  AWS_SECRET_ACCESS_KEY = '',
  AWS_SSH_KEY = '',
  AWS_SSH_KEY_NAME = '',
  EC2_IMAGE = 'ami-0ba5cd124d7a79612',
  GIT_REF = '',
  GIT_OWNER = '',
  GIT_REPO = '',
  SLACK_TOKEN,
  SLACK_CHANNEL,
  AWS_REGION = '',
  INSTANCE_TYPE = 't2.small',
  SECURITY_GROUP_IDS = '',
} = process.env;

assert(
  isFinite(+PR_NUMBER) && 0 < +PR_NUMBER && Number.isInteger(+PR_NUMBER),
  '환경변수 PR_NUMBER는 0보다 큰 정수이여야 합니다.'
);

assertEnvProvided({
  GITHUB_TOKEN,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SSH_KEY,
  GIT_REF,
  GIT_OWNER,
  GIT_REPO,
  AWS_REGION,
  AWS_SSH_KEY_NAME,
  SECURITY_GROUP_IDS,
});

export const instanceName = getInstanceName(+PR_NUMBER);

const slack = SLACK_TOKEN && new SlackClient(SLACK_TOKEN);

(async () => {
  await clearPreviousInstances();

  const labels = await octokit.issues.listLabelsOnIssue(prInfo);

  if (!labels.data.find(({ name }) => name == 'need-test-server')) {
    console.log('"need-test-server" 라벨이 존재하지 않음. 스크립트 종료!');
    return;
  }

  let instanceId = '';
  try {
    console.log('인스턴스 생성중...');
    const { Instances: [instance] = [] } = await ec2.runInstances({
      ImageId: EC2_IMAGE,
      InstanceType: INSTANCE_TYPE,
      KeyName: AWS_SSH_KEY_NAME,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: SECURITY_GROUP_IDS.split(',')
        .map((s) => s.trim())
        .filter((s) => s),
    });

    const { InstanceId } = instance || {};
    console.log('인스턴스 생성완료!...');

    instanceId = InstanceId!;
    await createTagForInstance(InstanceId);
    console.log(`인스턴스 상태 대기중...`);
    await waitForInstanceReady(instance);
    const ip = await getPublicIpAddressOfInstance(instance);

    assert(
      typeof ip == 'string',
      '생성한 인스턴스의 퍼블릭 IP 주소를 가져오는 데 실패했습니다.'
    );

    await runCommandOnEC2(ip);

    const text = `http://${ip}\n테스트 서버가 준비되었습니다.`;
    octokit.issues.createComment({
      ...prInfo,
      body: text,
    });

    slack &&
      SLACK_CHANNEL &&
      slack.chat.postMessage({
        text,
        channel: SLACK_CHANNEL,
      });
  } catch (error) {
    await octokit.issues.createComment({
      ...prInfo,
      body: `테스트 서버 준비중 에러 발생!\n${error}`,
    });

    instanceId && (await terminateInstance(instanceId));
    throw error;
  }
})();
