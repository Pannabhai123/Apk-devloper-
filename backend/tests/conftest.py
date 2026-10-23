import os
from pathlib import Path
import tempfile

# Must be set before app.config is imported by any test module.
TEST_DATA = Path(tempfile.mkdtemp(prefix="dream-classes-tests-"))
os.environ["DATA_DIR"] = str(TEST_DATA)
os.environ.pop("AI_API_KEY", None)
os.environ["AI_EXTRACTION_ENABLED"] = "false"
