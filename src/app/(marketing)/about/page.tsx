import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PenLine, Linkedin, Github } from "lucide-react";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Draggable area for Electron window */}
      <div 
        className="fixed top-0 left-0 right-0 h-14 z-40"
        style={{ 
          // @ts-expect-error - Electron-specific CSS property for window dragging
          WebkitAppRegion: 'drag',
          appRegion: 'drag'
        }}
      />
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm px-4">
        <div className="flex h-14 items-center">
          {/* Spacer for macOS traffic lights */}
          <div className="w-20 lg:block hidden" />
          <Link 
            href="/" 
            className="flex items-center gap-2.5"
            style={{ 
              // @ts-expect-error - Electron-specific CSS property
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            }}
          >
            <PenLine className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-lg font-medium">PostMaster</span>
          </Link>
          <div className="flex-1" />
          <nav 
            className="flex items-center gap-4"
            style={{ 
              // @ts-expect-error - Electron-specific CSS property
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            }}
          >
            <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
              <Link href="/" className="flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-14">
        {/* Hero Section with Photo */}
        <section className="border-b py-24 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
                {/* Profile Photo */}
                <div className="relative h-48 w-48 flex-shrink-0 overflow-hidden rounded-full border-2 border-border shadow-lg">
                  <Image
                    src="/himanshu-profile.jpg"
                    alt="Himanshu Gupta"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                
                {/* Intro */}
                <div className="text-center lg:text-left">
                  <h1 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
                    Himanshu Gupta
                  </h1>
                  <p className="mt-3 text-lg text-muted-foreground">
                    Solutions Architect at Solace
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">
                    Building tools to make AI-assisted writing feel authentic
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why I Built PostMaster */}
        <section className="py-24 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                The Story
              </p>
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                Why I Built PostMaster
              </h2>
              
              <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>
                  I love to write. Whether it&apos;s technical blog posts, thought pieces, or 
                  documentation, writing has always been a way for me to think clearly and 
                  share ideas effectively.
                </p>
                
                <p>
                  But when I started using AI to help with writing, I kept running into the 
                  same frustrating problem: the content sounded generic. It had that 
                  unmistakable AI quality—what people call &quot;AI slop.&quot; The tone was off, 
                  the phrasing felt cookie-cutter, and most importantly, it didn&apos;t sound 
                  like me.
                </p>
                
                <p>
                  I realized I wasn&apos;t alone. Many writers want to leverage AI&apos;s 
                  capabilities—its speed, its ability to handle research, its knack for 
                  generating variations—but they don&apos;t want to sacrifice their voice or 
                  settle for mediocre output.
                </p>
                
                <p>
                  That&apos;s why I built PostMaster. I wanted a tool that would let me tap into 
                  multiple AI models at once, compare their outputs side-by-side, and 
                  synthesize the best elements while keeping my authentic voice intact. No 
                  more settling for one model&apos;s interpretation. No more generic, 
                  one-size-fits-all content.
                </p>
                
                <p>
                  PostMaster is designed to help writers like you generate superior content 
                  that sounds like you—not like a bot. It&apos;s about leveraging AI as a tool 
                  for amplification, not replacement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Background */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                Background
              </p>
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                About Me
              </h2>
              
              <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>
                  I&apos;m currently a Solutions Architect at Solace, where I work with 
                  event-driven architectures and distributed systems. My background spans 
                  capital markets and financial services, working with time series databases 
                  and real-time data systems at both buy-side and sell-side firms.
                </p>
                
                <p>
                  I hold a Bachelor of Science in Electrical Engineering from the City 
                  College of New York. When I&apos;m not designing systems or writing code, 
                  I&apos;m usually tinkering with AI to build practical applications that solve 
                  real problems—like PostMaster.
                </p>
                
                <p>
                  I write about technology, AI, and software development on Medium, and 
                  share code on GitHub. If you&apos;re interested in event-driven architecture, 
                  AI applications, or just want to connect, feel free to reach out.
                </p>
              </div>
              
              {/* Social Links */}
              <div className="mt-12 flex flex-wrap gap-4">
                <Button size="lg" variant="outline" asChild>
                  <a 
                    href="https://www.linkedin.com/in/guptahim/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Linkedin className="h-5 w-5" />
                    LinkedIn
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a 
                    href="https://medium.com/@himgupta" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <svg 
                      className="h-5 w-5" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                    </svg>
                    Medium
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a 
                    href="https://github.com/himoacs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Github className="h-5 w-5" />
                    GitHub
                  </a>
                </Button>
              </div>
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
            Open source. Local-first. Made for writers.
          </p>
        </div>
      </footer>
    </div>
  );
}
