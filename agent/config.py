import os
from dotenv import load_dotenv

# Load from project root .env.local
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
if not ANTHROPIC_API_KEY:
    raise RuntimeError('ANTHROPIC_API_KEY not set in .env.local')
