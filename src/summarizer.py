"""
Summary generation module.
Handles LLM API interactions and prompt generation for video summaries.
"""

import os

import litellm
import requests
from litellm import completion


def fetch_anthropic_models():
    """Fetch available models from Anthropic API"""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return get_fallback_models()

    try:
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
        response = requests.get("https://api.anthropic.com/v1/models", headers=headers)

        if response.status_code == 200:
            models_data = response.json()
            models = []

            # Find the latest sonnet model ID for default
            latest_sonnet_id = None
            for model in models_data.get("data", []):
                model_id = model.get("id", "")
                if "sonnet" in model_id.lower():
                    latest_sonnet_id = model_id
                    break  # First one is latest since they're sorted by creation date

            # Process the models list
            for model in models_data.get("data", []):
                model_id = model.get("id", "")
                # Add anthropic/ prefix for litellm
                models.append(
                    {
                        "id": f"anthropic/{model_id}",
                        "name": model.get("display_name", model_id),
                        "default": model_id == latest_sonnet_id,
                    }
                )

            # Already sorted by creation date (newest first)
            return models if models else get_fallback_models()
        else:
            return get_fallback_models()
    except Exception as e:
        print(f"Error fetching models: {e}")
        return get_fallback_models()


def get_fallback_models():
    """Fallback models if API fetch fails"""
    return [
        {
            "id": "anthropic/claude-sonnet-4-6",
            "name": "Claude Sonnet 4.6",
            "default": True,
        },
        {"id": "anthropic/claude-opus-4-6", "name": "Claude Opus 4.6"},
        {"id": "anthropic/claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5"},
        {"id": "anthropic/claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
        {"id": "anthropic/claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
    ]


def get_prompt_template(length, text):
    """Get the appropriate prompt template based on desired length"""
    # Truncate text to avoid token limits (increased for longer videos)
    truncated_text = text[:50000]

    prompts = {
        "concise": f"""Create a concise bullet-point summary of this YouTube video.

Format your response as:
- Use 5-8 clear bullet points
- Each bullet should capture a key idea or takeaway
- Use **bold** for emphasis on important terms (sparingly)
- Keep bullets focused and easy to scan
- No headings, just bullets

Transcript:
{truncated_text}""",
        "comprehensive": f"""Provide a comprehensive summary of this YouTube video in 2-4 well-structured paragraphs.

Guidelines:
- Write in clear, flowing paragraphs with good readability
- Use **bold** sparingly to emphasize key terms and concepts only
- Do NOT use any markdown headings (no # symbols)
- Focus on the main ideas, key takeaways, and important context
- Include proper paragraph breaks for readability

Transcript:
{truncated_text}""",
    }

    return prompts.get(length, prompts["comprehensive"])


def summarize_text(text, model="anthropic/claude-sonnet-4-6", length="comprehensive"):
    """Send to LLM for summary"""
    prompt = get_prompt_template(length, text)

    # Set appropriate max_tokens based on summary length
    max_tokens = 2048 if length == "comprehensive" else 1024

    try:
        response = completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )

        # Check if response has valid choices
        if not response.choices or len(response.choices) == 0:
            raise Exception("API returned empty response - no choices available")

        if not hasattr(response.choices[0], "message") or not hasattr(
            response.choices[0].message, "content"
        ):
            raise Exception("API response structure is invalid")

        return response.choices[0].message.content

    except Exception as e:
        error_msg = f"LiteLLM/Claude API Error: {str(e)}"
        print(error_msg)

        # If verbose mode is off, suggest enabling it
        if not litellm.set_verbose:
            print("Tip: Set DEBUG=True in .env to see detailed error information")

        raise Exception(error_msg)
