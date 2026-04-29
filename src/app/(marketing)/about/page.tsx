import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PenLine, ArrowLeft, ExternalLink } from "lucide-react";

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
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container">
          <div className="flex h-14 items-center">
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
        </div>
      </header>
        </div>
      </header>

      <main className="flex-1 pt-14">
        {/* Story Section - First */}
        <section className="border-b py-16 lg:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                The Story
              </p>
              <h1 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
                Why I Built PostMaster
              </h1>
              
              <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>
                  I love to write. Whether it&apos;s technical blog posts, thought pieces, or 
                  documentation, writing has always been a way for me to think clearly and 
                  share ideas effectively.
                </p>
                
                <p>
                  But when I started using AI to help with writing, I kept running into the 
                  same frustrating problem: the content sounded generic. It had that 
                  unmistakable AI quality that people call &quot;AI slop.&quot; The tone was off, 
                  the phrasing felt cookie-cutter, and most importantly, it didn&apos;t sound 
                  like me.
                </p>
                
                <p>
                  I realized I wasn&apos;t alone. Many writers want to leverage AI&apos;s 
                  capabilities (its speed, its ability to handle research, its knack for 
                  generating variations), but they don&apos;t want to sacrifice their voice or 
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
                  that sounds like you, not like a bot. It&apos;s about leveraging AI as a tool 
                  for amplification, not replacement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About Me Section - Photo Next to Content */}
        <section className="border-t bg-muted/30 py-16 lg:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                Background
              </p>
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                About Me
              </h2>
              
              <div className="mt-8">
                {/* Profile Photo and Caption - Floated Left */}
                <div className="float-left mr-8 mb-6">
                  <div className="relative h-48 w-48 overflow-hidden rounded-full border-2 border-border shadow-lg">
                    <Image
                      src="/himanshu-headshot.jpg"
                      alt="Himanshu Gupta"
                      fill
                      sizes="192px"
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <h3 className="font-serif text-xl font-medium">Himanshu Gupta</h3>
                    <p className="text-sm text-muted-foreground">Creator of PostMaster</p>
                  </div>
                </div>
                
                {/* Bio Content - Wraps Around Image */}
                <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                  <p>
                    I&apos;m currently a Principal Solutions Architect at Solace, where I work with 
                    event-driven architectures and distributed systems. My background spans 
                    capital markets and financial services, working with time series databases 
                    and real-time data systems at both buy-side and sell-side firms.
                  </p>
                  
                  <p>
                    When I&apos;m not designing systems or writing code, 
                    I&apos;m usually tinkering with AI to build practical applications that solve 
                    real problems, like PostMaster.
                  </p>
                  
                  <p>
                    I write about technology, AI, and software development on Medium, and 
                    share code on GitHub. If you&apos;re interested in event-driven architecture, 
                    AI applications, or just want to connect, feel free to reach out.
                  </p>
                  
                  {/* Social Links */}
                  <div className="flex flex-wrap gap-3 pt-4">
                    <Button size="default" variant="outline" asChild>
                      <a 
                        href="https://www.linkedin.com/in/guptahim/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    </Button>
                    <Button size="default" variant="outline" asChild>
                      <a 
                        href="https://medium.com/@himgupta" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                        </svg>
                        Medium
                      </a>
                    </Button>
                    <Button size="default" variant="outline" asChild>
                      <a 
                        href="https://github.com/himoacs" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        GitHub
                      </a>
                    </Button>
                  </div>
                </div>
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
