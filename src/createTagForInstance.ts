import { ec2 } from './ec2';
import { instanceName } from './main';

export async function createTagForInstance(InstanceId: string | undefined) {
  if (InstanceId) {
    await ec2.createTags({
      Resources: [InstanceId],
      Tags: [
        {
          Key: 'Name',
          Value: instanceName,
        },
        {
          Key: 'PR_TARGET',
          Value: process.env.PR_NUMBER,
        },
      ],
    });
  }
}
