import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { renderWithIntl } from "@/test/intl";
import { Billing } from "@/components/billing/billing";
import { ImageGenerator } from "@/components/images/image-generator";
import { RapGenerator } from "@/components/videos/rap-generator";
import { VideoGenerator } from "@/components/videos/video-generator";
import { CreditsProvider, useCredits } from "./credits";

afterEach(cleanup);

const surfaces = {
  images: <ImageGenerator balance={100} cost={1} aspects={["1:1"]} maxPromptLength={2000} enabled images={[]} />,
  videos: (
    <VideoGenerator
      balance={100}
      resolutions={[{ value: "720p", creditsPerSecond: 5 }]}
      durations={[5]}
      maxPromptLength={2000}
      maxImageBytes={4 * 1024 * 1024}
      imageLimits={{ minSide: 240, maxSide: 8000, maxRatio: 8 }}
      enabled
      videos={[]}
    />
  ),
  rap: (
    <RapGenerator
      balance={100}
      credits={75}
      maxImageBytes={2 * 1024 * 1024}
      maxNameLength={30}
      imageLimits={{ minSide: 240, maxSide: 8000, maxRatio: 8 }}
      enabled
      videos={[]}
    />
  ),
  billing: <Billing balance={100} packs={[]} orders={[]} transactions={[]} enabled={false} />,
};

function SpendAndNavigate({ surface }: { surface: keyof typeof surfaces }) {
  const credits = useCredits();
  const [open, setOpen] = useState(false);
  return open ? surfaces[surface] : (
    <button onClick={() => {
      credits?.adjust(-4);
      setOpen(true);
    }}>
      Spend and navigate
    </button>
  );
}

test.each(Object.keys(surfaces) as (keyof typeof surfaces)[])(
  "%s shows the shared balance after spending on another page, even with stale route props",
  (surface) => {
    renderWithIntl(<CreditsProvider balance={100}><SpendAndNavigate surface={surface} /></CreditsProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Spend and navigate" }));
    expect(screen.getByText(surface === "billing" ? "96 credits" : "96 credits left")).toBeTruthy();
  },
);

function Refund() {
  const credits = useCredits();
  return <button onClick={() => credits?.adjust(25, "video-refund:shared")}>Refund</button>;
}

function Balance() {
  return <output>{useCredits()?.balance}</output>;
}

test("a refund observed by two preserved generators changes the shared balance once", () => {
  renderWithIntl(<CreditsProvider balance={75}><Refund /><Refund /><Balance /></CreditsProvider>);
  for (const button of screen.getAllByRole("button", { name: "Refund" })) fireEvent.click(button);
  expect(screen.getByRole("status").textContent).toBe("100");
});
