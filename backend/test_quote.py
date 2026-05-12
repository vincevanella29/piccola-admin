import asyncio
import httpx
import json

async def main():
    async with httpx.AsyncClient() as client:
        # Get session cookie by logging in (or we can just skip and ask user to test)
        pass

if __name__ == "__main__":
    asyncio.run(main())
