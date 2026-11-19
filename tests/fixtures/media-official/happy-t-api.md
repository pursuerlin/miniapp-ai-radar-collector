# HappyHorse text-to-video API reference

> Generate physically realistic, motion-smooth video from text prompts with the HappyHorse model.

## Availability <span id="hh01scope-title" /> <span id="hh01scope" />

The model, endpoint URL, and API key must belong to the <strong>same region</strong>. Cross-region calls fail.

- [<strong>Select a model</strong>](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market): Check which region the model belongs to.
- <strong>Select a URL</strong>: Use the region's endpoint URL. HTTP is supported.
- <strong>Configure an API key</strong>: Get an [API key](/help/en/model-studio/get-api-key) for the region, and then [Export API key as environment variable](/help/en/model-studio/get-api-key).

<Note>
  The sample code in this topic applies to the <strong>Singapore region</strong>.
</Note>

<Tip>
  Alibaba Cloud Model Studio has released workspace-specific domains for the China (Beijing) and Singapore regions. <strong>The new dedicated domains deliver superior performance and higher stability for inference requests</strong>. We recommend migrating to the new domains:

  - China (Beijing): from `https://dashscope.aliyuncs.com` to `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com`
  - Singapore: from `https://dashscope-intl.aliyuncs.com` to `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`

  `{WorkspaceId}` is your workspace ID, which can be found on the <strong>Workspace Details</strong> page in the Alibaba Cloud Model Studio console. The existing domain remains fully functional.
</Tip>

## HTTP request <span id="hh01http-title" /> <span id="hh01http" />

Text-to-video tasks typically take 1 to 5 minutes. The API uses asynchronous calls with two steps: <strong>"Create a task → Poll for results"</strong>.

### Step 1: Create a task and get the task ID <span id="hh01step1-title" /> <span id="hh01step1" />

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
        #### Request parameters <span id="hh01req-header-h4" />

        <strong>Content-Type</strong> `string` <strong>(Required)</strong>

        The content type of the request. Must be `application/json`.

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        <strong>X-DashScope-Async</strong> `string` <strong>(Required)</strong>

        Enables asynchronous processing. HTTP requests support only asynchronous calls. Must be `enable`.

        <Tip>
          If this request header is missing, the error "current user api does not support synchronous calls" is returned.
        </Tip>

        ##### Request body <span id="hh01req-body-h5" />

        <strong>model</strong> `string` <strong>(Required)</strong>

        The model name. For available models, see the [Model Studio console](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market).

        Example: `happyhorse-1.1-t2v`.

        <strong>input</strong> `object` <strong>(Required)</strong>

        Model input.

        <Accordion title="Properties" defaultOpen>
          <strong>prompt</strong> `string` <strong>(Required)</strong>

          Text description of the video to generate.

          Supports any language. Maximum 5,000 non-Chinese characters or 2,500 Chinese characters. Excess is truncated.
        </Accordion>

        <strong>parameters</strong> `object` (Optional)

        Video output settings (resolution, aspect ratio, duration).

        <Accordion title="Properties" defaultOpen>
          <strong>resolution</strong> `string` (Optional)

          Output video resolution.

          Valid values:

          - `480P`
          - `720P`
          - `1080P` (default)

          <strong>ratio</strong> `string` (Optional)

          Output video aspect ratio.

          Valid values:

          - `16:9` (default)
          - `9:16`
          - `1:1`
          - `4:3`
          - `3:4`
          - `4:5`
          - `5:4`
          - `9:21`
          - `21:9`

          <strong>duration</strong> `integer` (Optional)

          Output video duration in seconds.

          - happyhorse-1.0-t2v: 3–15. Default: `5`.

          <strong>watermark</strong> `boolean` (Optional)

          Whether to add a watermark. Displays "HappyHorse" in the lower-right corner.

          - `true` (default)
          - `false`

          <strong>seed</strong> `integer` (Optional)

          The random number seed must be an integer in the range `[0, 2147483647]`.

          If not specified, a random seed is generated. A fixed seed improves reproducibility.

          Because model generation is probabilistic, the same seed does not guarantee identical results.
        </Accordion>
      </td>

      <td>
        <Tabs>
          <Tab title="Text-to-video">
            ```bash
            # The following URL is for the Singapore region. When calling, replace {WorkspaceId} with your actual workspace ID. URLs vary by region.
            curl --location 'https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
                -H 'X-DashScope-Async: enable' \
                -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
                -H 'Content-Type: application/json' \
                -d '{
                "model": "happyhorse-1.1-t2v",
                "input": {
                    "prompt": "A miniature city built from cardboard and bottle caps comes to life at night. A cardboard train slowly passes through, with small lights dotting the scene and illuminating the way ahead."
                },
                "parameters": {
                    "resolution": "720P",
                    "ratio": "16:9",
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
        #### Response parameters <span id="hh01resp1-header-h4" /> <span id="hh01step1-resp" />

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

### Step 2: Query the result by task ID <span id="hh01step2-title" /> <span id="hh01step2" />

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
        #### Request parameters <span id="hh01step2-req-header-h4" /> <span id="hh01step2-req" />

        ##### Headers <span id="hh01step2-headers-h5" />

        <strong>Authorization</strong> `string` <strong>(Required)</strong>

        Authenticates the request with a Model Studio API key. Example: Bearer sk-xxxx.

        ##### Path parameters <span id="hh01step2-path-h5" />

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
        #### Response parameters <span id="hh01resp2-header-h4" /> <span id="hh01step2-resp" />

        <strong>output</strong>`object`

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

          <strong>video\_url</strong> `string`

          URL of the generated video. Returned only when `task_status` is SUCCEEDED.

          Valid for 24 hours. The video is in MP4 format with H.264 encoding.

          <strong>orig\_prompt</strong> `string`

          The original input prompt, corresponding to the request parameter `prompt`.

          <strong>code</strong> `string`

          Error code. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).

          <strong>message</strong> `string`

          Detailed error message. Returned only for failed requests. See [Error codes](/help/en/model-studio/error-code).
        </Accordion>

        <strong>usage</strong> `object`

        Output statistics. Only successful tasks are counted.

        <Accordion title="Properties" defaultOpen>
          <strong>input\_video\_duration</strong> `integer`

          Input video duration in seconds.

          <strong>output\_video\_duration</strong> `integer`

          Output video duration in seconds.

          <strong>duration</strong> `integer`

          Total video duration for billing.

          <strong>SR</strong> `integer`

          Output video resolution.

          <strong>ratio</strong> `string`

          Output video aspect ratio.

          <strong>video\_count</strong> `integer`

          Number of output videos. Always 1.
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
                "request_id": "99243b47-ec5f-9413-9993-xxxxxx",
                "output": {
                    "task_id": "4673458e-28be-4a05-bf2a-xxxxxx",
                    "task_status": "SUCCEEDED",
                    "submit_time": "2026-04-20 17:55:17.075",
                    "scheduled_time": "2026-04-20 17:55:17.129",
                    "end_time": "2026-04-20 17:56:36.658",
                    "orig_prompt": "A miniature city built from cardboard and bottle caps comes to life at night. A cardboard train slowly passes through, with small lights dotting the scene and illuminating the way ahead.",
                    "video_url": "https://dashscope-result.oss-cn-beijing.aliyuncs.com/xxx.mp4?Expires=xxx"
                },
                "usage": {
                    "duration": 5,
                    "input_video_duration": 0,
                    "output_video_duration": 5,
                    "video_count": 1,
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

Failed API calls return error codes documented in [Error messages](/help/en/model-studio/error-code).