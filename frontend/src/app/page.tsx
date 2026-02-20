import { TopicForm } from "./_components/topic-form";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
          AI Video Generator
        </h1>
        <p className="mx-auto max-w-lg text-lg text-muted-foreground">
          Enter any topic and get a publish-ready short-form video for YouTube
          Shorts, TikTok, or Instagram Reels — 100% AI generated.
        </p>
      </div>

      <TopicForm />

      <div className="mt-16 grid max-w-3xl grid-cols-1 gap-6 text-center sm:grid-cols-3">
        <div>
          <div className="mb-2 text-3xl">1</div>
          <h3 className="font-semibold">Enter a Topic</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Type any subject — history, science, fun facts, anything.
          </p>
        </div>
        <div>
          <div className="mb-2 text-3xl">2</div>
          <h3 className="font-semibold">AI Creates Everything</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            GPT-4 writes the script. ElevenLabs voices it. AI generates the
            video.
          </p>
        </div>
        <div>
          <div className="mb-2 text-3xl">3</div>
          <h3 className="font-semibold">Download & Publish</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get a vertical video ready to upload to any platform.
          </p>
        </div>
      </div>
    </div>
  );
}
