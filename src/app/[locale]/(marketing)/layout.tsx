import { SiteAccount } from "@/app/_lib/site-account";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function MarketingLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader account={<SiteAccount />} />
      {children}
      <Footer />
    </>
  );
}
