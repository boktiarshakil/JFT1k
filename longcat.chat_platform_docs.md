[![API Docs](https://s3plus.meituan.net/elsa-multimedia-data/longcat/logo-group.svg)API Docs](https://longcat.chat/platform/docs/)

[LongCat API Platform](https://longcat.chat/platform/)

LanguagesLanguages

- [English](https://longcat.chat/platform/docs/)
- [简体中文](https://longcat.chat/platform/docs/zh/)

[LongCat API Platform](https://longcat.chat/platform/)

LanguagesLanguages

- [English](https://longcat.chat/platform/docs/)
- [简体中文](https://longcat.chat/platform/docs/zh/)

- [Quick Start](https://longcat.chat/platform/docs/)
  - [How to Get an API Key?](https://longcat.chat/platform/docs/#how-to-get-an-api-key)
    - [Register an Account](https://longcat.chat/platform/docs/#register-an-account)
    - [Create Your API Key](https://longcat.chat/platform/docs/#create-your-api-key)
  - [Supported API Types](https://longcat.chat/platform/docs/#supported-api-types)
    - [OpenAI API Format](https://longcat.chat/platform/docs/#openai-api-format)
    - [Anthropic API Format](https://longcat.chat/platform/docs/#anthropic-api-format)
    - [Endpoints](https://longcat.chat/platform/docs/#endpoints)
    - [Supported Models](https://longcat.chat/platform/docs/#supported-models)
  - [How to Get Usage Quota?](https://longcat.chat/platform/docs/#how-to-get-usage-quota)
    - [Daily Free Quota](https://longcat.chat/platform/docs/#daily-free-quota)
    - [Ways to Request More Free Quota](https://longcat.chat/platform/docs/#ways-to-request-more-free-quota)
    - [Quota Usage Instructions](https://longcat.chat/platform/docs/#quota-usage-instructions)
    - [Quota Inquiry](https://longcat.chat/platform/docs/#quota-inquiry)
  - [Rate Limiting Rules](https://longcat.chat/platform/docs/#rate-limiting-rules)
    - [Single Request Limit](https://longcat.chat/platform/docs/#single-request-limit)
    - [Over-limit Handling](https://longcat.chat/platform/docs/#over-limit-handling)
  - [Quick Integration Examples](https://longcat.chat/platform/docs/#quick-integration-examples)
    - [OpenAI API Format Example](https://longcat.chat/platform/docs/#openai-api-format-example)
    - [Anthropic API Format Example](https://longcat.chat/platform/docs/#anthropic-api-format-example)
    - [cURL Example](https://longcat.chat/platform/docs/#curl-example)
  - [Important Reminders](https://longcat.chat/platform/docs/#important-reminders)
- [API Docs](https://longcat.chat/platform/docs/APIDocs.html)
- [Claude Code Configuration](https://longcat.chat/platform/docs/ClaudeCode.html)
- [OpenClaw Configuration](https://longcat.chat/platform/docs/OpenClaw.html)
- [FAQ](https://longcat.chat/platform/docs/FAQ.html)
- [Change Log](https://longcat.chat/platform/docs/ChangeLog.html)

# [LongCat API Platform Quick Start Guide](https://longcat.chat/platform/docs/\#longcat-api-platform-quick-start-guide)

Welcome to the LongCat API Platform! This document will help you get started quickly and begin using our large model services.

## [How to Get an API Key?](https://longcat.chat/platform/docs/\#how-to-get-an-api-key)

### [Register an Account](https://longcat.chat/platform/docs/\#register-an-account)

1. Visit [LongCat API Platform](https://longcat.chat/platform)
2. Fill in the required information to complete account registration

### [Create Your API Key](https://longcat.chat/platform/docs/\#create-your-api-key)

1. After registering and logging in, go to the [API Keys](https://longcat.chat/platform/api_keys) page and click “Create API Key” to manually generate a key.
2. Once created, you can view the following details in the list:
   - Name: Your custom identifier for the application
   - Key: The system-generated secret (please keep it safe and do not disclose it)

## [Supported API Types](https://longcat.chat/platform/docs/\#supported-api-types)

LongCat API Platform is compatible with two mainstream API formats. You can choose according to your needs:

### [OpenAI API Format](https://longcat.chat/platform/docs/\#openai-api-format)

Fully compatible with the OpenAI API specification, supporting the following endpoints:

- **Chat Completion**: `/v1/chat/completions`

### [Anthropic API Format](https://longcat.chat/platform/docs/\#anthropic-api-format)

Compatible with the Anthropic Claude API specification, supporting the following endpoint:

- **Message Chat**: `/v1/messages`

### [Endpoints](https://longcat.chat/platform/docs/\#endpoints)

- **OpenAI Format**: `https://api.longcat.chat/openai`
- **Anthropic Format**: `https://api.longcat.chat/anthropic`

### [Supported Models](https://longcat.chat/platform/docs/\#supported-models)

| Model Name | API Format | Description |
| --- | --- | --- |
| LongCat-Flash-Chat | OpenAI/Anthropic | High-performance general-purpose chat model |
| LongCat-Flash-Thinking | OpenAI/Anthropic | Deep-thinking model |
| LongCat-Flash-Thinking-2601 | OpenAI/Anthropic | Upgraded deep-thinking model |
| LongCat-Flash-Lite | OpenAI/Anthropic | Efficient MoE model |
| LongCat-Flash-Omni-2603 | OpenAI | MultiModal model |
| LongCat-Flash-Chat-2602-Exp | OpenAI | High-performance general-purpose chat model |

> **Note**: LongCat-Flash-Thinking has been upgraded to LongCat-Flash-Thinking-2601 on 2026-03-12. You can use either name to call the API.

## [How to Get Usage Quota?](https://longcat.chat/platform/docs/\#how-to-get-usage-quota)

### [Daily Free Quota](https://longcat.chat/platform/docs/\#daily-free-quota)

- Each account automatically receives **500,000 Tokens** free quota per day, which can be used for the LongCat-Flash-Chat, LongCat-Flash-Thinking, LongCat-Flash-Thinking-2601, LongCat-Flash-Omni-2603 and LongCat-Flash-Chat-2602-Exp models. LongCat-Flash-Lite model, each account automatically receives **50,000,000** Tokens free quota per day.
- The free quota is refreshed automatically at midnight (Beijing Time) every day
- **Unused quota from the previous day will be cleared** and will not roll over to the next day

### [Ways to Request More Free Quota](https://longcat.chat/platform/docs/\#ways-to-request-more-free-quota)

- Before applying for a quota increase, please ensure that you have [created an API Key](https://longcat.chat/platform/api_keys)
- You can visit the [Usage](https://longcat.chat/platform/usage) to apply for an increase in your free Tokens quota. Upon approval, your free quota will be raised to **5,000,000 Tokens/day**（Note: This quota increase applies only to the LongCat-Flash-Chat,LongCat-Flash-Thinking, LongCat-Flash-Thinking-2601, LongCat-Flash-Omni-2603 and LongCat-Flash-Chat-2602-Exp models; the LongCat-Flash-Lite model is not eligible for quota upgrades.）
- For additional quota, please contact us by email at longcat-team@meituan.com . Please provide any API Key under your account in the email so that we can process your request promptly

### [Quota Usage Instructions](https://longcat.chat/platform/docs/\#quota-usage-instructions)

- Both input and output Tokens are counted towards consumption
- Streaming and non-streaming endpoints consume quota equally

### [Quota Inquiry](https://longcat.chat/platform/docs/\#quota-inquiry)

You can view your usage in real time at [Usage](https://longcat.chat/platform/usage)

> **Note**: The platform is currently in public beta and does not support paid quota purchases.

## [Rate Limiting Rules](https://longcat.chat/platform/docs/\#rate-limiting-rules)

### [Single Request Limit](https://longcat.chat/platform/docs/\#single-request-limit)

- **Output text**:
  - LongCat-Flash-Omni-2603: Maximum 8K Tokens
  - LongCat-Flash-Chat / LongCat-Flash-Thinking / LongCat-Flash-Thinking-2601: Maximum 256K Tokens
  - LongCat-Flash-Lite: Maximum 320K Tokens

### [Over-limit Handling](https://longcat.chat/platform/docs/\#over-limit-handling)

When rate limiting is triggered, the API will return HTTP status code 429. Example response:

```
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Request rate limit exceeded, please try again later",
    "type": "rate_limit_error",
    "retry_after": 60
  }
}
```

It is recommended to implement exponential backoff retry mechanism on the client side.

## [Quick Integration Examples](https://longcat.chat/platform/docs/\#quick-integration-examples)

### [OpenAI API Format Example](https://longcat.chat/platform/docs/\#openai-api-format-example)

#### [Python Example](https://longcat.chat/platform/docs/\#python-example)

```
import requests

url = "https://api.longcat.chat/openai/v1/chat/completions"
headers = {
    "Authorization": "Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F",
    "Content-Type": "application/json"
}

data = {
    "model": "LongCat-Flash-Chat",
    "messages": [\
        {"role": "user", "content": "Hello, please introduce yourself."}\
    ],
    "max_tokens": 1000,
    "temperature": 0.7
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

#### [Using OpenAI SDK](https://longcat.chat/platform/docs/\#using-openai-sdk)

```
from openai import OpenAI

client = OpenAI(
    api_key="ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F",
    base_url="https://api.longcat.chat/openai"
)

response = client.chat.completions.create(
    model="LongCat-Flash-Chat",
    messages=[\
        {"role": "user", "content": "Hello!"}\
    ],
    max_tokens=1000
)

print(response.choices[0].message.content)
```

### [Anthropic API Format Example](https://longcat.chat/platform/docs/\#anthropic-api-format-example)

#### [Using Anthropic SDK](https://longcat.chat/platform/docs/\#using-anthropic-sdk)

```
from anthropic import Anthropic

client = Anthropic(
    api_key="Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F",
    base_url="https://api.longcat.chat/anthropic/",
    default_headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F",
    }
)

response = client.messages.create(
    model="LongCat-Flash-Chat",
    max_tokens=1000,
    messages=[\
        {"role": "user", "content": "Hello!"}\
    ]
)

print(response.content[0].text)
```

### [cURL Example](https://longcat.chat/platform/docs/\#curl-example)

#### [OpenAI Format](https://longcat.chat/platform/docs/\#openai-format)

```
curl -X POST https://api.longcat.chat/openai/v1/chat/completions \
  -H "Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "LongCat-Flash-Chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 1000
  }'
```

#### [Anthropic Format](https://longcat.chat/platform/docs/\#anthropic-format)

```
curl -X POST https://api.longcat.chat/anthropic/v1/messages \
  -H "Authorization: Bearer ak_2aC7va3c97Dj12j5v81fU4Ft1YK2F" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "LongCat-Flash-Chat",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## [Important Reminders](https://longcat.chat/platform/docs/\#important-reminders)

- Please use your daily free quota reasonably. Unused quota will not be retained for the next day
- Please keep your API Key safe to avoid quota theft due to leakage

* * *

Now you have learned the basics of using the LongCat API Platform. Go ahead and try it out!

Last Updated: 4/2/26, 7:28 AM

Contributors: zhuqi09, wb\_changzhe02

[Next \\
\\
API Docs](https://longcat.chat/platform/docs/APIDocs.html)