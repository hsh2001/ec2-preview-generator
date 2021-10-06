import { Instance } from '@aws-sdk/client-ec2';

import { ec2 } from './ec2';

export async function fetchInstance({
  InstanceId,
}: {
  InstanceId?: string;
}): Promise<Instance | undefined> {
  if (!InstanceId) return;

  const describeInstanceResult = await ec2.describeInstances({
    InstanceIds: [InstanceId],
  });

  const [reservation] = describeInstanceResult?.Reservations || [];
  const [_instance] = reservation?.Instances || [];

  return _instance;
}
