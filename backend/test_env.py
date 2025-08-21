import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.getcwd(), ".env")
print("DOTENV PATH:", dotenv_path)
with open(dotenv_path, encoding="utf-8") as f:
    print("=== .env RAW ===")
    print(f.read())
    print("=== END ===")
load_dotenv(dotenv_path)
print("PRIVY_JWT_PUBLIC_KEY:", repr(os.getenv("PRIVY_JWT_PUBLIC_KEY")))