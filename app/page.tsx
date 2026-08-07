import {
  FinalCtaSection,
  GamificationSection,
  HeroSection,
  HowItWorksSection,
  MoneyPreservedSection,
} from "@/features/landing";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-16 bg-zinc-50 px-4 py-8 font-sans dark:bg-black">
      <HeroSection />
      <HowItWorksSection />
      <MoneyPreservedSection />
      <GamificationSection />
      <FinalCtaSection />
    </div>
  );
}
