import { Instance } from '@aws-sdk/client-ec2';

import { fetchInstance } from './fetchInstance';

export async function getPublicIpAddressOfInstance(
  instance: Instance
): Promise<string | undefined> {
  const newInstance = await fetchInstance(instance);
  newInstance?.PublicIpAddress;
  return newInstance?.PublicIpAddress;
}
