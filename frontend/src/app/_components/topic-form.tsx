"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createVideo, videosKeys } from "@/lib/api";

const STYLE_PRESETS = [
  {
    label: "Cinematic",
    value: "Cinematic look with dramatic lighting and depth of field",
  },
  {
    label: "Anime",
    value: "Anime art style with vibrant colors and cel-shading",
  },
  {
    label: "60's Retro",
    value: "1960s retro aesthetic with warm tones and film grain",
  },
  {
    label: "Noir",
    value: "Black and white film noir with high contrast shadows",
  },
  {
    label: "Steampunk",
    value: "Steampunk aesthetic with brass, gears, and Victorian elements",
  },
  {
    label: "Watercolor",
    value: "Soft watercolor painting style with flowing brushstrokes",
  },
  {
    label: "Neon",
    value: "Neon-lit cyberpunk city aesthetic with glowing colors",
  },
  {
    label: "Minimalist",
    value: "Clean minimalist style with muted tones and simple shapes",
  },
] as const;

const VOICE_PRESETS = [
  { label: "Rachel", value: "21m00Tcm4TlvDq8ikWAM", desc: "Calm female" },
  { label: "Adam", value: "pNInz6obpgDQGcFmaJgB", desc: "Deep male" },
  { label: "Antoni", value: "ErXwobaYiN019PkySvjV", desc: "Young male" },
  { label: "Bella", value: "EXAVITQu4vr4xnSDxMaL", desc: "Soft female" },
  { label: "Domi", value: "AZnzlk1XvdvUeBnXmlld", desc: "Strong female" },
  { label: "Josh", value: "TxGEqnHWrfWFTfGW9XjX", desc: "Deep young male" },
] as const;

const MODEL_PRESETS = [
  {
    value: "fast-wan",
    label: "Fast Wan",
    desc: "Fast, anime & general purpose",
    resolutions: ["480p", "580p", "720p"],
    defaultResolution: "480p",
  },
  {
    value: "vidu-q3-turbo",
    label: "Vidu Q3 Turbo",
    desc: "High quality cinematic",
    resolutions: ["360p", "540p", "720p", "1080p"],
    defaultResolution: "720p",
  },
] as const;

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
  style: STYLE_PRESETS[0].value,
  captions: true,
  voiceId: VOICE_PRESETS[0].value,
  modelId: MODEL_PRESETS[0].value,
  resolution: MODEL_PRESETS[0].defaultResolution,
};

const formId = "topic-form";

export function TopicForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues,
  });

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

  const loading = createMutation.isPending;
  const topicValue = form.watch("topic");

  function onSubmit(values: TopicFormValues) {
    createMutation.mutate(values);
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
            const selectedPresetIndex = STYLE_PRESETS.findIndex(
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
                    {STYLE_PRESETS.map((preset, i) => (
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
                {VOICE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={loading}
                    onClick={() => field.onChange(preset.value)}
                    className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                      field.value === preset.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {preset.label}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {preset.desc}
                    </span>
                  </button>
                ))}
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
                {MODEL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      field.onChange(preset.value);
                      form.setValue("resolution", preset.defaultResolution);
                    }}
                    className={`flex flex-col items-start rounded-lg border p-3 transition-colors ${
                      field.value === preset.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        field.value === preset.value
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {preset.label}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      {preset.desc}
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
            const currentModel =
              MODEL_PRESETS.find((m) => m.value === currentModelId) ||
              MODEL_PRESETS[0];

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
