const { Stack, SecretValue } = require('aws-cdk-lib');
const eb = require('aws-cdk-lib/aws-elasticbeanstalk');
const pipelines = require('aws-cdk-lib/pipelines');
const iam = require('aws-cdk-lib/aws-iam'); // Added for IAM fix

class InfrastructureStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // 1. THE PIPELINE
    const pipeline = new pipelines.CodePipeline(this, 'MyPipeline', {
      pipelineName: 'NodeJsEBPipeline',
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub('Ivelraj1997/express-world', 'main', {
          authentication: SecretValue.secretsManager('github-token'),
        }),
        commands: [
          'n 22',             // Explicitly switch to Node 22 to stop the warnings
          'node -v',          // Verify version
          'npm install',
          'npx cdk synth -v',    // This will now work because cdk.json exists
        ],
      }),
    });

    // --- FIX 1: CREATE THE INSTANCE PROFILE MANUALLY ---
    // Newer regions don't provide this by default. We'll create it here.
    const ebRole = new iam.Role(this, 'CustomEBRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkMulticontainerDocker'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWorkerTier'),
      ],
    });

    const ebInstanceProfile = new iam.CfnInstanceProfile(this, 'CustomEBInstanceProfile', {
      roles: [ebRole.roleName],
    });

    // 2. THE DESTINATION (Application)
    const app = new eb.CfnApplication(this, 'MyNodeApp', {
      applicationName: 'MyExpressApp',
    });

    // 3. THE SERVER (Environment)
    const env = new eb.CfnEnvironment(this, 'MyNodeEnv', {
      applicationName: app.applicationName,
      environmentName: 'MyExpressApp-Env', // Avoid using the exact same name as the App
      // --- FIX 2: LATEST SOLUTION STACK ---
      // Instead of an ARN, use the exact name. 
      // If v6.8.0 fails, try removing the version number to get the latest: 
      // "64bit Amazon Linux 2023 running Node.js 20"
      solutionStackName: "64bit Amazon Linux 2023 v6.8.0 running Node.js 24",
      optionSettings: [
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'IamInstanceProfile',
          value: ebInstanceProfile.ref, // Use the profile we created above!
        }
      ],
    });

    // Ensure the App exists before the Env tries to build
    env.addDependency(app);
  }
}

module.exports = { InfrastructureStack };