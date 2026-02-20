interface PipelineErrorClassification {
  userMessage: string;
  retryable: boolean;
}

const patterns: {
  test: RegExp;
  userMessage: string;
  retryable: boolean;
}[] = [
  {
    test: /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|socket hang up/i,
    userMessage: 'Something went wrong on our end. Please try again.',
    retryable: true,
  },
  {
    test: /429|rate.?limit|too many requests/i,
    userMessage:
      'Our service is temporarily busy. Please try again in a moment.',
    retryable: true,
  },
  {
    test: /timeout|timed?\s*out|deadline exceeded/i,
    userMessage: 'The request took too long. Please try again.',
    retryable: true,
  },
  {
    test: /401|403|unauthorized|forbidden/i,
    userMessage: 'Service is currently unavailable. Please try again later.',
    retryable: false,
  },
  {
    test: /ffmpeg|ffprobe|merge|concat/i,
    userMessage: 'We had trouble assembling your video. Please try again.',
    retryable: true,
  },
  {
    test: /openai|chatcompletion/i,
    userMessage: 'We had trouble generating the script. Please try again.',
    retryable: true,
  },
  {
    test: /elevenlabs|speech|voice/i,
    userMessage: 'We had trouble generating the voiceover. Please try again.',
    retryable: true,
  },
];

export function classifyPipelineError(
  raw: string,
): PipelineErrorClassification {
  for (const pattern of patterns) {
    if (pattern.test.test(raw)) {
      return {
        userMessage: pattern.userMessage,
        retryable: pattern.retryable,
      };
    }
  }
  return {
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
}
