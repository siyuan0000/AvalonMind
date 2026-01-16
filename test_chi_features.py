import unittest
import json
from avalon.ai.backends import BaseAI

class TestCHIFeatures(unittest.TestCase):
    def setUp(self):
        self.ai = BaseAI()

    def test_json_extraction_clean(self):
        """Test extracting clean JSON."""
        response = '{"thought_process": "thinking...", "suspicion_scores": {"Alice": 10}, "comment": "Hello"}'
        data = self.ai.extract_json(response)
        self.assertIsNotNone(data)
        self.assertEqual(data['comment'], "Hello")
        self.assertEqual(data['suspicion_scores']['Alice'], 10)

    def test_json_extraction_markdown(self):
        """Test extracting JSON from markdown block."""
        response = '''Here is my thought process:
```json
{
    "thought_process": "thinking...",
    "suspicion_scores": {"Bob": 90},
    "comment": "I suspect Bob"
}
```
I hope this helps.'''
        data = self.ai.extract_json(response)
        self.assertIsNotNone(data)
        self.assertEqual(data['comment'], "I suspect Bob")
        self.assertEqual(data['suspicion_scores']['Bob'], 90)

    def test_json_extraction_messy(self):
        """Test extracting JSON from messy text without markdown."""
        response = '''I think Alice is evil.
{
    "thought_process": "Alice voted reject",
    "suspicion_scores": {"Alice": 80},
    "comment": "Why did you reject?"
}
That is my question.'''
        data = self.ai.extract_json(response)
        self.assertIsNotNone(data)
        self.assertEqual(data['comment'], "Why did you reject?")

    def test_json_extraction_fail(self):
        """Test failure case."""
        response = "Just plain text here."
        data = self.ai.extract_json(response)
        self.assertIsNone(data)

if __name__ == '__main__':
    unittest.main()
