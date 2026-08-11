import 'server-only';

import { LinearClient } from '@linear/sdk';

import type { LinearGateway } from './linear';

function requireLinearApiKey() {
  const apiKey = process.env.LINEAR_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Linear is not configured yet. Add LINEAR_API_KEY to the web environment.');
  }

  return apiKey;
}

export function createLinearGateway(apiKey = requireLinearApiKey()): LinearGateway {
  const client = new LinearClient({ apiKey });

  return {
    async resolveTarget(teamKey, labelName) {
      const teams = await client.teams({ first: 100 });
      const team = teams.nodes.find((candidate) => candidate.key === teamKey);

      if (!team) {
        throw new Error(`Linear team ${teamKey} is not available to this API key.`);
      }

      const labels = await team.labels({ first: 100 });
      const label = labels.nodes.find(
        (candidate) => !candidate.isGroup && candidate.name.toLowerCase() === labelName.toLowerCase(),
      );

      if (!label) {
        throw new Error(`Linear label ${labelName} is missing from team ${teamKey}.`);
      }

      return { teamId: team.id, labelId: label.id };
    },

    async prepareUpload(file) {
      const payload = await client.fileUpload(file.contentType, file.filename, file.bytes.byteLength);
      const upload = payload.uploadFile;

      if (!payload.success || !upload) {
        throw new Error('Linear did not prepare the screenshot upload.');
      }

      return {
        assetUrl: upload.assetUrl,
        uploadUrl: upload.uploadUrl,
        headers: Object.fromEntries(upload.headers.map(({ key, value }) => [key, value])),
      };
    },

    async putUpload(upload, bytes) {
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers,
        body: bytes,
      });

      if (!response.ok) {
        throw new Error(`Linear screenshot upload failed with status ${response.status}.`);
      }
    },

    async createIssue(input) {
      const payload = await client.createIssue({
        teamId: input.teamId,
        labelIds: [input.labelId],
        title: input.title,
        description: input.description,
      });
      const issue = await payload.issue;

      if (!payload.success || !issue) {
        throw new Error('Linear did not create the issue.');
      }

      return {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url,
      };
    },
  };
}
