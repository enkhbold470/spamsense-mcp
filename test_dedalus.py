import asyncio
import os
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv
from dedalus_labs.utils.streaming import stream_async

load_dotenv()

def add(a: int, b: int) -> int:
    return a + b

def mul(x: int, y: int) -> int:
    return x * y

async def main():
    # Check for API key
    api_key = os.getenv('DEDALUS_API_KEY') or os.getenv('X_API_KEY')
    if not api_key or api_key == 'your-api-key-here':
        print("Error: Please set your DEDALUS_API_KEY in the .env file")
        print("You can get an API key from Dedalus Labs")
        return
    
    try:
        client = AsyncDedalus(api_key=api_key)
        runner = DedalusRunner(client)

        result = await runner.run(
            input="1. Add 2 and 3. 2. Multiply that by 4. 3. Multiply this number by the age of the winner of the 2025 Wimbledon men's singles final. Use your tools to do this.",
            model=["openai/gpt-4.1"],
            tools=[add, mul],
            mcp_servers=["tsion/brave-search-mcp"],
            stream=False
        )

        print(result.final_output)
    except Exception as e:
        print(f"Error running Dedalus: {e}")

if __name__ == "__main__":
    asyncio.run(main())
