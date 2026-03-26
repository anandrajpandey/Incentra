#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { StreamFlowStack } from '../lib/streamflow-stack'

const app = new cdk.App()

new StreamFlowStack(app, 'StreamFlowStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
})
