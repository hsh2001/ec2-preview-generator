import { ec2 } from './ec2';
import getInstanceName from './getInstanceName';

export async function createTagForInstance(InstanceId: string | undefined) {
  if (InstanceId) {
    await ec2.createTags({
      Resources: [InstanceId],
      Tags: [
        {
          Key: 'Name',
          Value: getInstanceName(+process.env.PR_NUMBER!),
        },
        {
          Key: 'PR_TARGET',
          Value: process.env.PR_NUMBER,
        },
      ],
    });
  }
}
