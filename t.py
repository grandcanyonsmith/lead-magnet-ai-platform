import base64
import tempfile
import subprocess
import os
import sys

from openai import OpenAI

client = OpenAI()

# === 1. Use local PNG file ===
# Accept file path from command line argument or use default
if len(sys.argv) > 1:
    image_path = sys.argv[1]
else:
    image_filename = "Screenshot 2025-11-13 at 5.45.02 PM.png"
    # Try multiple locations
    possible_paths = [
        os.path.join(os.getcwd(), image_filename),  # Current directory
        os.path.join(os.path.expanduser("~"), "Downloads", image_filename),  # Downloads
        os.path.join(os.path.expanduser("~"), "Desktop", image_filename),  # Desktop
        os.path.join(os.path.expanduser("~"), image_filename),  # Home directory
    ]
    
    image_path = None
    for path in possible_paths:
        if os.path.exists(path):
            image_path = path
            break
    
    if not image_path:
        print(f"Usage: python3 t.py <image_path>")
        print(f"Or place '{image_filename}' in one of these locations:")
        for path in possible_paths:
            print(f"  - {path}")
        raise FileNotFoundError(f"Image file not found: {image_filename}")

# Expand user path if needed
image_path = os.path.expanduser(image_path)

if not os.path.exists(image_path):
    raise FileNotFoundError(f"Image file not found: {image_path}")

print(f"Using local image: {image_path}")

# === 2. Encode image for OpenAI ===
# API accepts: JPEG, PNG, GIF, WebP
mime_type = "image/png"
with open(image_path, "rb") as f:
    image_bytes = f.read()
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    print(f"Encoded PNG image: {len(b64_image)} chars")

# === 3. Call the OpenAI Responses API ===
# Build input with image data
prompt = "Recreate this image exactly as a high-resolution transparent PNG."

input_content = [
    {"type": "input_text", "text": prompt},
    {
        "type": "input_image",
        "image_url": f"data:{mime_type};base64,{b64_image}"
    }
]

print("Including image in API call")

resp = client.responses.create(
    model="gpt-5",
    input=[
        {
            "role": "user",
            "content": input_content
        }
    ],
    tools=[
        {
            "type": "image_generation",
            "background": "transparent",
            "quality": "high"
        }
    ],
    tool_choice="required"
)

print("\n=== RAW OPENAI RESPONSE ===")
print(resp)

# === 4. Extract the generated PNG ===
# Find image_generation_call items in response.output
image_generation_calls = [
    output
    for output in resp.output
    if hasattr(output, 'type') and output.type == "image_generation_call"
]

# If type attribute doesn't work, try class name check
if not image_generation_calls:
    image_generation_calls = [
        output
        for output in resp.output
        if type(output).__name__ == 'ImageGenerationCall'
    ]

image_data = [output.result for output in image_generation_calls if hasattr(output, 'result')]

if not image_data:
    # Fallback: try to get content if available
    if hasattr(resp, 'output') and resp.output:
        print("No image data found. Response output:")
        for idx, item in enumerate(resp.output):
            print(f"  Item {idx}: {type(item).__name__}, attributes: {[a for a in dir(item) if not a.startswith('_')]}")
    raise Exception("No generated image returned from OpenAI.")

png_bytes = base64.b64decode(image_data[0])

# Save output PNG
output_png = os.path.join(tempfile.gettempdir(), "fasterzebra_recreated.png")
with open(output_png, "wb") as f:
    f.write(png_bytes)

print(f"\nSaved recreated PNG → {output_png}")

# === 5. Open the image automatically ===
print("Opening image...")
import platform
system = platform.system()
if system == "Windows":
    os.startfile(output_png)
elif system == "Darwin":  # macOS
    subprocess.run(["open", output_png])
else:  # Linux and others
    subprocess.run(["xdg-open", output_png])
