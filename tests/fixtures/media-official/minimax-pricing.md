> ## Documentation Index
> Fetch the complete documentation index at: https://platform.minimax.io/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing Overview

[Pricing Overview](#overview)

Model Pricing

[LLM](#models/text)
[Video](#models/video)
[Image](#models/image)
[Audio](#models/speech)

Tool Pricing

[MCP](#tools/mcp)
[Server Tools](#tools/tools)

Packages

[Audio](#packages/speech)

Billing Guides

[Payment Methods](#guides/compare)
[Pay-as-you-go Billing](#guides/billing)
[Package Usage Rules](#guides/packages)
[FAQ](#guides/faq)

> [accordion] Pricing navigation
>
> [Pricing Overview](#overview)
>
> Model Pricing
>
> [LLM](#models/text)
> [Video](#models/video)
> [Image](#models/image)
> [Audio](#models/speech)
>
> Tool Pricing
>
> [MCP](#tools/mcp)
> [Server Tools](#tools/tools)
>
> Packages
>
> [Audio](#packages/speech)
>
> Billing Guides
>
> [Payment Methods](#guides/compare)
> [Pay-as-you-go Billing](#guides/billing)
> [Package Usage Rules](#guides/packages)
> [FAQ](#guides/faq)

Explore MiniMax model and tool pricing, choose an Audio Package, or learn about billing.

## LLM

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

| **Model** | **Input** \$ / M tokens | **Output** \$ / M tokens | **Prompt caching Read** \$ / M tokens |
| :- | :-: | :-: | :-: |
| **MiniMax-M3.1-Flash** | \$0.15 | \$0.60 | \$0.015 |

> [tab] Standard
>
> | **Model** | **Input** \$ / M tokens | **Output** \$ / M tokens | **Prompt caching Read** \$ / M tokens |
> | :- | :-: | :-: | :-: |
> | **MiniMax-M3** ≤ 512k input tokens Permanent 50% off | ~~\$0.60~~ \$0.30 | ~~\$2.40~~ \$1.20 | ~~\$0.12~~ \$0.06 |
> | **MiniMax-M3** > 512k input tokens\* Permanent 50% off | ~~\$1.20~~ \$0.60 | ~~\$4.80~~ \$2.40 | ~~\$0.24~~ \$0.12 |

> [tab] Priority\*
>
> | **Model** | **Input** \$ / M tokens | **Output** \$ / M tokens | **Prompt caching Read** \$ / M tokens |
> | :- | :-: | :-: | :-: |
> | **MiniMax-M3** ≤ 512k input tokens Permanent 50% off | ~~\$0.90~~ \$0.45 | ~~\$3.60~~ \$1.80 | ~~\$0.18~~ \$0.09 |
> | **MiniMax-M3** > 512k input tokens Permanent 50% off | ~~\$1.80~~ \$0.90 | ~~\$7.20~~ \$3.60 | ~~\$0.36~~ \$0.18 |
>
> \* Priority provides priority admission for faster response times and improved request reliability. Set `service_tier` to `priority` to enable it. Pricing is 1.5x standard.

> [!NOTE]
>
> Note:
>
> 1. The billing item is token count; the token-to-character ratio varies slightly depending on the usage scenario, subject to actual consumption
> 2. Token to English word ratio (estimate): approximately 750 English words consume 1000 tokens

## Video

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

### H3 Series Flagship Models

<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>Output Resolution</th>
      <th>Output Video\
      per second</th>
      <th>Input Video\
      per second</th>
      <th>Input Image\
      per image\
      beyond free quota</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td rowSpan="2">**MiniMax-H3**\
      Quality first, for high-quality video creation.</td>
      <td>2K</td>
      <td>\$0.13</td>
      <td>\$0.13</td>
      <td>\$0.04</td>
    </tr>

    <tr>
      <td>768P</td>
      <td>\$0.08</td>
      <td>\$0.08</td>
      <td>\$0.04</td>
    </tr>

    <tr>
      <td rowSpan="2">**MiniMax-H3-Highspeed**\
      Balances quality and speed, for everyday content creation.</td>
      <td>768P</td>
      <td>\$0.06</td>
      <td>\$0.06</td>
      <td>\$0.03</td>
    </tr>

    <tr>
      <td>480P</td>
      <td>\$0.04</td>
      <td>\$0.04</td>
      <td>\$0.03</td>
    </tr>

    <tr>
      <td rowSpan="2">**MiniMax-H3-Lite**\
      Lower cost, for creative exploration and batch generation.</td>
      <td>768P</td>
      <td>\$0.04</td>
      <td>\$0.04</td>
      <td>\$0.02</td>
    </tr>

    <tr>
      <td>480P</td>
      <td>\$0.025</td>
      <td>\$0.025</td>
      <td>\$0.02</td>
    </tr>
  </tbody>
</table>

* **Image input**: The first **5 images** per task are free; additional images are billed per image. The unit price does not vary with image or output video resolution.
* **Video input**: Billed by input duration at the output resolution of the selected model.
* **Task types**: For the same model and resolution, all task types share the same unit price. Audio input is free.

> [accordion] View flagship model task types
>
> <table>
>   <thead>
>     <tr>
>       <th>Model</th>
>       <th>Text-to-video t2v</th>
>       <th>Image-to-video i2v</th>
>       <th>First & last frame fl2v</th>
>       <th>Reference ref</th>
>     </tr>
>   </thead>
>
>   <tbody>
>     <tr>
>       <td>MiniMax-H3</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Image, video, audio</td>
>     </tr>
>
>     <tr>
>       <td>MiniMax-H3-Highspeed</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Image, video, audio</td>
>     </tr>
>
>     <tr>
>       <td>MiniMax-H3-Lite</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Image, video, audio</td>
>     </tr>
>   </tbody>
> </table>

### H3 Series Extended Models

<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>Output Resolution</th>
      <th>Output Video\
      per second</th>
      <th>Input Video\
      per second</th>
      <th>Input Image\
      per image\
      beyond free quota</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td rowSpan="2">**MiniMax-H3-Max**\
      Supports image, video, and audio references, for multi-asset video creation.</td>
      <td>768P</td>
      <td>\$0.08</td>
      <td>\$0.143</td>
      <td>\$0.074</td>
    </tr>

    <tr>
      <td>480P</td>
      <td>\$0.05</td>
      <td>\$0.0553</td>
      <td>\$0.074</td>
    </tr>
  </tbody>
</table>

* **MiniMax-H3-Max**: The first **2 images** per task are free; additional images are billed per image. Input video is billed by duration at the output resolution. Audio input is free.

> [accordion] View extended model task types
>
> <table>
>   <thead>
>     <tr>
>       <th>Model</th>
>       <th>Text-to-video t2v</th>
>       <th>Image-to-video i2v</th>
>       <th>First & last frame fl2v</th>
>       <th>Reference ref</th>
>     </tr>
>   </thead>
>
>   <tbody>
>     <tr>
>       <td>MiniMax-H3-Max</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Supported</td>
>       <td>Image, video, audio</td>
>     </tr>
>   </tbody>
> </table>

### Video Regeneration

Regenerate a 768P video produced by MiniMax-H3 into 2K.

| **Model / API** | **Spec** | **Output Video** per second | **Input Video** per second | **Input Image** per image beyond free quota |
| :- | :- | -: | -: | -: |
| MiniMax-H3-Regeneration | 768P → 2K | \$0.05 | \$0.05 | \$0.025 |

* Input materials from the original task are billed again: the first **5 images** are free and additional images are billed per image; video is billed by the original input duration; audio is free.
* The regeneration fee is charged separately from the original task fee and includes the regenerated video output fee and input material fees.

### Context-IR

| **Model / API** | **Input Price** per M tokens | **Output Price** per M tokens |
| :- | -: | -: |
| MiniMax-H3-Context-IR | \$0.90 | \$3.60 |

> [accordion] Legacy Models
>
> | Model | Price |
> | :- | :- |
> | MiniMax-Hailuo-2.3-Fast | \$0.19 per 768P, 6s video |
> | MiniMax-Hailuo-2.3-Fast | \$0.32 per 768P, 10s video |
> | MiniMax-Hailuo-2.3-Fast | \$0.33 per 1080P, 6s video |
> | MiniMax-Hailuo-2.3 | \$0.28 per 768P, 6s video |
> | MiniMax-Hailuo-2.3 | \$0.56 per 768P, 10s video |
> | MiniMax-Hailuo-2.3 | \$0.49 per 1080P, 6s video |
> | MiniMax-Hailuo-02 | \$0.28 per 768P, 6s video |
> | MiniMax-Hailuo-02 | \$0.56 per 768P, 10s video |
> | MiniMax-Hailuo-02 | \$0.49 per 1080P, 6s video |
> | MiniMax-Hailuo-02 | \$0.10 per 512P, 6s video |
> | MiniMax-Hailuo-02 | \$0.15 per 512P, 10s video |

## Image

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

> [!WARNING]
>
> **Limited-Time Offer: 50% Off 4K Image Generation:** **From now until November 17, 2026, at 16:00 UTC** (exclusive), enjoy 50% off the total request cost for MiniMax-H3-Image and MiniMax-H3-Image-Highspeed when the final delivered image has at least 16,600,000 pixels (width × height).

### Image Generation

| **Model** | **Input Text** \$ / M tokens | **Input Image** \$ / M tokens | **Output Image** \$ / M tokens |
| :- | :-: | :-: | :-: |
| **MiniMax-H3-Image** Standard | \$2.30 | \$1.50 | \$3.80 |
| **MiniMax-H3-Image-Highspeed** Highspeed | \$2.30 | \$3.00 | \$7.60 |

### Example cost per generated image

> [tab] Standard
>
> Model: **MiniMax-H3-Image**
>
> <table>
>   <thead>
>     <tr>
>       <th>Task</th>
>       <th>Input image\
>       (each)</th>
>       <th>Output image</th>
>       <th>Example total cost\
>       \$ / image</th>
>     </tr>
>   </thead>
>
>   <tbody>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.02179</td>
>     </tr>
>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.02333</td>
>     </tr>
>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.06879~~ **\$0.03439**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.02654</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.02658</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.07312~~ **\$0.03656**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.03563</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.04177</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.07914~~ **\$0.03957**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>   </tbody>
> </table>

> [tab] Highspeed
>
> Model: **MiniMax-H3-Image-Highspeed**
>
> <table>
>   <thead>
>     <tr>
>       <th>Task</th>
>       <th>Input image\
>       (each)</th>
>       <th>Output image</th>
>       <th>Example total cost\
>       \$ / image</th>
>     </tr>
>   </thead>
>
>   <tbody>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.03529</td>
>     </tr>
>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.03622</td>
>     </tr>
>
>     <tr>
>       <td>Text-to-image</td>
>       <td>None</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.13001~~ **\$0.06501**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.04525</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.04576</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (1 reference image)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.13673~~ **\$0.06837**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>\$0.06037</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>2K (2048 × 2048)</td>
>       <td>\$0.06069</td>
>     </tr>
>
>     <tr>
>       <td>Image editing (3 reference images)</td>
>       <td>1K (1024 × 1024)</td>
>       <td>4K (4096 × 4096)</td>
>
>       <td>
>         ~~\$0.15407~~ **\$0.07703**\\
>
>         Limited-time 50% off
>       </td>
>     </tr>
>   </tbody>
> </table>

> [!NOTE]
>
> The amounts above are illustrative estimates for generating a single image; even with the same input and output resolutions, actual costs may vary depending on the number of text input tokens in each request. Text input tokens include those generated by prompt enhancement.

### H3-Image-Context-IR (Prompt Enhancement)

| **Model / API** | **Input** \$ / M tokens |
| :- | :-: |
| H3-Image-Context-IR | \$2.30 |

> [accordion] Legacy Models
>
> | Model | Price |
> | :- | :- |
> | image-01 image-01-live | \$0.0035 per image |

## Audio

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

**Automatic Speech Recognition (ASR)**

| **API** | **Endpoint** | **Description** | **Price** |
| :- | :- | :- | :- |
| Speech Recognition | Speech-to-Text | Audio-to-text transcription with streaming, speaker diarization, and subtitle (srt/vtt) export. | \$0.38 / hour |

**Text-to-Speech (TTS)**

| **API** | **Model** | **Description** | **Price** |
| :- | :- | :- | :- |
| **T2A** (Sync) | speech-2.8-hd | Real-time synthesis with volume/pitch/speed/mixing controls and bitrate/sample-rate options. Best for short-form conversational audio. | \$100 / M characters |
| **T2A** (Sync) | speech-2.8-turbo | Same capabilities as hd, optimized for speed and cost. | \$60 / M characters |
| **T2A Async** | speech-2.8-hd | Asynchronous long-form synthesis, up to 1M characters per request, retrieved asynchronously. | \$100 / M characters |
| **T2A Async** | speech-2.8-turbo | Same capabilities as hd, optimized for speed and cost. | \$60 / M characters |

**Voice Management**

| **API** | **Description** | **Price** | **Notes** |
| :- | :- | :- | :- |
| **Voice Design** | Generate a voice (voice\_id) from a natural-language description; usable in both sync and async T2A endpoints. | \$3 per voice | Charged when the designed voice is first used for synthesis, not at generation time. In-API preview synthesis is billed at \$60 / M characters. |
| **Rapid Voice Cloning** | LLM-powered voice cloning that produces a high-fidelity replica in seconds, without long high-quality reference audio. | \$1.5 per voice | Charged when the cloned voice is first used for synthesis, not at cloning time. Preview characters are billed at the selected preview model's rate. |

> [accordion] Legacy Models
>
> | API | Model | Price |
> | :- | :- | :- |
> | **T2A** | speech-2.6-turbo / speech-02-turbo | \$60/M characters |
> | **T2A** | speech-2.6-hd / speech-02-hd | \$100/M characters |

## MCP

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

| Model | Input Price |
| :- | :- |
| **API-vlm** | \$0.01 / request |

When API-vlm is called through M Plan, usage deducts from the included M Plan quota according to its pay-as-you-go price. If the included quota is exhausted and purchased Credits are available, additional usage can be automatically covered by purchased Credits.

## Server Tools&#x20;

[Recharge Now](https://platform.minimax.io/user-center/payment/balance)

| Server Tool | Description | Price |
| :- | :- | :- |
| **web\_search** | Web search; the model runs the search on the server and answers based on the results. See [Server Tools](https://platform.minimax.io/docs/guides/server-tools.md). | \$0.01 / request |

## Audio

[Purchase Now](https://platform.minimax.io/console/resource-packs/buy/audio)

| Category | Starter | Standard | Pro | Scale | Business | Customer Pricing |
| :- | :- | :- | :- | :- | :- | :- |
| **Monthly Subscription** | \$5 | \$30 | \$99 | \$249 | \$999 | / |
| **3-month Subscription** (10% off) | \$13.5 | \$81 | \$267 | \$672 | \$2,697 | / |
| **Yearly Subscription** (20% off) | \$48 | \$288 | \$950 | \$2,390 | \$9,590 | / |
| **Audio points per month** | 100,000 | 300,000 | 1,100,000 | 3,300,000 | 20,000,000 | As many audio points as you need |
| **Functions** | • Voice slots: 10 • RPM: 10 • Faster speed of generating speech • Supports T2A v2, T2A large v2 API • Supports all speech models | • Voice slots: 100 • RPM: 50 • Faster speed of generating speech • Supports T2A v2, T2A large v2 API • Supports all speech models | • Voice slots: 250 • RPM: 200  • Faster speed of generating speech • Supports T2A v2, T2A large v2 API • Supports all speech models | • Voice slots: 500 • RPM: 500 • Faster speed of generating speech • Supports T2A v2, T2A large v2 API • Supports all speech models | • Voice slots: 800 • RPM: 800 • Faster speed of generating speech • Supports T2A v2, T2A large v2 API • Supports all speech models | • Unlimited RPM/TPM • Priority access to model updates • More voices and more cloning options • Exclusive security and stability guarantees |

## Payment Methods

MiniMax offers pay-as-you-go billing and Audio Packages. Choose a billing option based on the models you use, how much you expect to use them, and for how long.

### Compare Billing Options

| Feature | Pay-as-you-go | Audio Packages |
| - | - | - |
| Use cases | Use any MiniMax model or tool and pay for what you use, with the flexibility to support a wide range of business needs and API workloads. | For speech workloads where you expect to use the included audio points. |
| How you pay | Add funds to your account and pay for what you use | Purchase an Audio Package |
| Coverage | All MiniMax models and tools | All speech models |
| Billing units | Varies by model, configuration, and type of usage | Audio points per month |
| Get started | [Recharge Now](https://platform.minimax.io/user-center/payment/balance) | [View Audio Packages](#packages/speech) |

### Before You Buy

Check the supported models, included points, and how long the package lasts. Audio Packages support all speech models.

[View Audio Packages](#packages/speech) · [View Usage Rules](#guides/packages)

## Pay-as-you-go Billing

With pay-as-you-go billing, you use standard Open Platform API keys and pay from your account balance based on usage. All prices are in USD.

### How Billing Works

* **Payment:** API usage charges are deducted from your account balance.
* **Billing units:** Depending on the service, charges are based on tokens, characters, duration, images, voices, or requests. See the relevant pricing table for the exact unit.
* **Rates:** Rates vary by model, API, and configuration. For example, LLM input length and service tier, or video output resolution, can affect pricing.

### How Charges Are Calculated

> [!NOTE]
>
> For each billing item, multiply actual usage by the applicable unit price. First, convert usage to the unit listed in the pricing table. For example, if a price is listed per million tokens, divide the token count by 1,000,000 before multiplying by the price. If a request includes multiple billing items, add their costs together.

See Model Pricing and Tool Pricing for individual rates. Audio Packages are also available for speech models. To compare these options, see [Payment Methods](#guides/compare).

## Package Usage Rules

Audio Packages include points for use with supported speech models and APIs. Before purchasing, check which models are supported, how many points are included, and how long the package lasts.

### Coverage

| Feature | Audio Packages |
| - | - |
| Supported models | All speech models |
| Supported APIs | T2A v2 and T2A large v2 |
| Included points | Audio points per month |
| Package duration | 1 month, 3 months (10% off), or 1 year (20% off) |
| Plan details | [Audio Packages](#packages/speech) |

### How Points Are Used

Starter, Standard, Pro, Scale, and Business each include a monthly allowance of audio points. The allowance varies by plan. See the [Audio package pricing table](#packages/speech) for included points, voice slots, and rate limits.

### Package Terms and Usage Limits

See the [Audio package pricing table](#packages/speech) for available terms, monthly audio points, rate limits, and other plan features.

## FAQ

Find answers to common questions about pay-as-you-go billing and Audio Packages. See the relevant pricing tables for exact prices and included features.

### Billing and Usage

> [accordion] What’s the difference between the Standard and Priority service tiers for MiniMax-M3?
>
> Priority gives your requests priority access for faster responses and improved reliability. It costs 1.5 times the Standard rate. To enable it, set `service_tier` to `priority`. See the LLM pricing tables for the rates that apply to each input length.

> [accordion] Does video output pricing include charges for input media?
>
> H3 video output and input media are billed separately. Images beyond the free allowance incur an additional charge. Input video is billed based on its duration and the output resolution. If you regenerate a video, the input media from the original task is billed again. See the video pricing tables for the applicable rates.

> [accordion] How do I add funds and check usage and charges?
>
> Visit the [Recharge page](https://platform.minimax.io/user-center/payment/balance) to add funds to your account for pay-as-you-go API usage. View usage and charges on the [API Usage page](https://platform.minimax.io/console/consumption-detail).

> [accordion] Which models can I use with Audio Packages?
>
> You can use Audio Packages with all speech models via the T2A v2 and T2A large v2 APIs. Before you buy, check the supported models, included points, and plan duration. For details, see [Package Usage Rules](#guides/packages).

> [accordion] About Music Models
>
> As of August 20, 2026, the music generation and lyrics generation APIs are no longer available to new users. Existing paying users can continue using these APIs.
>
> To generate music, visit [**MiniMax Audio**](https://www.minimax.io/audio) or try the open-source **MiniMax Music 3** model on [**Hugging Face**](https://huggingface.co/MiniMaxAI/MiniMax-Music3) or [**ModelScope**](https://modelscope.cn/models/MiniMax/MiniMax-Music3).
>
> The following rates apply to existing paying users.
>
> | **Model** | **Price** |
> | :- | :-: |
> | Music-3.0 | \$0.15 per track (up to 5 minutes) |
> | Music-2.6 | \$0.15 per track (up to 5 minutes) |
> | Lyrics Generation | \$0.01 per song |
> | Music-2.5+ | \$0.15 per track (up to 5 minutes) |
> | Music-2.5 | \$0.15 per track (up to 5 minutes) |
> | Music-2.0 | \$0.03 per track (up to 5 minutes) |
