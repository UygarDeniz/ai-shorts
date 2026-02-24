import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Wand2, Zap, Layers } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-hidden relative selection:bg-primary/30">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative px-4 pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center">
        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/50 animate-fade-in-up [animation-delay:100ms] text-balance">
          Ideas into{" "}
          <span className="text-primary italic font-serif">Viral Videos.</span>
        </h1>

        <p className="max-w-2xl mt-6 text-lg tracking-tight text-muted-foreground sm:text-xl animate-fade-in-up [animation-delay:200ms] text-balance">
          Just type a topic. Our AI writes the script, generates expressive
          voiceovers, creates visuals, and renders a publish-ready video for
          TikTok, Reels & Shorts.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 animate-fade-in-up [animation-delay:300ms]">
          <Button
            size="lg"
            className="h-14 px-8 text-base font-semibold shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] transition-all rounded-full group"
            asChild
          >
            <Link href="/dashboard">
              Start Creating
              <ArrowRight className="w-4 h-4 ml-2 shrink-0 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-8 text-base font-medium rounded-full bg-background/50 backdrop-blur-sm border-border hover:bg-muted/50"
            asChild
          >
            <Link href="#features">
              <Play className="w-4 h-4 mr-2 shrink-0" />
              Watch Demo
            </Link>
          </Button>
        </div>

        {/* Dashboard Preview Mockup */}
        <div className="w-full max-w-5xl mt-24 aspect-video rounded-xl border border-border/50 bg-muted/20 relative overflow-hidden group shadow-2xl shadow-black/50 animate-fade-in-up [animation-delay:500ms]">
          <div className="absolute inset-0 bg-linear-to-t from-background to-transparent z-10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 opacity-50 font-mono text-sm tracking-widest text-muted-foreground group-hover:opacity-100 transition-opacity">
              DASHBOARD PREVIEW COMING SOON
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section
        id="features"
        className="px-4 py-24 border-t border-border/50 bg-background/50"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl text-foreground">
              End-to-End Content Automation
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Stop editing for hours. Fully automate your short-form video
              pipeline with state-of-the-art AI generation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col p-6 rounded-2xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Wand2 className="w-6 h-6 text-primary shrink-0" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Automated Scripting
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Provide a single prompt and our AI crafts engaging,
                retention-optimized scripts perfect for short-form platforms.
              </p>
            </div>

            <div className="flex flex-col p-6 rounded-2xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-emerald-500 shrink-0" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Premium AI Models</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Powered by ElevenLabs for lifelike voiceovers and Fal.ai's Flux
                for stunning images, all stitched together in seconds.
              </p>
            </div>

            <div className="flex flex-col p-6 rounded-2xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6 text-blue-500 shrink-0" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Custom Visuals</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Choose from dozens of visual styles like Cyberpunk, Anime,
                Photorealistic, or define your own custom prompting aesthetic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-4 text-center text-sm text-muted-foreground">
        <p>© 2026 AI Video Gen. All rights reserved.</p>
      </footer>
    </div>
  );
}
