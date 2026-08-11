import {
  FinalCtaSection,
  GamificationSection,
  HeroSection,
  HowItWorksSection,
  MoneyPreservedSection,
} from "@/features/landing";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-16 bg-zinc-50 font-sans">
      <HeroSection />
      <HowItWorksSection />
      <MoneyPreservedSection />
      <GamificationSection />
      <FinalCtaSection />
    </div>
  );
}
