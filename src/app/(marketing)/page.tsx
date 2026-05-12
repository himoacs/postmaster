import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Layers,
  RefreshCw,
  ImageIcon,
  Key,
  ArrowRight,
  AlertTriangle,
  Target,
  PenLine,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1">
        {/* Hero - Split Screen */}
        <section className="border-b">
          <div className="container grid min-h-[calc(100vh-57px)] items-center gap-12 py-8 lg:grid-cols-2 lg:gap-16">
            {/* Left: Text */}
            <div className="max-w-xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                AI Writing Assistant That Sounds Human
              </p>
              <h1 className="font-serif text-4xl font-normal leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Skip the AI Slop.
                <br />
                <span className="text-muted-foreground">Write in Your Voice.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                PostMaster polishes AI-generated content, catches 80+ AI tells, and adapts to your unique voice so your writing stays authentic.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button size="lg" asChild className="h-12 px-6">
                  <Link href="/dashboard">
                    Start Writing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-6">
                  <Link href="#how-it-works">Learn More</Link>
                </Button>
              </div>
            </div>
            
            {/* Right: Voice Analyzer Visual */}
            <div className="relative hidden lg:block">
              <div className="rounded-2xl border bg-card p-8 shadow-lg" style={{ minWidth: '600px' }}>
                <div className="grid gap-7" style={{ gridTemplateColumns: '28% 36% 36%' }}>
                  {/* Samples Section */}
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                      Samples
                    </span>
                    <div className="flex gap-2.5 mt-auto">
                      <div className="h-[70px] w-[50px] rounded bg-primary shadow-md" />
                      <div className="h-[70px] w-[50px] rounded bg-primary shadow-md" />
                      <div className="h-[70px] w-[50px] rounded bg-primary shadow-md" />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-primary via-yellow-600 to-green-500" />
                    </div>
                    <span className="text-xs text-muted-foreground mb-auto">Analyzing...</span>
                  </div>
                  
                  {/* Voice Profile Section */}
                  <div className="flex flex-col gap-3 border-l border-r border-border px-5">
                    <span className="text-center text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      Voice Profile
                    </span>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span>
                        <span className="text-muted-foreground text-sm">Tone:</span>
                        <span className="font-mono text-xs font-semibold">Direct</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span>
                        <span className="text-muted-foreground text-sm">Length:</span>
                        <span className="font-mono text-xs font-semibold whitespace-nowrap">12-18 words</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span>
                        <span className="text-muted-foreground text-sm">Jargon:</span>
                        <span className="font-mono text-xs font-semibold">Low</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span>
                        <span className="text-muted-foreground text-sm whitespace-nowrap">Em-dashes:</span>
                        <span className="font-mono text-xs font-semibold">None</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✓</span>
                        <span className="text-muted-foreground text-sm">Match:</span>
                        <span className="font-mono text-xs font-semibold">94%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview Section */}
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                      Preview
                    </span>
                    <div className="rounded-lg border bg-muted p-4 text-center text-sm leading-relaxed max-w-[180px]">
                      AI is powerful, and when used correctly, it transforms how we work.
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-600 whitespace-nowrap">
                      ✓ Voice Matched
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
                The workflow
              </p>
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                How PostMaster Works
              </h2>
              <p className="mt-4 text-muted-foreground">
                A deliberate approach to AI-assisted writing that keeps you in control.
              </p>
            </div>
            
            <div className="mx-auto mt-20 grid max-w-5xl gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<AlertTriangle className="h-5 w-5" />}
                number="01"
                title="Keep Your Writing Human"
                description="Detects 80+ AI phrases and clichés—like 'dive in,' 'game-changer,' or 'leverage'—so your writing sounds natural, not robotic."
              />
              <FeatureCard
                icon={<Target className="h-5 w-5" />}
                number="02"
                title="Learn & Match Your Voice"
                description="Upload samples of your writing. PostMaster analyzes your tone, rhythm, and vocabulary to generate content that sounds like you."
              />
              <FeatureCard
                icon={<RefreshCw className="h-5 w-5" />}
                number="03"
                title="Polish & Refine Iteratively"
                description="Provide feedback, tighten phrasing, adjust tone. Iterate with the AI until every sentence feels intentional and human."
              />
              <FeatureCard
                icon={<Layers className="h-5 w-5" />}
                number="04"
                title="Advanced: Compare Multiple Models"
                description="Submit your prompt once, receive outputs from multiple AI models. See how each interprets your request and pick the best."
              />
              <FeatureCard
                icon={<ImageIcon className="h-5 w-5" />}
                number="05"
                title="Generate Matching Visuals"
                description="Create images with DALL-E or Stable Diffusion, integrated directly into your workflow alongside your text."
              />
              <FeatureCard
                icon={<Key className="h-5 w-5" />}
                number="06"
                title="Privacy: Use Your Own Keys"
                description="Bring your own API keys for complete control. No subscriptions, no data harvesting—just pay for what you use."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                Ready to write with intention?
              </h2>
              <p className="mt-4 text-muted-foreground">
                PostMaster runs locally. Your API keys, your content, your control.
              </p>
              <Button size="lg" className="mt-8 h-12 px-8" asChild>
                <Link href="/dashboard">
                  Open the Editor
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <PenLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-serif text-sm text-muted-foreground">PostMaster</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Open source. Local-first. Made for writers by{" "}
            <Link href="/about" className="underline hover:text-foreground transition-colors">
              Himanshu Gupta
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card p-8 transition-colors hover:bg-accent/30">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">{number}</span>
        <div className="text-primary">{icon}</div>
      </div>
      <h3 className="font-serif text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
