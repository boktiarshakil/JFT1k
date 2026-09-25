[![API Docs](https://s3plus.meituan.net/elsa-multimedia-data/longcat/logo-group.svg)API Docs](https://longcat.chat/platform/docs/)

[LongCat API Platform](https://longcat.chat/platform/)

LanguagesLanguages

- [English](https://longcat.chat/platform/docs/APIDocs.html)
- [简体中文](https://longcat.chat/platform/docs/zh/APIDocs.html)

[LongCat API Platform](https://longcat.chat/platform/)

LanguagesLanguages

- [English](https://longcat.chat/platform/docs/APIDocs.html)
- [简体中文](https://longcat.chat/platform/docs/zh/APIDocs.html)

- [Quick Start](https://longcat.chat/platform/docs/)
- [API Docs](https://longcat.chat/platform/docs/APIDocs.html)
  - [Overview](https://longcat.chat/platform/docs/APIDocs.html#overview)
  - [Base URLs](https://longcat.chat/platform/docs/APIDocs.html#base-urls)
  - [Authentication](https://longcat.chat/platform/docs/APIDocs.html#authentication)
  - [Endpoints](https://longcat.chat/platform/docs/APIDocs.html#endpoints)
    - [Chat Completions](https://longcat.chat/platform/docs/APIDocs.html#chat-completions)
    - [Anthropic Messages](https://longcat.chat/platform/docs/APIDocs.html#anthropic-messages)
    - [Omni-Modal Chat Completions](https://longcat.chat/platform/docs/APIDocs.html#omni-modal-chat-completions)
  - [Error Responses](https://longcat.chat/platform/docs/APIDocs.html#error-responses)
    - [HTTP Status Codes](https://longcat.chat/platform/docs/APIDocs.html#http-status-codes)
    - [Error Response Format](https://longcat.chat/platform/docs/APIDocs.html#error-response-format)
    - [Error Types and Codes](https://longcat.chat/platform/docs/APIDocs.html#error-types-and-codes)
    - [Example Error Responses](https://longcat.chat/platform/docs/APIDocs.html#example-error-responses)
  - [Rate Limiting](https://longcat.chat/platform/docs/APIDocs.html#rate-limiting)
  - [SDK Compatibility](https://longcat.chat/platform/docs/APIDocs.html#sdk-compatibility)
  - [Examples](https://longcat.chat/platform/docs/APIDocs.html#examples)
    - [Using with OpenAI Python SDK](https://longcat.chat/platform/docs/APIDocs.html#using-with-openai-python-sdk)
    - [Using with Anthropic Python SDK](https://longcat.chat/platform/docs/APIDocs.html#using-with-anthropic-python-sdk)
    - [Using with cURL](https://longcat.chat/platform/docs/APIDocs.html#using-with-curl)
- [Claude Code Configuration](https://longcat.chat/platform/docs/ClaudeCode.html)
- [OpenClaw Configuration](https://longcat.chat/platform/docs/OpenClaw.html)
- [FAQ](https://longcat.chat/platform/docs/FAQ.html)
- [Change Log](https://longcat.chat/platform/docs/ChangeLog.html)

# [LongCat API Platform Interface Documentation](https://longcat.chat/platform/docs/APIDocs.html\#longcat-api-platform-interface-documentation)

## [Overview](https://longcat.chat/platform/docs/APIDocs.html\#overview)

The LongCat API Platform provides AI model proxy services exclusively for the LongCat series models, while maintaining compatibility with OpenAI and Anthropic API formats. This documentation follows standard API format conventions.

## [Base URLs](https://longcat.chat/platform/docs/APIDocs.html\#base-urls)

```
Production Endpoint: https://api.longcat.chat
```

## [Authentication](https://longcat.chat/platform/docs/APIDocs.html\#authentication)

All API requests require authentication using an API key in the Authorization header:

```
Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F
```

## [Endpoints](https://longcat.chat/platform/docs/APIDocs.html\#endpoints)

### [Chat Completions](https://longcat.chat/platform/docs/APIDocs.html\#chat-completions)

#### [POST /openai/v1/chat/completions](https://longcat.chat/platform/docs/APIDocs.html\#post-openai-v1-chat-completions)

Create a chat completion using OpenAI-compatible format.

**Headers**

- `Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F` (required)
- `Content-Type: application/json`

**Request Body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | Model identifier (only LongCat-Flash-Chat is supported) |
| `messages` | array | Yes | Array of message objects, only text inputs are allowed |
| `stream` | boolean | No | Whether to stream the response (default: false) |
| `max_tokens` | integer | No | Maximum number of tokens to generate, the default value is 131072 for LongCat-Flash-Chat, and 262144 for other models. LongCat-Flash-Chat, LongCat-Flash-Thinking and LongCat-Flash-Thinking-2601 are supported up to 262144 tokens; LongCat-Flash-Lite is supported up to 327680 tokens |
| `temperature` | number | No | Sampling temperature between 0 and 1 |
| `top_p` | number | No | Nucleus sampling parameter |

**Message Object**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | Yes | The role of the message author. Must be one of: <br>• `system` \- Sets the behavior and context for the assistant <br>• `user` \- Messages from the human user <br>• `assistant` \- Messages from the AI assistant (for conversation history) |
| `content` | string | Yes | The message content. A string for simple text messages. |

**Example Request**

```
{
  "model": "LongCat-Flash-Chat",
  "messages": [\
    {\
      "role": "system",\
      "content": "You are a helpful assistant."\
    },\
    {\
      "role": "user",\
      "content": "Hello, how are you?"\
    }\
  ],
  "stream": false,
  "max_tokens": 150,
  "temperature": 0.7
}
```

**Example Request(Thinking)**

```
{
  "model": "LongCat-Flash-Thinking-2601",
  "messages": [\
    {\
      "role": "system",\
      "content": "You are a helpful assistant."\
    },\
    {\
      "role": "user",\
      "content": "Hello, how are you?"\
    }\
  ],
  "stream": false,
  "max_tokens": 1500,
  "temperature": 0.7
}
```

**Response (Non-streaming)**

```
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "LongCat-Flash-Chat",
  "choices": [\
    {\
      "index": 0,\
      "message": {\
        "role": "assistant",\
        "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"\
      },\
      "finish_reason": "stop"\
    }\
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  }
}
```

**Response (Streaming)**

When `stream: true`, the response is returned as Server-Sent Events (SSE):

```
Content-Type: text/event-stream

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"LongCat-Flash-Chat","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"LongCat-Flash-Chat","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"LongCat-Flash-Chat","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: [DONE]
```

### [Anthropic Messages](https://longcat.chat/platform/docs/APIDocs.html\#anthropic-messages)

#### [POST /anthropic/v1/messages](https://longcat.chat/platform/docs/APIDocs.html\#post-anthropic-v1-messages)

Create a message using Anthropic's Claude API format.

**Headers**

- `Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F` (required)
- `Content-Type: application/json`

**Request Body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | string | Yes | The Claude model to use |
| `messages` | array | Yes | Array of message objects |
| `max_tokens` | integer | No | Maximum number of tokens to generate |
| `stream` | boolean | No | Whether to stream the response (default: false) |
| `temperature` | number | No | Sampling temperature between 0 and 1 |
| `top_p` | number | No | Nucleus sampling parameter |
| `system` | string | No | System message to set context |

**Message Object**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | Yes | The role of the message author. Must be one of: <br>• `user` \- Messages from the human user <br>• `assistant` \- Messages from Claude (for conversation history) <br>Note: System messages are passed separately via the `system` parameter |
| `content` | string | Yes | The message content. A string for text-only messages |

**Example Request**

```
{
  "model": "LongCat-Flash-Chat",
  "max_tokens": 1000,
  "messages": [\
    {\
      "role": "user",\
      "content": "Hello, LongCat"\
    }\
  ],
  "stream": false,
  "temperature": 0.7
}
```

**Example Request(Thinking)**

```
{
  "model": "LongCat-Flash-Thinking-2601",
  "messages": [\
    {\
      "role": "user",\
      "content": "Hello, how are you?"\
    }\
  ],
  "system": "You are a helpful assistant.",
  "stream": false,
  "max_tokens": 1500,
  "temperature": 0.7
}
```

**Response (Non-streaming)**

```
{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [\
    {\
      "type": "text",\
      "text": "Hello! How can I help you today?"\
    }\
  ],
  "model": "LongCat-Flash-Chat",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 8
  }
}
```

**Response (Streaming)**

When `stream: true`, the response follows Anthropic's SSE format:

```
Content-Type: text/event-stream

event: message_start
data: {"type": "message_start", "message": {"id": "msg_123", "type": "message", "role": "assistant", "content": [], "model": "LongCat-Flash-Chat", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 10, "output_tokens": 0}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": null}, "usage": {"output_tokens": 8}}

event: message_stop
data: {"type": "message_stop"}
```

### [Omni-Modal Chat Completions](https://longcat.chat/platform/docs/APIDocs.html\#omni-modal-chat-completions)

#### [POST /openai/v1/chat/completions](https://longcat.chat/platform/docs/APIDocs.html\#post-openai-v1-chat-completions-1)

Create a chat completion using omni-modal format supporting mixed input and output of text, audio, images, and video, generating text or audio responses.

**Headers**

- `Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F` (required)
- `Content-Type: application/json`

**Request Body**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `session_id` | string | No | User-provided parameter that must be unique; used to distinguish each request's unique identifier. Generates by default when not provided by user. UUID is recommended. |
| `model` | string | Yes | The name of the model to call |
| `messages` | array | Yes | List of conversation information to be passed to the model as prompt input in JSON array format |
| `max_tokens` | integer | No | Maximum tokens for model output, default value is 4096, range: (1, 8192\] |
| `temperature` | number | No | Sampling temperature controlling randomness of output, must be positive. Range: (0.0, 2.0\], default: 1. Larger values make output more random and creative; smaller values make output more stable or deterministic |
| `top_p` | number | No | An alternative sampling method called nucleus sampling. Range: (0.0, 1.0\], default: 0.1. Model considers tokens with top\_p probability mass |
| `top_k` | integer | No | Default value: 1, range: \[1, 50\] |
| `text_repetition_penalty` | number | No | Text repetition penalty factor to reduce repetition in text. Default: 1.1. Typically between 1.0 and 2.0, where 1.0 means no penalty |
| `audio_repetition_penalty` | number | No | Audio repetition penalty factor, default: 1.2. Typically between 1.0 and 2.0 |
| `audio` | AudioConfig | No | Audio configuration. Uses default configuration when empty |
| `output_modalities` | array | No | Output modalities, can be \["text"\] or \["text","audio"\], default: \["text","audio"\] |
| `stream` | boolean | No | Default: true. If true, model returns generated content in chunks via standard Event Stream. Returns data: \[DONE\] when stream ends. If false, returns segmented content in JSON format |

**AudioConfig Audio Configuration Parameters**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `voice` | string | No | Voice setting, default: yangguangtianmei, available options: yangguangtianmei, linjiajiejie, zhixingxuejie, meishuman, meishuqing, meifannan, huolixuedi, linjiananhai, guiguozongcai, miaolingshaonv, meishumu |
| `speed` | integer | No | Speech speed, range: (0-100\], default: 50 |
| `volume` | integer | No | Volume, range: (0-100\], default: 50. 100 is maximum volume corresponding to 0dBFS, 50 corresponds to -6dBFS |
| `output_audio_samplerate` | integer | No | Output audio sample rate, supports 8000, 16000, 24000, default: 24000 |

**Message Object Structure**

Each object in the message array contains `role` and `content` fields. Different format requirements based on role type:

**System Message Format**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | Yes | Message author role, should be `system` in this case |
| `content` | array | Yes | Message content array containing text objects |

**User Message Format**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | Yes | Message author role, should be `user` in this case |
| `content` | array | Yes | Message content array, can contain text, input\_audio, input\_image, input\_video and other types |

**content Array Element Description**

- **Text Content** (type: text)

  - `type`: "text" (required)
  - `text`: Text content string (required)
- **Audio Content** (type: input\_audio)

  - `type`: "input\_audio" (required)
  - `input_audio`: Audio object (required)
    - `data`: Base64 encoded string or URL of audio file (required)
    - `type`: "base64" or "url" (required)
    - `format`: Audio file format, supports pcm, wav, mp3, pcm16 (required)
    - `sample_rate`: Input audio sample rate, supports 8000 and 16000, required when format=pcm16 (optional otherwise)
  - Supported audio formats: WAV, MP3, PCM16
- **Image Content** (type: input\_image)

  - `type`: "input\_image" (required)
  - `input_image`: Image object (required)
    - `data`: Base64 encoded string or URL array of image (required)
    - `type`: "base64" or "url" (required)
    - `image_timesecond`: Image time relative to session in seconds, default 0 (optional)
  - Supported image formats: JPEG, PNG, TIFF, BMP, WEBP
- **Video Content** (type: input\_video)

  - `type`: "input\_video" (required)
  - `input_video`: Video object (required)
    - `data`: Base64 encoded string or URL of video (required)
    - `type`: "base64" or "url" (required)
  - Supported video formats: MP4, AVI, MOV

**Assistant Message Format**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | Yes | Message author role, should be `assistant` in this case |
| `content` | array | Yes | Message content, Object content only supports text modality |

**Example Request (Text Only)**

```
{
  "model": "LongCat-Flash-Omni-2603",
  "messages": [\
    {\
      "role": "system",\
      "content": [\
        {\
          "type": "text",\
          "text": "You are a helpful assistant"\
        }\
      ]\
    },\
    {\
      "role": "user",\
      "content": [\
        {\
          "type": "text",\
          "text": "Who are you?"\
        }\
      ]\
    }\
  ],
  "sessionId": "13131313121312313",
  "stream": false,
  "topP": 0.1,
  "topK": 1,
  "textRepetitionPenalty": 1,
  "audioRepetitionPenalty": 1.1,
  "inferenceCount": 1,
  "output_modalities":["text","audio"]
}
```

**Example Request (Text + Audio Input)**

```
{
  "model": "LongCat-Flash-Omni-2603",
  "messages": [\
    {\
      "role": "system",\
      "content": [\
        {\
          "type": "text",\
          "text": "You are a helpful assistant"\
        }\
      ]\
    },\
    {\
      "role": "user",\
      "content": [\
        {\
          "type": "input_audio",\
          "input_audio":{\
            "type" : "url",\
            "data" : "https://msstest.sankuai.com/avatar-mgrplatform/BAC009S0764W0495.wav",\
            "format" : "wav"\
          }\
        },\
        {\
          "type": "text",\
          "text": "Understand this audio"\
        }\
      ]\
    }\
  ],
  "sessionId": "1231313131",
  "stream": false,
  "topP": 0.1,
  "topK": 1,
  "textRepetitionPenalty": 1,
  "audioRepetitionPenalty": 1.1,
  "inferenceCount": 1,
  "output_modalities":["text","audio"]
}
```

**Example Request (Text + Image Input)**

```
{
  "model": "LongCat-Flash-Omni-2603",
  "messages": [\
    {\
      "role": "system",\
      "content": [\
        {\
          "type": "text",\
          "text": "You are a helpful assistant"\
        }\
      ]\
    },\
    {\
      "role": "user",\
      "content": [\
        {\
          "type": "input_image",\
          "input_image":{\
            "type" : "url",\
            "data" : ["https://msstest.sankuai.com/avatar-mgrplatform/origin_image_113.png"]\
          }\
        },\
        {\
          "type": "text",\
          "text": "What do you see?"\
        }\
      ]\
    }\
  ],
  "sessionId": "1231313131",
  "stream": false,
  "topP": 0.1,
  "topK": 1,
  "textRepetitionPenalty": 1,
  "audioRepetitionPenalty": 1.1,
  "inferenceCount": 1,
  "output_modalities":["text","audio"]
}
```

**Example Request (Text + Video Input)**

```
{
  "model": "LongCat-Flash-Omni-2603",
  "messages": [\
    {\
      "role": "system",\
      "content": [\
        {\
          "type": "text",\
          "text": "You are a helpful assistant"\
        }\
      ]\
    },\
    {\
      "role": "user",\
      "content": [\
        {\
          "type": "input_video",\
          "input_video":{\
            "type" : "url",\
            "data" : "https://msstest.sankuai.com/avatar-mgrplatform/video_sample.mp4"\
          }\
        },\
        {\
          "type": "text",\
          "text": "What's in this video?"\
        }\
      ]\
    }\
  ],
  "sessionId": "1231313131",
  "stream": false,
  "topP": 0.1,
  "topK": 1,
  "textRepetitionPenalty": 1,
  "audioRepetitionPenalty": 1.1,
  "inferenceCount": 1,
  "output_modalities":["text","audio"]
}
```

**Response (Non-streaming)**

```
{
  "created": 1768206959,
  "model": "LongCat-Flash-Omni-2603",
  "choices": [\
    {\
      "index": 0,\
      "message": {\
        "role": "assistant",\
        "content": "I'm an AI assistant created by Meituan.",\
        "audio": "//NExAASIAP..."\
      },\
      "finish_reason": "stop"\
    }\
  ],
  "usage": {
    "completion_tokens": 20,
    "prompt_tokens": 10,
    "total_tokens": 30
  },
  "session_id": "13131313121312313"
}
```

**Response (Streaming)**

When `stream: true`, the response follows Server-Sent Events (SSE) format:

```
Content-Type: text/event-stream

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":0,"delta":{"role":"assistant","content":"","audio":null,"type":"response.start","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":0,"prompt_tokens":0,"total_tokens":0},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":1,"delta":{"role":"assistant","content":"I'm an AI assistant","audio":null,"type":"response.text.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":5,"prompt_tokens":0,"total_tokens":5},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":2,"delta":{"role":"assistant","content":" created by Meituan.","audio":null,"type":"response.text.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":9,"prompt_tokens":0,"total_tokens":9},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":3,"delta":{"role":"assistant","content":null,"audio":null,"type":"response.text.done","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":9,"prompt_tokens":0,"total_tokens":9},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":4,"delta":{"role":"assistant","content":null,"audio":"//NExAASIAP...","type":"response.audio.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":100,"prompt_tokens":0,"total_tokens":100},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":5,"delta":{"role":"assistant","content":null,"audio":"//NExAASIAP...","type":"response.audio.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":150,"prompt_tokens":0,"total_tokens":150},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":6,"delta":{"role":"assistant","content":null,"audio":"//NExAASIAP...","type":"response.audio.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":200,"prompt_tokens":0,"total_tokens":200},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":7,"delta":{"role":"assistant","content":null,"audio":"//NExAASIAP...","type":"response.audio.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":null}],"usage":{"completion_tokens":250,"prompt_tokens":0,"total_tokens":250},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":8,"delta":{"role":"assistant","content":null,"audio":"//NExAASIAP...","type":"response.audio.delta","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":"{\"type\": \"abort\", \"message\": \"prev: AT_ST1, cur: ABORT, last_input: {'text_id': -5000000, 'semantic_id': tensor(2, device='cuda:0'), 'req_type': None}, context: {'req_type': 'chat', 'to_abort': True, 'tf_end': False, 'step': 59, 'rank': 0}\"}"}],"usage":{"completion_tokens":295,"prompt_tokens":0,"total_tokens":295},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":9,"delta":{"role":"assistant","content":null,"audio":null,"type":"response.audio_transcript.done","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":"{\"type\": \"abort\", \"message\": \"prev: AT_ST1, cur: ABORT, last_input: {'text_id': -5000000, 'semantic_id': tensor(2, device='cuda:0'), 'req_type': None}, context: {'req_type': 'chat', 'to_abort': True, 'tf_end': False, 'step': 59, 'rank': 0}\"}"}],"usage":{"completion_tokens":295,"prompt_tokens":0,"total_tokens":295},"session_id":"13131313121312313"}

data: {"created":1768206959,"model":"LongCat-Flash-Omni-2603","choices":[{"index":10,"delta":{"role":"assistant","content":null,"audio":null,"type":"response.audio.done","turnId":"turn_6QlZlbVk2o3CB91C6Kw9GA","responseId":"resp_5lrxrIMFkOIJsxHWqGXafb"},"finish_reason":"{\"type\": \"abort\", \"message\": \"prev: AT_ST1, cur: ABORT, last_input: {'text_id': -5000000, 'semantic_id': tensor(2, device='cuda:0'), 'req_type': None}, context: {'req_type': 'chat', 'to_abort': True, 'tf_end': False, 'step': 59, 'rank': 0}\"}"}],"usage":{"completion_tokens":295,"prompt_tokens":0,"total_tokens":295},"session_id":"13131313121312313"}

data: [DONE]
```

**Delta Type Description in Streaming Output**

| delta.type | Description |
| --- | --- |
| `text` | Text content delta |
| `audio.delta` | Audio data chunk of model response (base64 encoded) |
| `audio.done` | Model response audio completion signal |
| `audio_transcript.delta` | Model response audio transcription text delta |
| `audio_transcript.done` | Model response audio transcription complete, this message contains complete text data |
| `error` | Exception occurred during inference, e.g., downstream decoding failure |

## [Error Responses](https://longcat.chat/platform/docs/APIDocs.html\#error-responses)

The API uses conventional HTTP response codes to indicate success or failure:

### [HTTP Status Codes](https://longcat.chat/platform/docs/APIDocs.html\#http-status-codes)

| Status Code | Status Name | Description |
| --- | --- | --- |
| `200` | OK | Request successful |
| `400` | Bad Request | Invalid request parameters or malformed JSON |
| `401` | Unauthorized | Invalid or missing API key |
| `403` | Forbidden | API key doesn't have permission for the requested resource |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server encountered an unexpected condition |
| `502` | Bad Gateway | Invalid response from upstream server |
| `503` | Service Unavailable | Server temporarily unavailable |

### [Error Response Format](https://longcat.chat/platform/docs/APIDocs.html\#error-response-format)

All errors return a JSON object with the following structure:

```
{
  "error": {
    "message": "Human-readable error description",
    "type": "error_type_identifier",
    "code": "specific_error_code"
  }
}
```

### [Error Types and Codes](https://longcat.chat/platform/docs/APIDocs.html\#error-types-and-codes)

| Error Type | Error Code | HTTP Status | Description |
| --- | --- | --- | --- |
| `authentication_error` | `invalid_api_key` | 401 | Invalid API key provided |
| `permission_error` | `insufficient_quota` | 403 | API key has insufficient quota |
| `invalid_request_error` | `invalid_parameter` | 400 | Invalid parameter value |
| `invalid_request_error` | `invalid_json` | 400 | Invalid JSON format |
| `rate_limit_error` | `rate_limit_exceeded` | 429 | Too many requests in a short period |
| `server_error` | `internal_error` | 500 | Internal server error |

### [Example Error Responses](https://longcat.chat/platform/docs/APIDocs.html\#example-error-responses)

**Invalid API Key**

```
{
  "error": {
    "message": "Invalid API key provided",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

**Rate Limit Exceeded**

```
{
  "error": {
    "message": "Rate limit exceeded. Please try again in 60 seconds",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

## [Rate Limiting](https://longcat.chat/platform/docs/APIDocs.html\#rate-limiting)

Rate limits are enforced per API key. When exceeded, you'll receive a 429 status code.

## [SDK Compatibility](https://longcat.chat/platform/docs/APIDocs.html\#sdk-compatibility)

This API is designed to be compatible with:

- OpenAI Python SDK (for `/openai/` endpoints)
- Anthropic Python SDK (for `/anthropic/` endpoints)
- Any HTTP client that supports the respective API formats

## [Examples](https://longcat.chat/platform/docs/APIDocs.html\#examples)

### [Using with OpenAI Python SDK](https://longcat.chat/platform/docs/APIDocs.html\#using-with-openai-python-sdk)

```
import openai

# Configure for LongCat API
openai.api_base = "https://api.longcat.chat/openai"
openai.api_key = "your-api-key"

response = openai.ChatCompletion.create(
    model="LongCat-Flash-Chat",
    messages=[\
        {"role": "user", "content": "Hello!"}\
    ]
)
```

### [Using with Anthropic Python SDK](https://longcat.chat/platform/docs/APIDocs.html\#using-with-anthropic-python-sdk)

```
import anthropic

# Configure for LongCat API
client = anthropic.Anthropic(
    api_key="Bearer your-api-key",
    base_url="https://api.longcat.chat"
)
default_headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer your-api-key",
    }

message = client.messages.create(
    model="LongCat-Flash-Chat",
    max_tokens=150,
    messages=[\
        {"role": "user", "content": "Hello, LongCat!"}\
    ]
)
```

### [Using with cURL](https://longcat.chat/platform/docs/APIDocs.html\#using-with-curl)

```
# OpenAI-style request
curl -X POST https://api.longcat.chat/openai/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "LongCat-Flash-Chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Anthropic-style request
curl -X POST https://api.longcat.chat/anthropic/v1/messages \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "LongCat-Flash-Chat",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

* * *

> 📋 **Need Help?** Check out our comprehensive [FAQ](https://longcat.chat/platform/docs/FAQ.html) for common questions and troubleshooting guide.

Last Updated: 3/10/26, 4:00 AM

Contributors: zhuqi09, wb\_changzhe02

[Prev\\
\\
Quick Start](https://longcat.chat/platform/docs/) [Next \\
\\
Claude Code Configuration](https://longcat.chat/platform/docs/ClaudeCode.html)