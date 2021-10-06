import { Octokit } from '@octokit/rest';

export const prInfo = {
  owner: process.env.GIT_OWNER!,
  repo: process.env.GIT_REPO!,
  issue_number: +process.env.PR_NUMBER!,
};

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});
