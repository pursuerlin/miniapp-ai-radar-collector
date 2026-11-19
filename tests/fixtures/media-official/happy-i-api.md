# HappyHorse image-to-video (first frame) API reference

> Generate realistic, smooth-motion videos from a first-frame image and an optional text prompt using the HappyHorse model.

## Usage notes <span id="hhi2vscope-title" /> <span id="hhi2vscope" />

The model, endpoint URL, and API key must belong to the <strong>same region</strong>. Cross-region calls fail.

- [<strong>Select a model</strong>](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market): Check which region the model belongs to.
- <strong>Select a URL</strong>: Select the endpoint URL for the same region.
- <strong>Configure an API key</strong>: Get an [API key](/help/en/model-studio/get-api-key) for the same region, and then [configure the API key as an environment variable](/help/en/model-studio/get-api-key).

<Note>
  The sample code in this topic applies to the <strong>Singapore</strong> region.
</Note>

<Tip>
  Alibaba Cloud Model Studio has released workspace-specific domains for the China (Beijing) and Singapore regions. <strong>The new dedicated domains deliver superior performance and higher stability for inference requests</strong>. We recommend migrating to the new domains:

  - China (Beijing): from `https://dashscope.aliyuncs.com` to `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com`
  - Singapore: from `https://dashscope-intl.aliyuncs.com` to `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`

  `{WorkspaceId}` is your workspace ID, which can be found on the <strong>Workspace Details</strong> page in the Alibaba Cloud Model Studio console. The existing domain remains fully functional.
</Tip>

## HTTP calls <span id="hhi2vhttp-title" /> <span id="hhi2vhttp" />

Image-to-video tasks take 1–5 minutes. The API uses asynchronous calls: <strong>"Create a task → poll for the result"</strong>.

### Step 1: Create a task <span id="hhi2vstep1-title" /> <span id="hhi2vstep1" />

