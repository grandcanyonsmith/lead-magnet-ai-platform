import asyncio
from computer.computer import Computer
from agent.agent import ComputerAgent

# Using the Scrapybara key as a placeholder/guess since user didn't provide one
API_KEY = "scrapy-d8f01bd8-b209-445f-b1eb-01ae1b2bd4a9"

async def main():
    print("Initializing cloud computer...")
    try:
        # Initialize cloud computer
        computer = Computer(
            name="m-linux-k8fq82gy",
            api_key=API_KEY,
            provider_type="cloud",
            os_type="linux"
        )

        print("Initializing agent...")
        # Initialize agent with Claude
        agent = ComputerAgent(
            model="anthropic/claude-3-5-sonnet-20241022",
            tools=[computer],
            only_n_most_recent_images=3
        )

        # Run agent with task
        print("Running agent...")
        messages = [{"role": "user", "content": "Navigate to example.com and take a screenshot"}]

        async for result in agent.run(messages):
            print("Result:", result)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
