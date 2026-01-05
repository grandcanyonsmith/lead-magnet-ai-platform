import asyncio
import os
from scrapybara import Scrapybara
from scrapybara.tools import BashTool, ComputerTool, EditTool
from scrapybara.openai import OpenAI, UBUNTU_SYSTEM_PROMPT

# Key provided in the prompt
API_KEY = "scrapy-d8f01bd8-b209-445f-b1eb-01ae1b2bd4a9"

def main():
    print("Initializing Scrapybara client...")
    client = Scrapybara(api_key=API_KEY)

    print("Starting Ubuntu instance...")
    try:
        instance = client.start_ubuntu()
        print(f"Instance started: {instance.id}")

        try:
            # Model configuration
            # Default: computer-use-preview (computer use beta)
            # Consume agent credits or bring your own API key. 
            model = OpenAI()
            # If using own key: model = OpenAI(api_key="your_api_key")

            print("Starting Act loop...")
            response = client.act(
                tools=[
                    BashTool(instance),
                    ComputerTool(instance),
                    EditTool(instance),
                ],
                model=model,
                system=UBUNTU_SYSTEM_PROMPT,
                prompt="Research Scrapybara",
                on_step=lambda step: print(f"Step: {step.text}")
            )
            
            print("Act loop finished.")
            print("Response text:", response.text)

        finally:
            print("Stopping instance...")
            instance.stop()
            print("Instance stopped.")

    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    main()
