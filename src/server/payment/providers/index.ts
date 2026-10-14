import { stripeProvider } from "./stripe";
import { type Feature, type PaymentProvider, PROVIDER_IDS, type ProviderId } from "./types";
import { waffoProvider } from "./waffo";

export * from "./types";

const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  stripe: stripeProvider,
  waffo: waffoProvider,
};

export function isProviderId(id: string): id is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(id);
}

export function getProvider(id: ProviderId): PaymentProvider {
  return PROVIDERS[id];
}

// The provider new checkouts use, picked by PAYMENT_PROVIDER. Null when it
// is unset or lacks the settings for the feature, which turns that off.
export function getActiveProvider(feature: Feature): PaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER ?? "";
  if (!isProviderId(id)) return null;
  const provider = PROVIDERS[id];
  return provider.configured(feature) ? provider : null;
}
