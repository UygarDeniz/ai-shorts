"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  createVideo,
  getVoices,
  getConfig,
  videosKeys,
} from "@/lib/api/videos";

function VoicePlayButton({ previewUrl }: { previewUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.addEventListener("ended", () => setIsPlaying(false));
      audioRef.current.addEventListener("pause", () => setIsPlaying(false));
      audioRef.current.addEventListener("play", () => setIsPlaying(true));
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [previewUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100 ${
        isPlaying
          ? "bg-primary text-primary-foreground opacity-100"
          : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"
      }`}
      title="Preview voice"
    >
      {isPlaying ? (
        <Square className="w-3 h-3" />
      ) : (
        <Play className="w-3 h-3 text-current ml-[1px]" />
      )}
    </button>
  );
}

const topicFormSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters").max(500),
  durationSec: z.coerce.number().min(3).max(60),
  style: z.string().min(1, "Please select or describe a style"),
  captions: z.boolean(),
  voiceId: z.string(),
  modelId: z.string(),
  resolution: z.string(),
});

type TopicFormValues = z.infer<typeof topicFormSchema>;

const defaultValues: TopicFormValues = {
  topic: "",
  durationSec: 5,
  style: "",
  captions: true,
  voiceId: "",
  modelId: "",
  resolution: "",
};

const formId = "topic-form";

export function TopicForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: videosKeys.config,
    queryFn: getConfig,
  });

  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: videosKeys.voices,
    queryFn: getVoices,
  });

  useEffect(() => {
    if (config && voices && !form.formState.isDirty) {
      form.reset({
        ...form.getValues(),
        style: form.getValues().style || config.styles[0]?.value || "",
        voiceId: form.getValues().voiceId || voices[0]?.id || "",
        modelId: form.getValues().modelId || config.models[0]?.value || "",
        resolution:
          form.getValues().resolution ||
          config.models[0]?.defaultResolution ||
          "",
      });
    }
  }, [config, voices, form]);

  const createMutation = useMutation({
    mutationFn: (values: TopicFormValues) =>
      createVideo(
        values.topic.trim(),
        values.durationSec,
        values.style,
        values.captions,
        values.voiceId,
        values.modelId,
        values.resolution,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: videosKeys.lists() });
      router.push(`/generate/${result.id}`);
    },
    onError: (err) => {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    },
  });

  const isDataLoading = configLoading || voicesLoading;
  const loading = createMutation.isPending || isDataLoading;
  const topicValue = form.watch("topic");

  function onSubmit(values: TopicFormValues) {
    createMutation.mutate(values);
  }

  if (isDataLoading) {
    return (
      <div className="flex w-full max-w-2xl items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full max-w-2xl space-y-4"
    >
      <FieldGroup>
        <Controller
          name="topic"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-topic`}>Topic</FieldLabel>
              <Textarea
                {...field}
                id={`${formId}-topic`}
                placeholder="How was Istanbul conquered in 1453?"
                className="min-h-[120px] resize-none text-base"
                disabled={loading}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="style"
          control={form.control}
          render={({ field, fieldState }) => {
            const styles = config?.styles || [];
            const selectedPresetIndex = styles.findIndex(
              (p) => p.value === field.value,
            );
            const customStyle = selectedPresetIndex >= 0 ? "" : field.value;
            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-style-custom`}>
                  Visual Style
                </FieldLabel>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {styles.map((preset, i) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={loading}
                        onClick={() => field.onChange(preset.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          selectedPresetIndex === i
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    id={`${formId}-style-custom`}
                    placeholder="Or describe a custom style... e.g. Miyazaki anime with lush forests"
                    disabled={loading}
                    className="mt-1"
                    value={customStyle}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={fieldState.invalid}
                  />
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            );
          }}
        />

        <Controller
          name="voiceId"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel>Voice</FieldLabel>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(voices || []).map((voice) => {
                  return (
                    <div key={voice.id} className="relative group h-full">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => field.onChange(voice.id)}
                        className={`w-full h-full rounded-lg border px-3 py-2 flex flex-col items-center justify-center text-center transition-colors ${
                          field.value === voice.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {voice.label}
                        </span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          {voice.desc}
                        </span>
                      </button>
                      {voice.previewUrl && (
                        <div className="absolute top-1 right-1 z-10">
                          <VoicePlayButton previewUrl={voice.previewUrl} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}
        />

        <Controller
          name="modelId"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel>AI Video Model</FieldLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(config?.models || []).map((model) => (
                  <button
                    key={model.value}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      field.onChange(model.value);
                      form.setValue("resolution", model.defaultResolution);
                    }}
                    className={`flex flex-col items-start rounded-lg border p-3 transition-colors ${
                      field.value === model.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        field.value === model.value
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {model.label}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      {model.desc}
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          )}
        />

        <Controller
          name="resolution"
          control={form.control}
          render={({ field }) => {
            const currentModelId = form.watch("modelId");
            const models = config?.models || [];
            const currentModel =
              models.find((m) => m.value === currentModelId) || models[0];

            if (!currentModel) return <></>;

            return (
              <Field>
                <FieldLabel>Video Resolution</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {currentModel.resolutions.map((res) => (
                    <button
                      key={res}
                      type="button"
                      disabled={loading}
                      onClick={() => field.onChange(res)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        field.value === res
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </Field>
            );
          }}
        />

        <Controller
          name="durationSec"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-durationSec`}>
                Target Duration (seconds)
              </FieldLabel>
              <Input
                {...field}
                id={`${formId}-durationSec`}
                type="number"
                min={3}
                max={60}
                step={1}
                disabled={loading}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="captions"
          control={form.control}
          render={({ field }) => (
            <Field>
              <label
                htmlFor={`${formId}-captions`}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium">Captions</span>
                  <p className="text-xs text-muted-foreground">
                    Burn word-by-word subtitles into the video
                  </p>
                </div>
                <button
                  id={`${formId}-captions`}
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  disabled={loading}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    field.value ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      field.value ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            </Field>
          )}
        />
      </FieldGroup>

      {form.formState.errors.root && (
        <p className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full text-base font-semibold"
        disabled={loading || !topicValue?.trim()}
      >
        {loading ? "Starting generation..." : "Generate Video"}
      </Button>
    </form>
  );
}
