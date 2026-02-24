import { TopicForm } from "../_components/topic-form";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 w-full max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
          Create New Video
        </h1>
        <p className="mx-auto max-w-lg text-lg text-muted-foreground">
          Enter a topic, customize the options, and launch generation.
        </p>
      </div>

      <TopicForm />
    </div>
  );
}
