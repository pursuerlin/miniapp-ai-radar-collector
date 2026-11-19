> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bfl.ml/llms.txt
> Use this file to discover all available pages before exploring further.

# Generate a video with FLUX 3 Max

> Generate videos from text, an image, or keyframes with FLUX 3 Max on fal.

Set a [fal API key](https://fal.ai/dashboard/keys) as the `FAL_KEY` environment
variable. Requests and billing go through your fal account.

> [tab] Text to video
>
> Describe your video in `prompt` and send the request to
> `https://queue.fal.run/blackforestlabs/flux-3-max/text-to-video`.

> [tab] Image to video
>
> Send your prompt and an image URL as `image_url` to
> `https://queue.fal.run/blackforestlabs/flux-3-max/image-to-video`.
> Your video starts from that image. Optionally, add `end_image_url` to
> choose the last frame.
>
> Every other field in the Body section below works the same way. The
> playground sends text-to-video requests; for the image-to-video schema, see
> [fal's reference](https://fal.ai/models/blackforestlabs/flux-3-max/image-to-video/api).

> [tab] Keyframes to video
>
> Send your prompt and up to 10 `keyframes` to
> `https://queue.fal.run/blackforestlabs/flux-3-max/keyframes-to-video`.
> Each keyframe is an `image_url` pinned to a `frame_index` in the 24 fps
> output, so second 3 is frame 72. Indices must be unique and at most
> `duration` × 24. Use `prompt` to describe the motion between keyframes.
>
> Every other field in the Body section below works the same way. For the
> keyframes-to-video schema, see
> [fal's reference](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video/api).

See [FLUX 3 Max](https://docs.bfl.ml/flux_3/flux3_video.md#flux-3-max) for samples.

> [accordion] Retrieve your video
>
> The response includes a `status_url` and a `response_url`. Poll the first until
> `status` is `COMPLETED`, then fetch the second. The video is at `video.url`.
>
> ```bash theme={null}
> # 1. Poll until "status": "COMPLETED"
> curl --header "Authorization: Key $FAL_KEY" "$STATUS_URL"
>
> # 2. Fetch the result
> curl --header "Authorization: Key $FAL_KEY" "$RESPONSE_URL"
> ```

```bash Text to video theme={null}
curl --request POST \
  --url https://queue.fal.run/blackforestlabs/flux-3-max/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
  "prompt": "A continuous helmet-mounted POV tails a woman on a dirt bike racing across rolling desert dunes, her tracks the only marks on the wind-sculpted sand. The view dips and jolts over each crest as she kicks up golden arcs into the low, raking sun. The engine snarls and roars, the only sound in the sunlit void.",
  "duration": 10,
  "resolution": "1080p",
  "aspect_ratio": "16:9"
}'
```

```bash Image to video theme={null}
curl --request POST \
  --url https://queue.fal.run/blackforestlabs/flux-3-max/image-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
  "prompt": "Dashcam view of a moose crossing a snowy highway at dusk, wipers sweeping, brake lights reflecting on ice.",
  "image_url": "https://cdn.sanity.io/images/2gpum2i6/production/d0cadba3ca86e84c1e6d86de87555a20f522f62c-1280x704.jpg",
  "duration": 10
}'
```

```bash Keyframes to video theme={null}
curl --request POST \
  --url https://queue.fal.run/blackforestlabs/flux-3-max/keyframes-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
  "prompt": "One continuous shot following a cave diver through a dark underwater cavern: her torch beam sweeps the rock, she glides past a wall of glowing blue coral, swims through a swirling cloud of bioluminescent plankton, and rises toward shafts of sunlight at the cave mouth.",
  "keyframes": [
    { "image_url": "https://cdn.sanity.io/images/2gpum2i6/production/809c8dc93242314493c4ae613e9ebfba26b7b14f-2752x1536.jpg", "frame_index": 0 },
    { "image_url": "https://cdn.sanity.io/images/2gpum2i6/production/716f9cad904a337d7d54cbe3fa69d8cc8fb6fde5-2752x1536.jpg", "frame_index": 72 },
    { "image_url": "https://cdn.sanity.io/images/2gpum2i6/production/b4855f2bcf674551255248f4f30a2f213ed34e68-2752x1536.jpg", "frame_index": 168 },
    { "image_url": "https://cdn.sanity.io/images/2gpum2i6/production/b591a58d3a4a94472dbb7e69f3f40859cc6d3731-2752x1536.jpg", "frame_index": 240 }
  ],
  "duration": 10
}'
```


## OpenAPI

````yaml https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=blackforestlabs/flux-3-max/text-to-video POST /blackforestlabs/flux-3-max/text-to-video
openapi: 3.1.0
info:
  title: Queue OpenAPI for blackforestlabs/flux-3-max/text-to-video
  version: 1.0.0
  description: >-
    FLUX 3 Max text to video from Black Forest Labs. Input: prompt. Options:
    duration 5-20 seconds (default 5), aspect_ratio (auto, 21:9, 2:1, 16:9, 4:3,
    1:1, 3:4, 9:16; default auto), generate_audio (default true),
    reasoning_level low or high (default high, the model expands your prompt),
    seed. Output: 720p video with native audio. Billed per second of generated
    video.
  x-fal-metadata:
    endpointId: blackforestlabs/flux-3-max/text-to-video
    category: text-to-video
    thumbnailUrl: https://v3b.fal.media/files/b/0aae8ccd/cfm_KIh1OltujxYuHIzzV.jpg
    playgroundUrl: https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video
    documentationUrl: https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video/api
    about: Generate a video with audio from a text prompt.
servers:
  - url: https://queue.fal.run
security:
  - apiKeyAuth: []
paths:
  /blackforestlabs/flux-3-max/text-to-video:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Flux3MaxTextToVideoInput'
      responses:
        '200':
          description: The request status.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QueueStatus'
components:
  schemas:
    Flux3MaxTextToVideoInput:
      x-fal-order-properties:
        - prompt
        - duration
        - resolution
        - reasoning_level
        - aspect_ratio
        - generate_audio
        - seed
      type: object
      title: AlligatorTextToVideoInput
      required:
        - prompt
      properties:
        duration:
          description: Duration of the generated video in seconds.
          type: integer
          default: 5
          title: Duration
          enum:
            - 5
            - 6
            - 7
            - 8
            - 9
            - 10
            - 11
            - 12
            - 13
            - 14
            - 15
            - 16
            - 17
            - 18
            - 19
            - 20
        reasoning_level:
          description: >-
            How much effort the harness spends reasoning about the given prompt.
            Higher reasoning effort means slower generation time.
          type: string
          default: high
          title: Reasoning Level
          enum:
            - low
            - high
        prompt:
          examples:
            - >-
              A red panda walks along a mossy log in a sunlit forest, pausing to
              sniff the air before climbing over a fallen branch. Soft morning
              light filters through the canopy. Ambient birdsong and rustling
              leaves.
          type: string
          title: Prompt
          description: The text prompt describing the video you want to generate.
          minLength: 1
        generate_audio:
          description: Whether to generate audio for the video.
          type: boolean
          default: true
          title: Generate Audio
        resolution:
          description: >-
            Resolution of the generated video. `1080p`, `2K` (1440p) and `4K`
            (2160p) are upscaled from the 720p generation; exact dimensions
            depend on the aspect ratio.
          type: string
          default: 720p
          title: Resolution
          enum:
            - 720p
            - 1080p
            - 2K
            - 4K
        seed:
          description: The seed to use for the generation. Random when not provided.
          anyOf:
            - type: integer
            - type: 'null'
          title: Seed
        aspect_ratio:
          description: >-
            Aspect ratio of the generated video. `auto` uses 16:9 for text
            prompts and follows the first image otherwise.
          type: string
          default: auto
          title: Aspect Ratio
          enum:
            - auto
            - '21:9'
            - '2:1'
            - '16:9'
            - '4:3'
            - '1:1'
            - '3:4'
            - '9:16'
    QueueStatus:
      type: object
      properties:
        status:
          type: string
          enum:
            - IN_QUEUE
            - IN_PROGRESS
            - COMPLETED
        request_id:
          type: string
          description: The request id.
        response_url:
          type: string
          description: The response url.
        status_url:
          type: string
          description: The status url.
        cancel_url:
          type: string
          description: The cancel url.
        logs:
          type: object
          description: The logs.
          additionalProperties: true
        metrics:
          type: object
          description: The metrics.
          additionalProperties: true
        queue_position:
          type: integer
          description: The queue position.
      required:
        - status
        - request_id
  securitySchemes:
    apiKeyAuth:
      type: apiKey
      in: header
      name: Authorization
      description: Fal Key

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.