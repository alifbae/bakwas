"""
Summary generation module.

Builds prompts and dispatches completion calls to any provider registered
via config/providers.yaml (see src/providers.py).
"""

import litellm
from litellm import completion

from src.providers import Provider, resolve


def get_prompt_template(length, text):
    """Get the appropriate prompt template based on desired length."""
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


def _completion_kwargs_for(model: str) -> dict:
    """Resolve per-provider overrides (api_base, api_key) for the given model id."""
    provider: Provider | None = resolve(model)
    kwargs: dict = {}
    if provider is None:
        return kwargs
    if provider.api_base:
        kwargs["api_base"] = provider.api_base
    if provider.api_key:
        # Pass api_key per-call so two providers sharing the same SDK
        # (e.g., two "openai"-typed entries with different endpoints)
        # stay isolated.
        kwargs["api_key"] = provider.api_key
    return kwargs


def summarize_text(text, model, length="comprehensive"):
    """Send the transcript to the configured LLM and return the summary."""
    if not model:
        raise ValueError("A model id is required. Configure providers in config/providers.yaml.")

    prompt = get_prompt_template(length, text)
    max_tokens = 2048 if length == "comprehensive" else 1024

    try:
        response = completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            **_completion_kwargs_for(model),
        )

        if not response.choices or len(response.choices) == 0:
            raise Exception("API returned empty response - no choices available")

        if not hasattr(response.choices[0], "message") or not hasattr(
            response.choices[0].message, "content"
        ):
            raise Exception("API response structure is invalid")

        return response.choices[0].message.content

    except Exception as exc:
        error_msg = f"LLM API Error: {exc}"
        print(error_msg)
        if not litellm.set_verbose:
            print("Tip: Set DEBUG=True in .env to see detailed error information")
        raise Exception(error_msg)
