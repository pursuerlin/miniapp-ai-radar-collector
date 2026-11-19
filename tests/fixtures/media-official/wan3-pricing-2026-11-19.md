# wan3.0-video

> Wan3.0-Video is an All-in-One video generation model that supports multi-modal inputs including text, image, video, and audio, enabling text-to-video, image-to-video (first frame/first-last frame), and reference-based video generation within a single model. It supports 480P, 720P, and 1080P resolution output, with a maximum video duration of 30 seconds.

## Inference service provider <span id="h-01a1b2c3d5" />

The inference service for the `wan3.0-video` model is provided by Alibaba Cloud Model Studio.

## Model capabilities <span id="h-02a1b2c3d5" />

<table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /></colgroup><thead><tr><th><p>Capability</p></th><th><p>Support status</p></th><th><p>Capability</p></th><th><p>Support status</p></th></tr></thead><tbody><tr><td><p>Input modalities</p></td><td><p><strong>Text</strong> <strong>Image</strong> <strong>Video</strong> <strong>Audio</strong> <strong>File</strong> <strong>Link</strong></p></td><td><p>Output modalities</p></td><td><p><strong>Video</strong></p></td></tr><tr><td><p>Model playground</p></td><td><p>Supported</p></td><td><p>Function Calling</p></td><td><p>Unsupported</p></td></tr><tr><td><p>Structured output</p></td><td><p>Unsupported</p></td><td><p>Web search</p></td><td><p>Unsupported</p></td></tr><tr><td><p>Prefix completion</p></td><td><p>Unsupported</p></td><td><p>Context caching</p></td><td><p>Unsupported</p></td></tr><tr><td><p>Batch inference</p></td><td><p>Unsupported</p></td><td><p>Model fine-tuning</p></td><td><p>Unsupported</p></td></tr></tbody></table>

## Context limits <span id="h-03a1b2c3d5" />

<table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /><col style={{ width: "25%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>Maximum input length</p></td><td><p>—</p></td><td><p>Maximum output length</p></td><td><p>—</p></td></tr><tr><td><p>Context length</p></td><td><p>—</p></td><td /><td /></tr></tbody></table>

## Pricing <span id="h-05a1b2c3d5" />

This topic only shows the original price for model calls, excluding any limited-time promotions or other offers. Please visit the [Model Studio console](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market) for promotional offers.

Billing rule: Both input videos and output videos are billed by <strong>video seconds</strong>. The price is determined by the output video's resolution. Billable duration = input video duration + output video duration.

<Tabs>
  <Tab title="China (Beijing)">
    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.041256</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.082513</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.165025</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Singapore">
    Deployment scope: International

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.05</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.1</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.2</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Japan (Tokyo)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.041256</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.082513</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.165025</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Germany (Frankfurt)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.041256</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.082513</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.165025</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>

  <Tab title="US (Virginia)">
    Service scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.041256</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.082513</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.165025</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>

  <Tab title="China (Hong Kong)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /><col style={{ width: "33.333333%" }} /></colgroup><thead><tr><th><p>Billing item</p></th><th><p>Input and output price (USD)</p></th><th><p>Unit</p></th></tr></thead><tbody><tr><td><p>Video generation (480P)</p></td><td><p>0.041256</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (720P)</p></td><td><p>0.082513</p></td><td><p>Per second</p></td></tr><tr><td><p>Video generation (1080P)</p></td><td><p>0.165025</p></td><td><p>Per second</p></td></tr></tbody></table>
  </Tab>
</Tabs>

## Rate limits <span id="h-07a1b2c3d5" />

<Tabs>
  <Tab title="China (Beijing)">
    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Singapore">
    Deployment scope: International

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Japan (Tokyo)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>

  <Tab title="Germany (Frankfurt)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>

  <Tab title="US (Virginia)">
    Service scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>

  <Tab title="China (Hong Kong)">
    Deployment scope: Global

    <table style={{ display: "table", tableLayout: "fixed", width: "100%" }}><colgroup><col style={{ width: "50%" }} /><col style={{ width: "50%" }} /></colgroup><thead><tr><th><p>Parameter</p></th><th><p>Value</p></th></tr></thead><tbody><tr><td><p>RPM (Requests per minute)</p></td><td><p>300</p></td></tr></tbody></table>
  </Tab>
</Tabs>