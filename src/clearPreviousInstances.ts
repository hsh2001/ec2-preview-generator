import { ec2 } from './ec2';
import { octokit, prInfo } from './octokit';
import { terminateInstance } from './terminateInstance';

export async function clearPreviousInstances() {
  const { Reservations = [] } = await ec2.describeInstances({
    Filters: [{ Name: 'tag:PR_TARGET', Values: [process.env.PR_NUMBER!] }],
  });

  const comments = await octokit.issues.listComments(prInfo);

  for (const { Instances = [] } of Reservations) {
    for (const { InstanceId, State, PublicIpAddress } of Instances) {
      if (State?.Name != 'terminated') {
        console.log(`이전의 인스턴스 종료중... ${InstanceId}`);
        InstanceId && (await terminateInstance(InstanceId));

        if (PublicIpAddress) {
          comments.data
            .filter((comment) => comment?.body?.includes(PublicIpAddress))
            .map(async ({ id }) => {
              await octokit.issues.updateComment({
                ...prInfo,
                comment_id: id,
                body: '-',
              });

              await octokit.issues.deleteComment({
                ...prInfo,
                comment_id: id,
              });
            });
        }
      }
    }
  }
}