<Tabs>
  <Tab title="Singapore">
    `POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="US (Virginia)">
    `POST https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="China (Beijing)">
    `POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="Germany (Frankfurt)">
    `POST https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
  </Tab>

  <Tab title="Japan (Tokyo)">
    `POST https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
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
        #### Request parameters <span id="hhi2vreq-header-h4" />

        <strong>Content-Type</strong> `string` <strong>(Required)</strong>

        The content type of the request. Must be `application/json`.

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        <strong>X-DashScope-Async</strong> `string` <strong>(Required)</strong>

        Enables asynchronous processing. HTTP requests support only asynchronous calls. Must be `enable`.

        <Tip>
          If this request header is missing, the error "current user api does not support synchronous calls" is returned.
        </Tip>

        ##### Request body <span id="hhi2vreq-body-h5" />

        <strong>model</strong> `string` <strong>(required)</strong>

        The model name. For available models, see the [Model Studio console](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market).

        Example: `happyhorse-1.1-i2v`.

        <strong>input</strong> `object` <strong>(required)</strong>

        Model input, including the text prompt.

        <Accordion title="Properties" defaultOpen>
          <strong>prompt</strong> `string` (optional)

          Describes the video content to generate.

          Supports any language. Maximum: 5,000 non-Chinese characters or 2,500 Chinese characters. Longer input is truncated.

          <strong>media</strong> `array` <strong>(required)</strong>

          The input image array.

          <Accordion title="media[] element properties" defaultOpen>
            <strong>type</strong> `string` <strong>(required)</strong>

            The type of media. Allowed value:

            - `first_frame`: The first frame.

            Exactly one first-frame image is required.

            <strong>url</strong> `string` <strong>(required)</strong>

            The URL of the media.

            <Accordion title="Input image (type=first_frame)" defaultOpen>
              The URL or Base64-encoded data of the first frame image.

              Image constraints:

              - Formats: JPEG, JPG, PNG, WEBP.
              - Resolution: Width and height must both be at least 300 pixels.
              - Aspect ratio: Between 1:2.5 and 2.5:1.
              - File size: Up to 20 MB.

              Supported input formats:

              1. Public URL:

                 - HTTP and HTTPS are supported.
                 - Example: <a href="https://xxx/xxx.png">[https://xxx/xxx.png](https://xxx/xxx.png)</a>.
              2. Base64-encoded image string:

                 - Format: `data:{MIME_type};base64,{base64_data}`.
                 - Example: data:image/png;base64,GDU7MtCZzEbTbmRZ...... (truncated for display).

                   <Accordion title="Base64 encoding format" defaultOpen>
                     Format: `data:{MIME_type};base64,{base64_data}` .

                     - \{base64\_data}: The Base64-encoded string of the image file.
                     - \{MIME\_type}: The media type of the image, which must match the file format.

                     <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><tbody><tr><td><p>Image format</p></td><td><p>MIME Type</p></td></tr><tr><td><p>JPEG</p></td><td><p>image/jpeg</p></td></tr><tr><td><p>JPG</p></td><td><p>image/jpeg</p></td></tr><tr><td><p>PNG</p></td><td><p>image/png</p></td></tr><tr><td><p>WEBP</p></td><td><p>image/webp</p></td></tr></tbody></table>
                   </Accordion>
            </Accordion>
          </Accordion>
        </Accordion>

        <strong>parameters</strong> `object` (optional)

        Video output settings such as resolution and duration.

        <Accordion title="Properties" defaultOpen>
          <strong>resolution</strong> `string` (optional)

          The resolution of the generated video.

          Output pixel count approximates the selected tier while preserving the input image's aspect ratio.

          Allowed values:

          - `480P`
          - `720P`
          - `1080P` (Default)

          <strong>duration</strong> `integer` (optional)

          The duration of the generated video, in seconds.

          The value must be an integer in the range \[3, 15]. Default: `5`.

          <strong>watermark</strong> `boolean` (optional)

          Adds a "Happy Horse" text watermark to the bottom-right corner.

          - `true` (Default)
          - `false`

          <strong>seed</strong> `integer` (Optional)

          The random number seed must be an integer in the range `[0, 2147483647]`.

          If not specified, a random seed is generated. A fixed seed improves reproducibility.

          Because model generation is probabilistic, the same seed does not guarantee identical results.
        </Accordion>
      </td>

      <td>
        <Tabs>
          <Tab title="Image-to-video">
            ```bash
            # The following URLs are for the Singapore region. Replace {WorkspaceId} with your Bailian workspace ID. URLs vary by region.
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "happyhorse-1.1-i2v",
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
                    "resolution": "720P",
                    "duration": 5
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
        #### Response parameters <span id="hhi2vresp1-header-h4" /> <span id="hhi2vstep1-resp" />

        <strong>output</strong> `object`

        The task's output.

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

### Step 2: Poll for the result <span id="hhi2vstep2-title" /> <span id="hhi2vstep2" />

<Tabs>
  <Tab title="Singapore">
    `GET https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="US (Virginia)">
    `GET https://{WorkspaceId}.us-east-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="China (Beijing)">
    `GET https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="Germany (Frankfurt)">
    `GET https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>

  <Tab title="Japan (Tokyo)">
    `GET https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/api/v1/tasks/{task_id}`
  </Tab>
</Tabs>

