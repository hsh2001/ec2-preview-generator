import { ec2 } from './ec2';

export async function terminateInstance(InstanceId: string): Promise<void> {
  await ec2.terminateInstances({
    InstanceIds: [InstanceId],
  });
}
