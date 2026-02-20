import { z } from "zod";

const createEnv = () => {
  const EnvSchema = z.object({
    API_URL: z.string().url("NEXT_PUBLIC_API_URL must be a valid URL"),
  });

  const envVars = {
    API_URL: process.env.NEXT_PUBLIC_API_URL,
  };

  const parsed = EnvSchema.safeParse(envVars);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${Object.entries(
        parsed.error.flatten().fieldErrors,
      )
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n")}`,
    );
  }

  return parsed.data;
};

export const env = createEnv();
