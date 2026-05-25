// AUTO-GENERATED from catalog.yaml — do not edit by hand.
// Run `pnpm catalog:build` to regenerate after editing the yaml.
//
// Source of truth: src/renderer/src/lib/catalog/catalog.yaml
// Models: 175

import type { CatalogModel } from './types'

export const CATALOG: readonly CatalogModel[] = [
  {
    "id": "gpt-5-5",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.5",
      "openai/gpt-5.5"
    ]
  },
  {
    "id": "gpt-5-5-pro",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.5-pro"
    ]
  },
  {
    "id": "gpt-5-4",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.4",
      "openai/gpt-5.4"
    ]
  },
  {
    "id": "gpt-5-4-pro",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.4-pro"
    ]
  },
  {
    "id": "gpt-5-4-mini",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.4-mini"
    ]
  },
  {
    "id": "gpt-5-4-nano",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-5.4-nano"
    ]
  },
  {
    "id": "gpt-5",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "openai/gpt-5"
    ]
  },
  {
    "id": "gpt-5-mini",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "gpt-5-nano",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 400000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "gpt-5-3-codex",
    "vendor": "openai",
    "family": "codex",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gpt-5.3-codex"
    ]
  },
  {
    "id": "gpt-4-1",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-4.1",
      "openai/gpt-4.1"
    ]
  },
  {
    "id": "gpt-4-1-mini",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-4.1-mini"
    ]
  },
  {
    "id": "gpt-4o",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "openai/gpt-4o"
    ]
  },
  {
    "id": "gpt-4o-mini",
    "vendor": "openai",
    "family": "gpt",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "openai/gpt-4o-mini"
    ]
  },
  {
    "id": "gpt-image-2",
    "vendor": "openai",
    "family": "gpt-image",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 4000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-image-2-2026-04-21",
      "openai/gpt-image-2"
    ]
  },
  {
    "id": "sora-2",
    "vendor": "openai",
    "family": "sora",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "sora-2-2025-10-06",
      "sora-2-2025-12-08",
      "openai/sora-2"
    ]
  },
  {
    "id": "sora-2-pro",
    "vendor": "openai",
    "family": "sora",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "sora-2-pro-2025-10-06",
      "openai/sora-2-pro"
    ]
  },
  {
    "id": "gpt-realtime-2",
    "vendor": "openai",
    "family": "gpt-realtime",
    "modality": {
      "input": [
        "audio",
        "text"
      ],
      "output": [
        "audio",
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "gpt-realtime-1-5",
    "vendor": "openai",
    "family": "gpt-realtime",
    "modality": {
      "input": [
        "audio",
        "text"
      ],
      "output": [
        "audio",
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-realtime-1.5"
    ]
  },
  {
    "id": "gpt-audio-1-5",
    "vendor": "openai",
    "family": "gpt-audio",
    "modality": {
      "input": [
        "audio",
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gpt-audio-1.5"
    ]
  },
  {
    "id": "whisper-1",
    "vendor": "openai",
    "family": "whisper",
    "modality": {
      "input": [
        "audio"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "whisper",
      "openai/whisper-1"
    ]
  },
  {
    "id": "tts-1",
    "vendor": "openai",
    "family": "tts",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "tts-1-hd",
    "vendor": "openai",
    "family": "tts",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "omni-moderation",
    "vendor": "openai",
    "family": "moderation",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32768,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "gpt-oss-120b",
    "vendor": "openai",
    "family": "gpt-oss",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "gpt-oss-20b",
    "vendor": "openai",
    "family": "gpt-oss",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "claude-opus-4-7",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-opus-4.7",
      "anthropic/claude-opus-4-7"
    ]
  },
  {
    "id": "claude-sonnet-4-6",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 64000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-sonnet-4.6",
      "anthropic/claude-sonnet-4-6"
    ]
  },
  {
    "id": "claude-haiku-4-5",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 64000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-haiku-4.5",
      "claude-haiku-4-5-20251001",
      "anthropic/claude-haiku-4-5"
    ]
  },
  {
    "id": "claude-opus-4-6",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-opus-4.6"
    ]
  },
  {
    "id": "claude-sonnet-4-5",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 64000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-sonnet-4.5",
      "claude-sonnet-4-5-20250929"
    ]
  },
  {
    "id": "claude-opus-4-5",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 64000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-opus-4.5",
      "claude-opus-4-5-20251101"
    ]
  },
  {
    "id": "claude-opus-4-1",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "claude-opus-4.1",
      "claude-opus-4-1-20250805"
    ]
  },
  {
    "id": "claude-sonnet-4",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 64000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "deprecated",
    "aliases": [
      "claude-sonnet-4-0",
      "claude-sonnet-4-20250514"
    ]
  },
  {
    "id": "claude-opus-4",
    "vendor": "anthropic",
    "family": "claude",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "deprecated",
    "aliases": [
      "claude-opus-4-0",
      "claude-opus-4-20250514"
    ]
  },
  {
    "id": "gemini-3-5-flash",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gemini-3.5-flash"
    ]
  },
  {
    "id": "gemini-3-1-pro-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 2000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "preview",
    "aliases": [
      "gemini-3.1-pro-preview"
    ]
  },
  {
    "id": "gemini-3-flash-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "gemini-3-1-flash-lite",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gemini-3.1-flash-lite"
    ]
  },
  {
    "id": "gemini-3-1-flash-lite-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-3.1-flash-lite-preview"
    ]
  },
  {
    "id": "gemini-3-1-flash-live-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "audio",
        "text"
      ],
      "output": [
        "audio",
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-3.1-flash-live-preview"
    ]
  },
  {
    "id": "gemini-3-1-flash-tts-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-3.1-flash-tts-preview"
    ]
  },
  {
    "id": "gemini-3-1-flash-image-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-3.1-flash-image-preview",
      "nano-banana-2",
      "nano-banana-2-preview"
    ]
  },
  {
    "id": "gemini-3-pro-image-preview",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "preview",
    "aliases": [
      "gemini-3-pro-image-preview",
      "nano-banana-pro",
      "nano-banana-pro-preview"
    ]
  },
  {
    "id": "gemini-2-5-pro",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 2000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gemini-2.5-pro"
    ]
  },
  {
    "id": "gemini-2-5-flash",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "gemini-2.5-flash"
    ]
  },
  {
    "id": "gemini-2-5-flash-lite",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gemini-2.5-flash-lite"
    ]
  },
  {
    "id": "gemini-2-5-flash-image",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "gemini-2.5-flash-image",
      "nano-banana"
    ]
  },
  {
    "id": "gemini-2-5-flash-preview-tts",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-2.5-flash-preview-tts"
    ]
  },
  {
    "id": "gemini-2-5-pro-preview-tts",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-2.5-pro-preview-tts"
    ]
  },
  {
    "id": "gemini-2-5-flash-native-audio-preview-12-2025",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "audio",
        "text"
      ],
      "output": [
        "audio",
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "gemini-2.5-flash-native-audio-preview-12-2025"
    ]
  },
  {
    "id": "gemini-2-5-computer-use-preview-10-2025",
    "vendor": "google",
    "family": "gemini",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "preview",
    "aliases": [
      "gemini-2.5-computer-use-preview-10-2025"
    ]
  },
  {
    "id": "imagen-4",
    "vendor": "google",
    "family": "imagen",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 2048,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "veo-3-1-generate-preview",
    "vendor": "google",
    "family": "veo",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "veo-3.1-generate-preview"
    ]
  },
  {
    "id": "veo-3-1-lite-generate-preview",
    "vendor": "google",
    "family": "veo",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "veo-3.1-lite-generate-preview"
    ]
  },
  {
    "id": "lyria-3-pro-preview",
    "vendor": "google",
    "family": "lyria",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "lyria-3-clip-preview",
    "vendor": "google",
    "family": "lyria",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "lyria-realtime-exp",
    "vendor": "google",
    "family": "lyria",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "deepseek-v4-flash",
    "vendor": "deepseek",
    "family": "deepseek",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "deepseek-chat",
      "deepseek-reasoner"
    ]
  },
  {
    "id": "deepseek-v4-pro",
    "vendor": "deepseek",
    "family": "deepseek",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "grok-4-3",
    "vendor": "xai",
    "family": "grok",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "grok-4.3",
      "xai/grok-4.3"
    ]
  },
  {
    "id": "grok-4-20-0309-reasoning",
    "vendor": "xai",
    "family": "grok",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "grok-4.20-0309-reasoning"
    ]
  },
  {
    "id": "grok-4-20-0309-non-reasoning",
    "vendor": "xai",
    "family": "grok",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "grok-4.20-0309-non-reasoning"
    ]
  },
  {
    "id": "grok-4-20-multi-agent-0309",
    "vendor": "xai",
    "family": "grok",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 2000000,
      "max_output_tokens": 65536,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "grok-4.20-multi-agent-0309"
    ]
  },
  {
    "id": "grok-build-0-1",
    "vendor": "xai",
    "family": "grok-build",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "grok-build-0.1"
    ]
  },
  {
    "id": "grok-imagine-image",
    "vendor": "xai",
    "family": "grok-imagine",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "grok-imagine-image-quality",
    "vendor": "xai",
    "family": "grok-imagine",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "grok-imagine-video",
    "vendor": "xai",
    "family": "grok-imagine",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen3-6-plus",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "qwen3.6-plus"
    ]
  },
  {
    "id": "qwen3-6-max-preview",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "preview",
    "aliases": [
      "qwen3.6-max-preview"
    ]
  },
  {
    "id": "qwen3-max",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen3-max-preview"
    ]
  },
  {
    "id": "qwen3-5-plus",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "qwen3.5-plus",
      "qwen-plus-latest"
    ]
  },
  {
    "id": "qwen3-5-flash",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen3.5-flash"
    ]
  },
  {
    "id": "qwen-plus",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-turbo",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-max",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-long-latest",
    "vendor": "alibaba",
    "family": "qwen",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 10000000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen3-coder-plus",
    "vendor": "alibaba",
    "family": "qwen-coder",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen3-coder-flash",
    "vendor": "alibaba",
    "family": "qwen-coder",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen3-vl-plus",
    "vendor": "alibaba",
    "family": "qwen-vl",
    "modality": {
      "input": [
        "text",
        "image",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen3-vl-flash",
    "vendor": "alibaba",
    "family": "qwen-vl",
    "modality": {
      "input": [
        "text",
        "image",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-vl-max",
    "vendor": "alibaba",
    "family": "qwen-vl",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-vl-plus",
    "vendor": "alibaba",
    "family": "qwen-vl",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwq",
    "vendor": "alibaba",
    "family": "qwq",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qvq",
    "vendor": "alibaba",
    "family": "qvq",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-image-2-0-pro",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen-image-2.0-pro",
      "qwen-image-2.0-pro-2026-03-03"
    ]
  },
  {
    "id": "qwen-image-2-0",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen-image-2.0",
      "qwen-image-2.0-2026-03-03"
    ]
  },
  {
    "id": "qwen-image-max",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen-image-max-2025-12-30"
    ]
  },
  {
    "id": "qwen-image-plus",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "qwen-image-plus-2026-01-09"
    ]
  },
  {
    "id": "qwen-image",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "qwen-image-edit",
    "vendor": "alibaba",
    "family": "qwen-image",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 1000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "wan2-5-t2v-preview",
    "vendor": "alibaba",
    "family": "wan",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "wan2.5-t2v-preview"
    ]
  },
  {
    "id": "wan2-5-i2v-preview",
    "vendor": "alibaba",
    "family": "wan",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": [
      "wan2.5-i2v-preview"
    ]
  },
  {
    "id": "wan2-2-s2v",
    "vendor": "alibaba",
    "family": "wan",
    "modality": {
      "input": [
        "audio",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "wan2.2-s2v"
    ]
  },
  {
    "id": "kimi-k2-6",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "kimi-k2.6",
      "moonshotai/kimi-k2.6"
    ]
  },
  {
    "id": "kimi-k2-5",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "kimi-k2.5",
      "moonshotai/kimi-k2.5"
    ]
  },
  {
    "id": "kimi-k2-0905-preview",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "kimi-k2-0711-preview",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "kimi-k2-turbo-preview",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "kimi-k2-thinking",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "kimi-k2-thinking-turbo",
    "vendor": "moonshot",
    "family": "kimi",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "moonshot-v1-128k",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "moonshot-v1-32k",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "moonshot-v1-8k",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 8000,
      "max_output_tokens": 4096,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "moonshot-v1-128k-vision-preview",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "moonshot-v1-32k-vision-preview",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "moonshot-v1-8k-vision-preview",
    "vendor": "moonshot",
    "family": "moonshot-v1",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 8000,
      "max_output_tokens": 4096,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "preview",
    "aliases": []
  },
  {
    "id": "glm-5-1",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "glm-5.1"
    ]
  },
  {
    "id": "glm-5",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "glm-5-turbo",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "glm-4-7",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "glm-4.7"
    ]
  },
  {
    "id": "glm-4-7-flash",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.7-flash"
    ]
  },
  {
    "id": "glm-4-7-flashx",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.7-flashx"
    ]
  },
  {
    "id": "glm-4-6",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "glm-4.6"
    ]
  },
  {
    "id": "glm-4-5",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "glm-4.5"
    ]
  },
  {
    "id": "glm-4-5-air",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.5-air"
    ]
  },
  {
    "id": "glm-4-5-airx",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.5-airx"
    ]
  },
  {
    "id": "glm-4-5-x",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.5-x"
    ]
  },
  {
    "id": "glm-4-5-flash",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.5-flash"
    ]
  },
  {
    "id": "glm-4-32b-0414-128k",
    "vendor": "zhipu",
    "family": "glm",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "glm-5v-turbo",
    "vendor": "zhipu",
    "family": "glm-v",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "glm-4-6v",
    "vendor": "zhipu",
    "family": "glm-v",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "glm-4.6v"
    ]
  },
  {
    "id": "glm-4-6v-flash",
    "vendor": "zhipu",
    "family": "glm-v",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.6v-flash"
    ]
  },
  {
    "id": "glm-4-6v-flashx",
    "vendor": "zhipu",
    "family": "glm-v",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.6v-flashx"
    ]
  },
  {
    "id": "glm-4-5v",
    "vendor": "zhipu",
    "family": "glm-v",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "glm-4.5v"
    ]
  },
  {
    "id": "autoglm-phone-multilingual",
    "vendor": "zhipu",
    "family": "autoglm",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "mistral-large-3",
    "vendor": "mistral",
    "family": "mistral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "mistral-large-latest"
    ]
  },
  {
    "id": "mistral-medium-3-5",
    "vendor": "mistral",
    "family": "mistral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "mistral-medium-latest",
      "mistral-medium-3.5"
    ]
  },
  {
    "id": "mistral-medium-3-1",
    "vendor": "mistral",
    "family": "mistral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "mistral-medium-3.1"
    ]
  },
  {
    "id": "mistral-small-4",
    "vendor": "mistral",
    "family": "mistral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "mistral-small-latest"
    ]
  },
  {
    "id": "ministral-3-14b",
    "vendor": "mistral",
    "family": "ministral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ministral-3-8b",
    "vendor": "mistral",
    "family": "ministral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ministral-3-3b",
    "vendor": "mistral",
    "family": "ministral",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "devstral-2",
    "vendor": "mistral",
    "family": "devstral",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "magistral-medium-1-2",
    "vendor": "mistral",
    "family": "magistral",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "magistral-medium-1.2"
    ]
  },
  {
    "id": "codestral",
    "vendor": "mistral",
    "family": "codestral",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "voxtral-tts",
    "vendor": "mistral",
    "family": "voxtral",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "voxtral-mini-transcribe-2",
    "vendor": "mistral",
    "family": "voxtral",
    "modality": {
      "input": [
        "audio"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "voxtral-mini-transcribe-realtime",
    "vendor": "mistral",
    "family": "voxtral",
    "modality": {
      "input": [
        "audio"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "voxtral-small",
    "vendor": "mistral",
    "family": "voxtral",
    "modality": {
      "input": [
        "text",
        "audio"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ocr-3",
    "vendor": "mistral",
    "family": "ocr",
    "modality": {
      "input": [
        "image",
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "mistral-moderation-2",
    "vendor": "mistral",
    "family": "moderation",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 32000,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "doubao-seed-2-0-pro",
    "vendor": "bytedance",
    "family": "doubao-seed",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "doubao-seed-2.0-pro",
      "doubao-seed-2-0-pro-260215"
    ]
  },
  {
    "id": "doubao-seed-2-0-lite",
    "vendor": "bytedance",
    "family": "doubao-seed",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "doubao-seed-2.0-lite"
    ]
  },
  {
    "id": "doubao-seed-2-0-mini",
    "vendor": "bytedance",
    "family": "doubao-seed",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 8192,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "doubao-seed-2.0-mini"
    ]
  },
  {
    "id": "doubao-seed-2-0-code",
    "vendor": "bytedance",
    "family": "doubao-seed",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "doubao-seed-2.0-code"
    ]
  },
  {
    "id": "doubao-seed-1-6-vision",
    "vendor": "bytedance",
    "family": "doubao-seed",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 128000,
      "max_output_tokens": 16384,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "doubao-seed-1.6-vision",
      "doubao-seed-1-6-vision-250815"
    ]
  },
  {
    "id": "seedance-2",
    "vendor": "bytedance",
    "family": "seedance",
    "modality": {
      "input": [
        "text",
        "image",
        "audio"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "seedance-2.0"
    ]
  },
  {
    "id": "seedance-2-fast",
    "vendor": "bytedance",
    "family": "seedance",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "seedance-2.0-fast"
    ]
  },
  {
    "id": "minimax-m2-7",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.7"
    ]
  },
  {
    "id": "minimax-m2-7-highspeed",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.7-highspeed"
    ]
  },
  {
    "id": "minimax-m2-5",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.5"
    ]
  },
  {
    "id": "minimax-m2-5-highspeed",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.5-highspeed"
    ]
  },
  {
    "id": "minimax-m2-1",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.1"
    ]
  },
  {
    "id": "minimax-m2-1-highspeed",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "minimax-m2.1-highspeed"
    ]
  },
  {
    "id": "minimax-m2",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 128000,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "minimax-m1",
    "vendor": "minimax",
    "family": "minimax-m",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 200000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "minimax-text-01",
    "vendor": "minimax",
    "family": "minimax-text",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "minimax-vl-01",
    "vendor": "minimax",
    "family": "minimax-vl",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "minimax-hailuo-02",
    "vendor": "minimax",
    "family": "hailuo",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "hailuo-02"
    ]
  },
  {
    "id": "minimax-hailuo-02-pro",
    "vendor": "minimax",
    "family": "hailuo",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video",
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "hailuo-02-pro"
    ]
  },
  {
    "id": "minimax-hailuo-2-3",
    "vendor": "minimax",
    "family": "hailuo",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "minimax-hailuo-2.3"
    ]
  },
  {
    "id": "t2v-01-director",
    "vendor": "minimax",
    "family": "hailuo",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "i2v-01-director",
    "vendor": "minimax",
    "family": "hailuo",
    "modality": {
      "input": [
        "image",
        "text"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "speech-2-8",
    "vendor": "minimax",
    "family": "speech",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "speech-2.8"
    ]
  },
  {
    "id": "speech-2-6",
    "vendor": "minimax",
    "family": "speech",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "speech-2.6"
    ]
  },
  {
    "id": "speech-2-5",
    "vendor": "minimax",
    "family": "speech",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 8192,
      "supports_streaming": true,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "speech-2.5"
    ]
  },
  {
    "id": "music-2-6",
    "vendor": "minimax",
    "family": "music",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "audio"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "music-2.6"
    ]
  },
  {
    "id": "image-01",
    "vendor": "minimax",
    "family": "image",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "image"
      ]
    },
    "capabilities": {
      "context_length": 4096,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "mimo-v2-5-pro",
    "vendor": "xiaomi",
    "family": "mimo",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "mimo-v2.5-pro"
    ]
  },
  {
    "id": "mimo-v2-5",
    "vendor": "xiaomi",
    "family": "mimo",
    "modality": {
      "input": [
        "text",
        "image",
        "audio",
        "video"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 1000000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": true
    },
    "status": "stable",
    "aliases": [
      "mimo-v2.5"
    ]
  },
  {
    "id": "mimo-v2-flash",
    "vendor": "xiaomi",
    "family": "mimo",
    "modality": {
      "input": [
        "text"
      ],
      "output": [
        "text"
      ]
    },
    "capabilities": {
      "context_length": 256000,
      "max_output_tokens": 32768,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ray-2",
    "vendor": "lumalabs",
    "family": "ray",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ray-3",
    "vendor": "lumalabs",
    "family": "ray",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": []
  },
  {
    "id": "ray-3-14",
    "vendor": "lumalabs",
    "family": "ray",
    "modality": {
      "input": [
        "text",
        "image"
      ],
      "output": [
        "video"
      ]
    },
    "capabilities": {
      "context_length": 0,
      "supports_streaming": false,
      "supports_tools": false,
      "supports_thinking": false
    },
    "status": "stable",
    "aliases": [
      "ray-3.14"
    ]
  }
] as const
