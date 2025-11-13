<!-- 2465069d-b8e4-4a02-bc42-bb3810d9cbd9 00d331b9-03b6-4b18-9832-b9dd13678403 -->
# Artifact Preview Improvements

## Changes

1. **Extract HTML from markdown code blocks** (`frontend/src/components/artifacts/PreviewRenderer.tsx`)

- When fetching HTML content, check if it's wrapped in ```html ``` code blocks
- Extract only the content between the markers before setting it as HTML content
- Handle both ```html and ``` markers

2. **Default preview to open** (`frontend/src/components/jobs/ArtifactPreview.tsx`)

- Change `showPreview` initial state from `false` to `true` (line 24)
- This makes artifact previews visible by default when viewing execution steps

3. **Truncate long URLs** (`frontend/src/components/jobs/StepInputOutput.tsx`)

- Truncate image URLs displayed in the image section (line 261)
- Truncate artifact URLs in the artifact display section (line 295)
- Show a reasonable length (e.g., first 50 chars + "...") with full URL in title attribute for hover

4. **Show generated images in preview** (`frontend/src/components/jobs/ExecutionSteps.tsx` and new component)

- Create an `ImagePreview` component similar to `ArtifactPreview` that displays images with preview open by default
- Show generated images (from `image_urls` or `imageArtifacts`) in the same area as artifacts, outside the Input & Output section
- Display images in a preview format that's visible by default, similar to how artifacts are now shown
- This allows users to quickly see generated images without expanding the Input & Output section

### To-dos

- [ ] Add HTML extraction logic in PreviewRenderer.tsx to extract content from ```html ``` code blocks
- [ ] Change ArtifactPreview.tsx to default showPreview to true instead of false
- [ ] Truncate long URLs in StepInputOutput.tsx for both image URLs and artifact URLs