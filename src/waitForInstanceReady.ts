import { Instance } from '@aws-sdk/client-ec2';
import delay from 'delay';

import { ec2 } from './ec2';
import { fetchInstance } from './fetchInstance';

export async function waitForInstanceReady(instance: Instance) {
  for (;;) {
    await delay(1000);
    const { State } = (await fetchInstance(instance)) || {};

    if ('running' == State?.Name) {
      const isInitializingDone = await ec2
        .describeInstanceStatus({ InstanceIds: [instance.InstanceId!] })
        .then(
          ({ InstanceStatuses = [] }) =>
            InstanceStatuses[0]?.InstanceStatus?.Status != 'initializing'
        );

      if (isInitializingDone) {
        break;
      }
    }
  }
}
