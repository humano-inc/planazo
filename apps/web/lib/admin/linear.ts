import {
  buildLinearIssueDescription,
  buildLinearIssueTitle,
  getFeedbackKindDetails,
  type FeedbackForLinear,
} from './linear-issue';

const LINEAR_TEAM_KEY = 'PLA';

export type ScreenshotFile = {
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
};

export type CreatedLinearIssue = {
  id: string;
  identifier: string;
  url: string;
};

type LinearTarget = {
  teamId: string;
  labelId: string;
};

type PreparedUpload = {
  assetUrl: string;
  headers: Record<string, string>;
  uploadUrl: string;
};

export type LinearGateway = {
  resolveTarget(teamKey: string, labelName: string): Promise<LinearTarget>;
  prepareUpload(file: ScreenshotFile): Promise<PreparedUpload>;
  putUpload(upload: PreparedUpload, bytes: ArrayBuffer): Promise<void>;
  createIssue(input: {
    teamId: string;
    labelId: string;
    title: string;
    description: string;
  }): Promise<CreatedLinearIssue>;
};

async function uploadScreenshot(gateway: LinearGateway, screenshot: ScreenshotFile) {
  const upload = await gateway.prepareUpload(screenshot);
  await gateway.putUpload(upload, screenshot.bytes);
  return upload.assetUrl;
}

export async function createLinearIssueFromFeedback(input: {
  feedback: FeedbackForLinear;
  gateway: LinearGateway;
  screenshot: ScreenshotFile | null;
  sourceUrl: string;
}) {
  const details = getFeedbackKindDetails(input.feedback.kind);
  const target = await input.gateway.resolveTarget(LINEAR_TEAM_KEY, details.label);
  const screenshotAssetUrl = input.screenshot
    ? await uploadScreenshot(input.gateway, input.screenshot)
    : null;

  return input.gateway.createIssue({
    teamId: target.teamId,
    labelId: target.labelId,
    title: buildLinearIssueTitle(input.feedback),
    description: buildLinearIssueDescription(
      input.feedback,
      input.sourceUrl,
      screenshotAssetUrl,
    ),
  });
}
