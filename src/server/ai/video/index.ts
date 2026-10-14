import { dashscopeConfigured } from "../dashscope";
import { dashscopeVideoProvider, submitReferenceVideo } from "./dashscope";
import { falProvider } from "./fal";
import { seeapiProvider } from "./seeapi";
import { type ReferenceVideoJob, VIDEO_PROVIDER_IDS, type VideoProvider, type VideoProviderId } from "./types";

export * from "./types";

const PROVIDERS: Record<VideoProviderId, VideoProvider> = {
  fal: falProvider,
  seeapi: seeapiProvider,
  dashscope: dashscopeVideoProvider,
};

export function isVideoProviderId(id: string): id is VideoProviderId {
  return (VIDEO_PROVIDER_IDS as readonly string[]).includes(id);
}

export function getVideoProvider(id: VideoProviderId): VideoProvider {
  return PROVIDERS[id];
}

// The provider new videos use, picked by VIDEO_PROVIDER. Null when it is
// unset or lacks its key, which turns video generation off.
export function getActiveVideoProvider(): VideoProvider | null {
  const id = process.env.VIDEO_PROVIDER ?? "";
  if (!isVideoProviderId(id)) return null;
  const provider = PROVIDERS[id];
  return provider.configured() ? provider : null;
}

// Reference-to-video runs on Bailian whatever VIDEO_PROVIDER says. Its jobs
// are polled through the "dashscope" provider. Null without a Bailian key.
export function getReferenceVideoProvider(): {
  id: "dashscope";
  submit(job: ReferenceVideoJob): Promise<string>;
} | null {
  return dashscopeConfigured() ? { id: "dashscope", submit: submitReferenceVideo } : null;
}
