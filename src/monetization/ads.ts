// -----------------------------------------------------------------------------
// REWARDED ADS — swappable provider (STUB by default, no network)
// -----------------------------------------------------------------------------
// Monetization is plumbed but NOT wired to any network/SDK yet. The game talks
// only to this interface; at launch a real provider (AdMob, Unity Ads, a web
// rewarded-ad SDK, ...) is dropped in via setRewardedAdProvider() without
// touching any game code. The default provider is a local stub that simulates a
// short "ad" and always completes — so nothing here makes an external request,
// keeping the build 100% client-side until launch.
// -----------------------------------------------------------------------------

export type AdPlacement = 'double_take' | 'skip_cooldown' | 'free_marks';

export interface RewardedResult {
  /** True if the ad was watched to completion and the reward should be granted. */
  completed: boolean;
}

export interface RewardedAdProvider {
  /** Whether a rewarded ad can currently be shown. */
  isAvailable(): boolean;
  /** Show a rewarded ad for a placement; resolves when it finishes or is skipped. */
  show(placement: AdPlacement): Promise<RewardedResult>;
}

/** How long the stub pretends an ad plays (ms). Purely cosmetic. */
export const STUB_AD_MS = 700;

/**
 * Local stub: no network, no SDK. Simulates a short ad and always completes.
 * Replaced at launch by a real provider via setRewardedAdProvider().
 */
export const stubRewardedAdProvider: RewardedAdProvider = {
  isAvailable: () => true,
  show: (placement: AdPlacement) =>
    new Promise<RewardedResult>((resolve) => {
      // A real provider would render an ad unit here. The stub just waits.
      if (typeof window === 'undefined') {
        resolve({ completed: true });
        return;
      }
      window.setTimeout(() => resolve({ completed: true }), STUB_AD_MS);
    }),
};

let provider: RewardedAdProvider = stubRewardedAdProvider;

/** Swap in the real provider at launch (e.g. behind an env flag + secrets). */
export function setRewardedAdProvider(next: RewardedAdProvider): void {
  provider = next;
}

export function rewardedAdsAvailable(): boolean {
  try {
    return provider.isAvailable();
  } catch {
    return false;
  }
}

/** Show a rewarded ad; resolves {completed:false} if the provider throws. */
export async function showRewardedAd(placement: AdPlacement): Promise<RewardedResult> {
  try {
    return await provider.show(placement);
  } catch {
    return { completed: false };
  }
}
