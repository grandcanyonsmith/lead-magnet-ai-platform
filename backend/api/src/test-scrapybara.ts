import { ScrapybaraClient } from "scrapybara";
import { bashTool, computerTool, editTool } from "scrapybara/tools";
import { openai, UBUNTU_SYSTEM_PROMPT } from "scrapybara/openai";

// Using the key provided in the example
const SCRAPYBARA_API_KEY = "scrapy-d8f01bd8-b209-445f-b1eb-01ae1b2bd4a9";

async function main() {
  console.log("Initializing Scrapybara client...");
  const client = new ScrapybaraClient({ apiKey: SCRAPYBARA_API_KEY });

  console.log("Starting Ubuntu instance...");
  const instance = await client.startUbuntu();
  console.log("Instance started:", instance.id);

  try {
    // Model configuration
    // Default: computer-use-preview (computer use beta)
    // Consume agent credits or bring your own API key. 
    // Without an API key, each step consumes 1 agent credit.
    const model = openai(); 
    // If you have your own OpenAI key, you would use:
    // const model = openai({ apiKey: process.env.OPENAI_API_KEY });

    console.log("Starting Act loop...");
    const response = await client.act({
      tools: [
        bashTool(instance),
        computerTool(instance),
        editTool(instance),
      ],
      model,
      system: UBUNTU_SYSTEM_PROMPT,
      prompt: "Research Scrapybara",
      onStep: (step) => {
        console.log("Step:", step.text);
      }
    });

    console.log("Act loop finished.");
    console.log("Response text:", response.text);
    
  } catch (error) {
    console.error("Error during execution:", error);
  } finally {
    if (instance) {
      console.log("Stopping instance...");
      // instance.stop() might not be available on the instance object directly depending on the SDK version,
      // usually it's client.stopInstance(instance.id) or instance.stop()
      // The snippet didn't show stop, but the python one did: instance.stop().
      // I'll try instance.stop() if available, otherwise I'll check the object.
      // TypeScript should guide me if I was in an editor, but here I'll assume instance.stop() or leave it running for inspection if desired.
      // For now, I'll comment out stop to allow inspection or reuse if needed, or just let the script exit.
      // But good practice is to clean up.
      try {
        // @ts-ignore
        if (typeof instance.stop === 'function') {
             // @ts-ignore
            await instance.stop();
            console.log("Instance stopped.");
        }
      } catch (e) {
        console.warn("Could not stop instance:", e);
      }
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