<Note>
  - <strong>Polling recommendation</strong>: Video generation takes several minutes. Use a polling mechanism with a reasonable interval, such as 15 seconds.
  - <strong>Task state transition</strong>: PENDING → RUNNING → SUCCEEDED or FAILED.
  - <strong>Result link</strong>: After a task succeeds, a video URL valid for <strong>24 hours</strong> is returned. Download and save the video to permanent storage, such as [OSS](https://www.alibabacloud.com/help/en/doc-detail/31817.htm).
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
        #### Request parameters <span id="hhi2vstep2-req-header-h4" /> <span id="hhi2vstep2-req" />

        ##### Request headers <span id="hhi2vstep2-headers-h5" />

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        ##### Path parameters <span id="hhi2vstep2-path-h5" />

        <strong>task\_id</strong> `string` <strong>(Required)</strong>

        The ID of the task.
      </td>

      <td>
        <Tabs>
          <Tab title="Query task result">
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
        #### Response parameters <span id="hhi2vresp2-header-h4" /> <span id="hhi2vstep2-resp" />

        <strong>output</strong>`object`

        The task's output.

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

          <strong>State transitions during polling:</strong>

          - PENDING → RUNNING → SUCCEEDED or FAILED.
          - The initial query status is usually PENDING or RUNNING.
          - When the status changes to SUCCEEDED, the response contains the generated video URL.
          - If the status is FAILED, check the error message and retry the task.

          <strong>submit\_time</strong> `string`

          The time when the task was submitted. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>scheduled\_time</strong> `string`

          The time when the task was executed. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>end\_time</strong> `string`

          The time when the task was completed. The time is in UTC+8 and the format is YYYY-MM-DD HH:mm:ss.SSS.

          <strong>video\_url</strong>`string`

          Returned only when `task_status` is `SUCCEEDED`.

          The URL is valid for 24 hours. Download the MP4 video (24 fps, H.264 encoded) from this URL.

          <strong>orig\_prompt</strong> `string`

          The original input prompt, corresponding to the request parameter `prompt`.

          <strong>code</strong> `string`

          Error code. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).

          <strong>message</strong> `string`

          Detailed error message. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).
        </Accordion>

        <strong>usage</strong> `object`

        Usage statistics. Calculated only for successful tasks.

        <Accordion title="Properties" defaultOpen>
          <strong>input\_video\_duration</strong> `integer`

          The duration of the input video, in seconds.

          <strong>output\_video\_duration</strong> `integer`

          The duration of the output video, in seconds.

          <strong>duration</strong> `integer`

          The total video duration used for billing.

          <strong>SR</strong> `integer`

          The resolution of the output video.

          <strong>video\_count</strong> `integer`

          The number of output videos. This value is always 1.
        </Accordion>

        <strong>request\_id</strong> `string`

        Unique request identifier for tracing and troubleshooting.
      </td>

      <td>
        <Tabs>
          <Tab title="Task successful">
            Video URLs are valid for only 24 hours and then automatically purged. Save generated videos promptly.

            ```json
            {
                "request_id": "8ae698ba-df2d-966c-abcf-xxxxxx",
                "output": {
                    "task_id": "e56d806f-76f9-4037-aefa-xxxxxx",
                    "task_status": "SUCCEEDED",
                    "submit_time": "2026-04-20 19:33:50.425",
                    "scheduled_time": "2026-04-20 19:33:50.463",
                    "end_time": "2026-04-20 19:35:34.216",
                    "orig_prompt": "A cat running on the grass",
                    "video_url": "https://dashscope-result.oss-cn-beijing.aliyuncs.com/xxx.mp4?Expires=xxx"
                },
                "usage": {
                    "duration": 5,
                    "input_video_duration": 0,
                    "output_video_duration": 5,
                    "video_count": 1,
                    "SR": 720
                }
            }
            ```
          </Tab>

          <Tab title="Task failed">
            When a task fails, `task_status` is FAILED with an error code and message. See [Error codes](/help/en/model-studio/error-code).

            ```json
            {
                "request_id": "e5d70b02-ebd3-98ce-9fe8-759d7d7b107d",
                "output": {
                    "task_id": "86ecf553-d340-4e21-af6e-a0c6a421c010",
                    "task_status": "FAILED",
                    "code": "InvalidParameter",
                    "message": "The parameter is invalid."
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

## Error codes <span id="0d0a562d05nkh" /> <span id="2e1d8db361w9w" />

If a call fails, check the [error messages](/help/en/model-studio/error-code) reference.

## FAQ <span id="hhi2vfaq-title" /> <span id="hhi2vfaq" />

#### Video aspect ratio <span id="hhi2vfaq-q2-title" /> <span id="hhi2vfaq-q2" />

Output aspect ratio matches the first frame. Unlike the [HappyHorse text-to-video](/help/en/model-studio/happyhorse-text-to-video-api-reference) model, image-to-video does not support the `ratio` parameter.