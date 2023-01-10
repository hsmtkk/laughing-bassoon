// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import { Construct } from "constructs";
import { App, TerraformStack, CloudBackend, NamedCloudWorkspace } from "cdktf";
import * as google from '@cdktf/provider-google';

const project = 'laughing-bassoon';
const region = 'us-west1';
const zone = 'us-west1-c';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new google.provider.GoogleProvider(this, 'google', {
      project,
      region,
      zone,
    });

    new google.computeInstance.ComputeInstance(this, 'utilInstance', {
      allowStoppingForUpdate: true,
      bootDisk: {
        initializeParams: {
          image: 'debian-cloud/debian-11',
        },
      },
      name: 'util',
      networkInterface: [{
        network: 'default',
        accessConfig: [{}],
      }],
      machineType: 'e2-small',
      scheduling: {
        automaticRestart: false,
        preemptible: true,
        provisioningModel: 'SPOT',
      },
    });

    const vpc = new google.computeNetwork.ComputeNetwork(this, 'vpc', {
      autoCreateSubnetworks: false,
      name: 'kubernetes-the-hard-way',      
    });

    const subnet = new google.computeSubnetwork.ComputeSubnetwork(this, 'subnet', {
      ipCidrRange: '10.240.0.0/24',
      name: 'kubernetes',
      network: vpc.id,
    });

    new google.computeFirewall.ComputeFirewall(this, 'allowInternal', {
      allow: [{protocol: 'tcp'}, {protocol:'udp'}, {protocol: 'icmp'}],
      name: 'kubernetes-the-hard-way-allow-internal',
      network: vpc.name,
      sourceRanges: ['10.240.0.0/24', '10.200.0.0/16'],
    });

    new google.computeFirewall.ComputeFirewall(this, 'allowExternal', {
      allow: [{
        protocol: 'tcp',
        ports: ['22'],
      },
      {
        protocol: 'tcp',
        ports: ['6443'],
      },
      {
        protocol: 'icmp',
      }],
      name: 'kubernetes-the-hard-way-allow-external',
      network: vpc.name,
      sourceRanges: ['0.0.0.0/0'],
    });

    new google.computeAddress.ComputeAddress(this, 'address', {
      name: 'kubernetes-the-hard-way',
    });

    for(let i=0 ; i<3 ; i++){
      const name = `controller-${i}`;
      new google.computeInstance.ComputeInstance(this, name, {
        allowStoppingForUpdate: true,
        bootDisk: {
          initializeParams: {
            image: 'debian-cloud/debian-11',
          },
        },
        canIpForward: true,
        machineType: 'e2-standard-2',
        name,
        networkInterface: [
          {
          accessConfig: [{}],
          networkIp: `10.240.0.1${i}`,
          subnetwork: subnet.name,
        }],
        scheduling: {
          automaticRestart: false,
          preemptible: true,
          provisioningModel: 'SPOT',
        },
        tags: ['kubernetes-the-hard-way' ,'controller'],
      });
    }    

    for(let i=0 ; i<3 ; i++){
      const name = `worker-${i}`;
      new google.computeInstance.ComputeInstance(this, name, {
        allowStoppingForUpdate: true,
        bootDisk: {
          initializeParams: {
            image: 'debian-cloud/debian-11',
          },
        },
        canIpForward: true,
        machineType: 'e2-standard-2',
        metadata: {
          'pod-cidr': `10.200.${i}.0/24`, 
        },
        name,
        networkInterface: [
          {
          accessConfig: [{}], 
          networkIp: `10.240.0.2${i}`,
          subnetwork: subnet.name,
        }],
        scheduling: {
          automaticRestart: false,
          preemptible: true,
          provisioningModel: 'SPOT',
        },
        tags: ['kubernetes-the-hard-way' ,'worker'],
      });
    }    

  }
}

const app = new App();
const stack = new MyStack(app, "laughing-bassoon");
new CloudBackend(stack, {
  hostname: "app.terraform.io",
  organization: "hsmtkkdefault",
  workspaces: new NamedCloudWorkspace("laughing-bassoon")
});
app.synth();
