# Wan3.0 - Video Generation API Reference

> Wan3.0 is an All-in-One reference-based video generation model that supports Text-to-Video , Image-to-Video (first frame/first-last frame), and Reference-based Video Generation . It can generate videos up to 30 seconds long at 30fps. Currently in preview .

<meta property="og:title" content="Wan3.0 - Video Generation API Reference" />

For the usage guide, see [Wan3.0 - Video Generation](/help/en/model-studio/wan3-video-generation-guide).

## Prerequisites <span id="w30scope01t" />

To ensure a successful API call, make sure that <strong>the model, Endpoint URL and API Key all belong to the same region</strong>. Cross-region calls will fail.

- [<strong>Select a model</strong>](https://modelstudio.console.alibabacloud.com/model/market): Go to the Model Gallery to select a model and confirm the region it belongs to.
- <strong>Select a URL</strong>: Select the Endpoint URL for the corresponding region.
- <strong>Configure API Key</strong>: Select a region and [Obtain an API key](/help/en/model-studio/get-api-key), then [Configure API key as an environment variable](/help/en/model-studio/configure-api-key-through-environment-variables).

<Note>
  The sample code in this topic applies to <strong>the Singapore region</strong>.
</Note>

## HTTP call <span id="w30http01t" />

Since video generation tasks take a relatively long time (typically 1-5 minutes), the API uses asynchronous calls. The entire process consists of two core steps: <strong>"Create a task -> Poll for results"</strong>, as described below:

### Step 1: Create a task and obtain the task ID <span id="w30step1t" />

<Tabs>
  <Tab title="Singapore">
    `POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="Beijing">
    `POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="US (Virginia)">
    `POST https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="Japan (Tokyo)">
    `POST https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="Germany (Frankfurt)">
    `POST https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="China (Hong Kong)">
    `POST https://{WorkspaceId}.cn-hongkong.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>
</Tabs>

Replace `{WorkspaceId}` with your actual [workspace ID](/help/en/model-studio/regions#h2_migrate_domain).

<Note>
  - After the task is created, use the returned `task_id` to query the result. The `task_id` is valid for 24 hours. <strong>Do not create duplicate tasks</strong>. Instead, use polling to retrieve the result.
  - For guidance for beginners, see [Call APIs with Postman or cURL](/help/en/model-studio/first-call-to-image-and-video-api).
</Note>

<table bordertype="no-border" style={{ display: "table", tableLayout: "fixed", width: "100%" }}>
  <colgroup>
    <col style={{ width: "50%" }} />

    <col style={{ width: "50%" }} />
  </colgroup>

  <tbody>
    <tr>
      <td>
        #### Request parameters <span id="w30req01h" />

        ##### Request headers (Headers) <span id="w30req02h" />

        <strong>Content-Type</strong> `string` <strong>(Required)</strong>

        The content type of the request. Must be `application/json`.

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        <strong>X-DashScope-Async</strong> `string` <strong>(Required)</strong>

        Enables asynchronous processing. HTTP requests support only asynchronous calls. Must be `enable`.

        <Tip>
          If this request header is missing, the error "current user api does not support synchronous calls" is returned.
        </Tip>

        ##### Request body (Request Body) <span id="w30req06h" />

        <strong>model</strong> `string` <strong>(Required)</strong>

        Model name. Valid values:

        - `wan3.0-video-prime`: High-speed version with capabilities aligned to the standard version, with significantly improved end-to-end speed.
        - `wan3.0-video`: Standard version.

        <strong>input</strong> `object` <strong>(Required)</strong>

        Basic input information. Either `prompt` or `media` must be provided.

        <Accordion title="Properties" defaultOpen>
          <strong>prompt</strong> `string` (Conditionally required)

          Text prompt used to describe the desired video content. Either this or `media` must be provided.

          Supports both Chinese and English. Each Chinese character or letter counts as one character, with a maximum of 20,000 characters. Content exceeding this limit will be automatically truncated.

          In reference mode, you can use "Image 1", "Video 1", etc. in the prompt to refer to media assets in the corresponding order within the media array.

          <strong>media</strong> `array` (Conditionally required)

          Media asset array that supports images, videos, audio, files, and web pages as input. Either this or `prompt` must be provided.

          - Each element in the array is a media object containing the `type` and `url` fields.
          - In reference-based video generation mode, the array order defines the reference order of assets in the `prompt`. Images and videos are counted separately, meaning Image 1 and Video 1 can coexist.

            - The 1st `reference_video` in the array corresponds to <strong>Video 1</strong>, the 2nd corresponds to <strong>Video 2</strong>, and so on.
            - The 1st `reference_image` in the array corresponds to <strong>Image 1</strong>, the 2nd corresponds to <strong>Image 2</strong>, and so on.
            - The 1st `reference_audio` in the array corresponds to <strong>Audio 1</strong>, the 2nd corresponds to <strong>Audio 2</strong>, and so on.

          <Accordion title="Properties" defaultOpen>
            <strong>type</strong> `string` <strong>(Required)</strong>

            Media asset type. Valid values:

            - `first_frame`: First frame image. Maximum 1 image, strictly used as the first frame of the video.
            - `last_frame`: Last frame image. Maximum 1 image, strictly used as the last frame of the video.
            - `reference_image`: Reference image. Maximum 10 images.
            - `reference_video`: Reference video. Maximum 5 clips, with a total duration of no more than 15 seconds.
            - `reference_audio`: Reference audio. Maximum 5 clips, with a total duration of no more than 15 seconds.
            - `file`: File. Maximum 1 file, cannot be used together with link.
            - `link`: Web link. Maximum 1 link, cannot be used together with file.

            <Tip>
              For combination rules and restrictions for different `type` values, see [Material combinations](#w30media_combo_t).
            </Tip>

            <strong>url</strong> `string` <strong>(Required)</strong>

            Media asset URL or Base64 encoded data.

            <Accordion title="Input image (type=first_frame / last_frame / reference_image)" defaultOpen>
              Image URL or Base64 encoded data.

              Image limits:

              - Format: JPEG, JPG, PNG (transparent channel not supported), BMP, WEBP.
              - Resolution: \[240, 8000] pixels per side.
              - Aspect ratio: no more than 8:1.
              - File size: no more than 20MB.

              Supported input formats:

              1. Public URL:

                 - Supports HTTP or HTTPS protocol.
                 - Example: <a href="https://xxx/xxx.png">[https://xxx/xxx.png](https://xxx/xxx.png)</a>.
              2. Base64 encoded image string:

                 - Data format: `data:{MIME_type};base64,{base64_data}`.
                 - Example: data:image/png;base64,GDU7MtCZzEbTbmRZ...... (the encoded string is too long, only a fragment is shown)
                 - For details, see [Input Image](/help/en/model-studio/image-to-video-guide#32d9db99f1fk0).
            </Accordion>

            <Accordion title="Input video (type=reference_video)" defaultOpen>
              Reference video URL.

              Video limits:

              - Format: mp4, mov.
              - Duration: \[1, 15] seconds per clip, with a total duration of no more than 15 seconds.
              - Frame rate: ≥16 fps.
              - Resolution: \[240, 4096] pixels per side.
              - Aspect ratio: no more than 8:1.
              - File size per clip: no more than 100MB.

              Supported input formats:

              1. Public URL:

                 - Supports HTTP or HTTPS protocol.
                 - Example: <a href="https://xxx/xxx.mp4">[https://xxx/xxx.mp4](https://xxx/xxx.mp4)</a>.
            </Accordion>

            <Accordion title="Input audio (type=reference_audio)" defaultOpen>
              Reference audio URL.

              Audio limits:

              - Format: wav, mp3.
              - Duration: \[1, 15] seconds per clip, with a total duration of no more than 15 seconds.
              - File size: no more than 15MB.

              Supported input formats:

              1. Public URL:

                 - Supports HTTP or HTTPS protocol.
                 - Example: <a href="https://xxx/xxx.mp3">[https://xxx/xxx.mp3](https://xxx/xxx.mp3)</a>.
            </Accordion>

            <Accordion title="Input file (type=file)" defaultOpen>
              File URL.

              File limits:

              - Format: docx, doc, xlsx, xls, pptx, ppt, pdf, txt, key, pages, numbers, md.
              - File size: no more than 100MB.
              - Page limit: no more than 50 pages (validated for pdf, docx, doc, pptx, ppt, key, pages formats).

              Supported input formats:

              1. Public URL:

                 - Supports HTTP or HTTPS protocol.
                 - Example: <a href="https://xxx/xxx.pdf">[https://xxx/xxx.pdf](https://xxx/xxx.pdf)</a>.
            </Accordion>

            <Accordion title="Input web link (type=link)" defaultOpen>
              URL of a public web page. Only supports parsing publicly accessible web pages that do not require login (such as news, blogs, public accounts, etc.).

              Supported input formats:

              1. Public URL:

                 - Supports HTTP or HTTPS protocol.
                 - Example: <a href="https://xxx/article/xxx">[https://xxx/article/xxx](https://xxx/article/xxx)</a>.
            </Accordion>
          </Accordion>
        </Accordion>

        <strong>parameters</strong> `object` (Optional)

        Video processing parameters.

        <Accordion title="Properties" defaultOpen>
          <strong>resolution</strong> `string` (Optional)

          Resolution tier of the generated video. Default value: `1080P`. Valid values:

          - `1080P`
          - `720P`
          - `480P`

          <strong>ratio</strong> `string` (Optional)

          Aspect ratio of the generated video. Valid values:

          - `adaptive` (Default value): Adaptive aspect ratio that automatically recommends a suitable aspect ratio based on the input media proportions and intent.
          - `21:9`
          - `16:9`
          - `4:3`
          - `1:1`
          - `3:4`
          - `9:16`

          <strong>duration</strong> `integer` (Optional)

          Duration of the generated video, in seconds. Default value: 5.

          - Without video input: an integer in the range \[2, 30].
          - With video input: the total input video duration + output video duration must not exceed 30 seconds.
          - When set to `-1`: Smart duration mode, where the model automatically recommends a suitable duration based on the input prompt, content, and rich media.

          <strong>audio</strong> `boolean` (Optional)

          Whether the output video contains audio.

          - `true`: Default value, the output video contains audio.
          - `false`: The output video does not contain an audio track.

          Enabling or disabling audio does not affect pricing.

          <strong>seed</strong> `integer` (Optional)

          Random seed. Used to reproduce generation results. Value range: -1 or \[0, 2147483647]. When set to -1 or not specified, the system automatically generates a random seed. Even with the same seed value, generation results may not be perfectly identical.

          <strong>prompt\_extend</strong> `boolean` (Optional)

          Whether to enable intelligent prompt rewriting. When enabled, a large language model rewrites the input prompt. This significantly improves generation quality for shorter prompts, but increases latency.

          - `true`: Default value, intelligent rewriting is enabled.
          - `false`: Intelligent rewriting is disabled.

          <Tip>
            When a document (`file`) or webpage (`link`) is provided as input, `prompt_extend` must be set to `true`.
          </Tip>

          <strong>watermark</strong> `boolean` (Optional)

          Whether to add a watermark.

          - `false`: Default value, no watermark is added.
          - `true`: A watermark is added.
        </Accordion>
      </td>

      <td>
        <Tabs>
          <Tab title="File Reference to Video">
            Pass in a file through the `file` type, and the model automatically understands the file content to generate a video.

            ```bash
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "A high-end smart glasses product advertisement with a minimalist, futuristic, and fashionable style. The color palette features black, silver-gray, and ice-blue tones with subtle white light accents and parameter UI graphics. Opening in pure black background, a pair of smart glasses slowly emerges from darkness with refined highlights on the temple edges. The camera captures ultra-close details of lenses, nose pads, hinges, temples, and material textures, showcasing metal and high-performance composite materials. The product then rotates slowly in mid-air with minimalist motion graphics displaying core parameters. Then the camera pulls back as all parts precisely reassemble into the complete product, transitioning to a young model wearing demonstration in minimalist spaces and urban lighting environments.",
                    "media": [
                        {
                            "type": "file",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260806/ebapmr/glass.pptx"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "480P",
                    "ratio": "adaptive",
                    "duration": 10,
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="Reference-based Video Generation">
            Pass in reference images, videos, audio, files, or web links through `input.media`, and the model automatically understands the intent to generate a video.

            ```bash expandable
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "Video 1 holds Image 3 and plays a soothing country folk song on the chair in Image 4, saying: '\''The sunshine is so nice today.'\'' Image 1 holds Image 2, passes by Video 1, places Image 2 on the table next to Video 1, and says: '\''That sounds beautiful, can you sing it again?'\''",
                    "media": [
                        {
                            "type": "reference_image",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260408/sjuytr/wan-r2v-object-girl.jpg"
                        },
                        {
                            "type": "reference_video",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260129/qigswt/wan-r2v-role2.mp4"
                        },
                        {
                            "type": "reference_image",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260129/rtjeqf/wan-r2v-object3.png"
                        },
                        {
                            "type": "reference_image",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260129/qpzxps/wan-r2v-object4.png"
                        },
                        {
                            "type": "reference_image",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260129/wfjikw/wan-r2v-backgroud5.png"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "480P",
                    "ratio": "adaptive",
                    "duration": 5,
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="Text-to-Video">
            Generate a video using only `prompt`, without passing in any media files.

            ```bash
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "A kitten running on a rooftop under the moonlight, neon lights of the city flickering in the distance, cinematic quality, smooth camera movement."
                },
                "parameters": {
                    "resolution": "480P",
                    "ratio": "adaptive",
                    "duration": 5,
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="First Frame to Video">
            Only pass in `first_frame` to strictly specify the first frame image of the video.

            ```bash
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "A cat running on the grass",
                    "media": [
                        {
                            "type": "first_frame",
                            "url": "https://cdn.translate.alibaba.com/r/wanx-demo-1.png"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "480P",
                    "ratio": "adaptive",
                    "duration": 5,
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="First-Last Frame to Video">
            Only `first_frame` and `last_frame` are supported to strictly specify the first and last frame images of the video.

            ```bash expandable
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "At dawn, the sun just rises. In a pumpkin patch, a small pumpkin hangs with dewdrops. Suddenly, the pumpkin cracks open with a snap, golden light shines through, white mist appears, and a little rabbit emerges from the center of the cracked pumpkin.",
                    "media": [
                        {
                            "type": "first_frame",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260414/welyei/wan2.7-i2v-first-frame.webp"
                        },
                        {
                            "type": "last_frame",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260414/zongha/wan2.7-i2v-last-frame.webp"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "480P",
                    "ratio": "adaptive",
                    "duration": 5,
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="Video Editing">
            Pass in a video to edit through the `reference_video` type, combined with a `prompt` instruction to edit the video content.

            ```bash
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "Transform the entire scene into a clay art style",
                    "media": [
                        {
                            "type": "reference_video",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260402/ldnfdf/wan2.7-videoedit-style-change.mp4"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "720P",
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>

          <Tab title="Video Extension">
            Pass in the original video through the `reference_video` type, combined with a `prompt` containing extension-intent keywords to extend the video content. Set `ratio` to `adaptive`.

            ```bash
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "wan3.0-video",
                "input": {
                    "prompt": "Extend Video 1 forward: the baker brings out the brushed bread, sets the brush aside, and the camera follows the baker to the oven in the back for baking",
                    "media": [
                        {
                            "type": "reference_video",
                            "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260402/ldnfdf/wan2.7-videoedit-style-change.mp4"
                        }
                    ]
                },
                "parameters": {
                    "resolution": "720P",
                    "ratio": "adaptive",
                    "prompt_extend": true
                }
            }'
            ```
          </Tab>
        </Tabs>
      </td>
    </tr>
  </tbody>
</table>

<table bordertype="no-border" style={{ display: "table", tableLayout: "fixed", width: "100%" }}>
  <colgroup>
    <col style={{ width: "50%" }} />

    <col style={{ width: "50%" }} />
  </colgroup>

  <tbody>
    <tr>
      <td>
        #### Response parameters <span id="w30resp01h" />

        <strong>output</strong> `object`

        Task output information.

        <Accordion title="Properties" defaultOpen>
          <strong>task\_id</strong> `string`

          The task ID. Valid for queries for 24 hours.

          <strong>task\_status</strong> `string`

          The status of the task.

          <Accordion title="Enumeration values" defaultOpen>
            - PENDING
            - RUNNING
            - SUCCEEDED
            - FAILED
            - CANCELED
            - UNKNOWN: The task does not exist or its status is unknown.
          </Accordion>
        </Accordion>

        <strong>request\_id</strong> `string`

        Unique request identifier for tracing and troubleshooting.

        <strong>code</strong> `string`

        Error code. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).

        <strong>message</strong> `string`

        Detailed error message. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).
      </td>

      <td>
        <Tabs>
          <Tab title="Successful response">
            Save the `task_id` to query the task status and result.

            ```json
            {
                "output": {
                    "task_status": "PENDING",
                    "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
                },
                "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
            }
            ```
          </Tab>

          <Tab title="Error response">
            Task creation failed. See [Error codes](/help/en/model-studio/error-code).

            ```json
            {
                "code": "InvalidApiKey",
                "message": "Invalid API-key provided.",
                "request_id": "7438d53d-6eb8-4596-8835-xxxxxx"
            }
            ```
          </Tab>
        </Tabs>
      </td>
    </tr>
  </tbody>
</table>

### Step 2: Query results by task ID <span id="w30step2t" />

<Tabs>
  <Tab title="Singapore">
    `GET https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="Beijing">
    `GET https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="US (Virginia)">
    `GET https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="Japan (Tokyo)">
    `GET https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="Germany (Frankfurt)">
    `GET https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="China (Hong Kong)">
    `GET https://{WorkspaceId}.cn-hongkong.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>
</Tabs>

<Note>
  - <strong>Polling recommendation</strong>: Video generation takes several minutes. Use a polling mechanism with a reasonable interval, such as 15 seconds.
  - <strong>Task state transition</strong>: PENDING → RUNNING → SUCCEEDED or FAILED.
  - <strong>Result link</strong>: After a task succeeds, a video URL valid for <strong>24 hours</strong> is returned. Download and save the video to permanent storage, such as [OSS](https://www.alibabacloud.com/help/en/oss/user-guide/what-is-oss).
  - `task_id`<strong>validity</strong>: <strong>24 hours</strong>. After this period, queries return the task status as `UNKNOWN`.
</Note>

<table bordertype="no-border" style={{ display: "table", tableLayout: "fixed", width: "100%" }}>
  <colgroup>
    <col style={{ width: "50%" }} />

    <col style={{ width: "50%" }} />
  </colgroup>

  <tbody>
    <tr>
      <td>
        #### Request parameters <span id="w30s2req01h" />

        ##### Request headers (Headers) <span id="w30s2req02h" />

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        ##### URL path parameters (Path parameters) <span id="w30s2req04h" />

        <strong>task\_id</strong> `string` <strong>(Required)</strong>

        The ID of the task.
      </td>

      <td>
        <Tabs>
          <Tab title="Query task results">
            Replace `{task_id}` with the `task_id` value returned by the previous API call. The `task_id` is valid for queries for 24 hours, Replace `{WorkspaceId}` with your actual [workspace ID](/help/en/model-studio/regions#h2_migrate_domain).

            ```bash
            curl -X GET https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/tasks/{task_id} \
            --header "Authorization: Bearer $DASHSCOPE_API_KEY"
            ```
          </Tab>
        </Tabs>
      </td>
    </tr>
  </tbody>
</table>

<table bordertype="no-border" style={{ display: "table", tableLayout: "fixed", width: "100%" }}>
  <colgroup>
    <col style={{ width: "50%" }} />

    <col style={{ width: "50%" }} />
  </colgroup>

  <tbody>
    <tr>
      <td>
        #### Response parameters <span id="w30s2resp01h" />

        <strong>output</strong> `object`

        Task output information.

        <Accordion title="Properties" defaultOpen>
          <strong>task\_id</strong> `string` <strong>(Required)</strong>

          The ID of the task.

          <strong>task\_status</strong> `string`

          Task status.

          <Accordion title="Enumeration values" defaultOpen>
            - PENDING
            - RUNNING
            - SUCCEEDED
            - FAILED
            - CANCELED
            - UNKNOWN: The task does not exist or its status is unknown.
          </Accordion>

          <strong>submit\_time</strong> `string`

          The time when the task was submitted. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>scheduled\_time</strong> `string`

          The time when the task was executed. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>end\_time</strong> `string`

          The time when the task was completed. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>orig\_prompt</strong> `string`

          The original input prompt.

          <strong>video\_url</strong> `string`

          URL of the generated video. Returned when the task succeeds. The video format is MP4 (H.264 encoding).

          <strong>code</strong> `string`

          Error code. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).

          <strong>message</strong> `string`

          Detailed error message. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).
        </Accordion>

        <strong>usage</strong> `object`

        Output statistics. Only counts successful results.

        <Accordion title="Properties" defaultOpen>
          <strong>video\_count</strong> `integer`

          Number of generated videos. Fixed at 1.

          <strong>duration</strong> `float`

          Total video duration, in seconds. When no input reference video is provided, it equals the output video duration; when an input reference video is provided, it equals the sum of the input video duration and the output video duration.

          <strong>input\_video\_duration</strong> `float`

          Duration of the input video, in seconds. Returns 0.0 when no video is provided as input.

          <strong>output\_video\_duration</strong> `float`

          Duration of the output video, in seconds.

          <strong>fps</strong> `integer`

          Frame rate of the generated video. Default value: 30.

          <strong>SR</strong> `integer`

          Resolution of the generated video. Example: 720.

          <strong>ratio</strong> `string`

          Aspect ratio of the generated video. Example: 16:9.
        </Accordion>

        <strong>request\_id</strong> `string`

        Unique request identifier for tracing and troubleshooting.
      </td>

      <td>
        <Tabs>
          <Tab title="Task succeeded">
            Video URLs are valid for only 24 hours and then automatically purged. Save generated videos promptly.

            ```json
            {
                "request_id": "78c9b768-0285-996c-b682-xxxxxx",
                "output": {
                    "task_id": "17ed7e50-00cf-4509-aea1-xxxxxx",
                    "task_status": "SUCCEEDED",
                    "submit_time": "2026-08-06 10:01:35.452",
                    "scheduled_time": "2026-08-06 10:01:35.507",
                    "end_time": "2026-08-06 10:13:33.838",
                    "orig_prompt": "A golden retriever running on a sunny beach, waves crashing in the background, cinematic lighting",
                    "video_url": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxx/video.mp4"
                },
                "usage": {
                    "video_count": 1,
                    "duration": 5.0,
                    "input_video_duration": 0.0,
                    "output_video_duration": 5.0,
                    "fps": 30,
                    "SR": 720,
                    "ratio": "16:9"
                }
            }
            ```
          </Tab>

          <Tab title="Task failed">
            When a task fails, `task_status` is FAILED with an error code and message. See [Error codes](/help/en/model-studio/error-code).

            ```json
            {
                "request_id": "e5e57877-c0fc-47ed-8fad-xxxxxx",
                "output": {
                    "task_id": "eff1443c-ccab-4676-aad3-xxxxxx",
                    "task_status": "FAILED",
                    "code": "InvalidParameter",
                    "message": "The two modes are mutually exclusive. Do not pass reference_xx and first_frame/last_frame at the same time."
                }
            }
            ```
          </Tab>

          <Tab title="Task query expired">
            The `task_id` is valid for 24 hours. After this period, queries return the following error.

            ```json
            {
                "request_id": "a4de7c32-7057-9f82-8581-xxxxxx",
                "output": {
                    "task_id": "502a00b1-19d9-4839-a82f-xxxxxx",
                    "task_status": "UNKNOWN"
                }
            }
            ```
          </Tab>
        </Tabs>
      </td>
    </tr>
  </tbody>
</table>

## Material combinations <span id="w30media_combo_t" />

<Note>
  Only the following specific material combinations are supported. Passing in other combinations will result in an error.
</Note>

**Text-to-Video**: Only pass in `prompt`. `media` is not supported.

```json
// Text-to-Video
{
  "input": {
    "prompt": "..."
  }
}
```

**Image-to-Video, Reference-based Video Generation, Video Editing, Video Extension, and other modes** require passing in materials through the `media` array, with each element specifying `type` and `url`. `type` combination rules:

- `first_frame`/`last_frame` and `reference_image`/`reference_video`/`reference_audio`/`file`/`link` types are mutually exclusive and cannot be used together in the same request.
- `file` and `link` are mutually exclusive (choose one), but both can be combined with `reference_image`/`reference_video`/`reference_audio`.
- `reference_image`/`reference_video`/`reference_audio` can be freely combined with each other.

<CodeGroup>
  ```json First Frame to Video
  // First frame only
  {
    "media": [
      { "type": "first_frame", "url": "..." }
    ]
  }
  ```

  ```json First-Last Frame to Video
  // First frame + last frame only
  {
    "media": [
      { "type": "first_frame", "url": "..." },
      { "type": "last_frame", "url": "..." }
    ]
  }
  ```

  ```json Reference-based Video Generation
  // reference_image, reference_video, reference_audio can be freely combined

  // Reference image only
  {
    "media": [
      { "type": "reference_image", "url": "..." }
    ]
  }

  // Reference video only
  {
    "media": [
      { "type": "reference_video", "url": "..." }
    ]
  }

  // Reference audio only
  {
    "media": [
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // Image + video
  {
    "media": [
      { "type": "reference_image", "url": "..." },
      { "type": "reference_video", "url": "..." }
    ]
  }

  // Image + audio
  {
    "media": [
      { "type": "reference_image", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // Video + audio
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // Image + video + audio
  {
    "media": [
      { "type": "reference_image", "url": "..." },
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }
  ```

  ```json File/Web Page to Video
  // Must include file or link (choose one), can be freely combined with reference_image/reference_video/reference_audio

  // File only
  {
    "media": [
      { "type": "file", "url": "..." }
    ]
  }

  // File + image
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_image", "url": "..." }
    ]
  }

  // File + video
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_video", "url": "..." }
    ]
  }

  // File + audio
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // File + image + video
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_image", "url": "..." },
      { "type": "reference_video", "url": "..." }
    ]
  }

  // File + image + audio
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_image", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // File + video + audio
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // File + image + video + audio
  {
    "media": [
      { "type": "file", "url": "..." },
      { "type": "reference_image", "url": "..." },
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }
  ```

  ```json Video Editing
  // Must include reference_video, can be combined with reference_image/reference_audio
  // Prompt contains editing intent

  // Reference video only
  {
    "media": [
      { "type": "reference_video", "url": "..." }
    ]
  }

  // Video + image
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_image", "url": "..." }
    ]
  }

  // Video + audio
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // Video + image + audio
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_image", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }
  ```

  ```json Video Extension
  // Must include reference_video, can be combined with reference_image/reference_audio
  // Prompt contains extension intent

  // Reference video only
  {
    "media": [
      { "type": "reference_video", "url": "..." }
    ]
  }

  // Video + image
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_image", "url": "..." }
    ]
  }

  // Video + audio
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }

  // Video + image + audio
  {
    "media": [
      { "type": "reference_video", "url": "..." },
      { "type": "reference_image", "url": "..." },
      { "type": "reference_audio", "url": "..." }
    ]
  }
  ```
</CodeGroup>

## FAQ <span id="w30faq01t" />

### Why can't I pass in audio or other media assets in first/first-last frame mode? <span id="w30faq02t" />

Wan3.0's first frame/first-last frame mode only supports `first_frame` and `last_frame`, and cannot accept other types such as audio at the same time (see [Material combinations](#w30media_combo_t)).

Difference from [Wan2.7 Image-to-Video series](/help/en/model-studio/wan-image-to-video-guide): Wan2.7's first frame/first-last frame mode supports passing in `driving_audio` for audio-driven generation; Wan3.0's first frame/first-last frame mode does not. If you need audio-driven generation, use the all-modal reference mode (`reference_image` + `reference_audio` combination) instead. For specific usage, see [Wan3.0 - Video Generation Guide](/help/en/model-studio/wan3-video-generation-guide).