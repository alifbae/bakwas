"""
Summary generation module.

Builds prompts and dispatches completion calls to any provider registered
via config/providers.yaml (see src/providers.py).

LiteLLM is imported lazily on first use so that an idle container (serving
the homepage, models list, stats, search) doesn't carry its ~150 MB
footprint in memory.
"""

import re

from src.providers import Provider, resolve
from src.utils import is_debug_mode


# Flag so we only toggle litellm.set_verbose once per process lifetime.
_LITELLM_CONFIGURED = False

# Matches [MM:SS] or [H:MM:SS] / [HH:MM:SS]. Deliberately strict: the regex
# fixes the URL we substitute, so no user/LLM-supplied text reaches the
# anchor href as-is.
_TIMESTAMP_RE = re.compile(r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]")


def _timestamp_to_seconds(label: str) -> int:
    """Convert 'MM:SS' or 'HH:MM:SS' (zero-padded or not) to seconds."""
    parts = label.split(":")
    if len(parts) == 2:
        m, s = parts
        return int(m) * 60 + int(s)
    h, m, s = parts
    return int(h) * 3600 + int(m) * 60 + int(s)


def linkify_timestamps(summary: str, video_id: str | None) -> str:
    """
    Replace `[MM:SS]` / `[H:MM:SS]` markers with clickable markdown links
    pointing at the corresponding moment of the YouTube video.

    Returns `summary` unchanged if `video_id` is falsy.
    """
    if not summary or not video_id:
        return summary

    def replace(match: re.Match) -> str:
        label = match.group(1)
        seconds = _timestamp_to_seconds(label)
        # We build the URL from a strict regex capture + an int, so nothing
        # from the LLM output reaches the href verbatim.
        return f"[[{label}]](https://youtu.be/{video_id}?t={seconds}s)"

    return _TIMESTAMP_RE.sub(replace, summary)


def _load_litellm():
    """
    Lazy-import LiteLLM and configure it on first use. Returns the module
    plus the helper callables the summarizer needs.
    """
    global _LITELLM_CONFIGURED
    import litellm  # noqa: WPS433 - intentional lazy import
    from litellm import completion, completion_cost, cost_per_token

    if not _LITELLM_CONFIGURED:
        if is_debug_mode():
            litellm.set_verbose = True
        _LITELLM_CONFIGURED = True

    return litellm, completion, completion_cost, cost_per_token


def get_prompt_template(length, text):
    """Get the appropriate prompt template based on desired length."""
    # Truncate text to avoid token limits (increased for longer videos)
    truncated_text = text[:60000]

    prompts = {
        "concise": f"""Create a concise bullet-point summary of this YouTube video.

Format your response as:
- Use 5-8 clear bullet points
- Each bullet should capture a key idea or takeaway
- Use **bold** for emphasis on important terms (sparingly)
- Keep bullets focused and easy to scan
- No headings, just bullets

Timestamps:
- End each bullet with a timestamp `[MM:SS]` (or `[H:MM:SS]` for videos over an hour) pointing to where that idea is discussed.
- Only use timestamps that literally appear in the transcript below; never invent one.
- If a bullet spans the whole video, use the timestamp where it is first introduced.

Transcript (prefixed with [MM:SS] markers):
{truncated_text}""",
        "comprehensive": f"""Provide a comprehensive summary of this YouTube video in 2-4 well-structured paragraphs.

Guidelines:
- Write in clear, flowing paragraphs with good readability
- Use **bold** sparingly to emphasize key terms and concepts only
- Do NOT use any markdown headings (no # symbols)
- Focus on the main ideas, key takeaways, and important context
- Include proper paragraph breaks for readability

Timestamps:
- When a sentence describes a specific moment, suffix it with a `[MM:SS]` marker (or `[H:MM:SS]` for videos over an hour) pointing to where in the transcript that moment occurs.
- Only use timestamps that literally appear in the transcript below; never invent one.
- Sprinkle them throughout rather than clustering — aim for 3 to 6 per paragraph.

Transcript (prefixed with [MM:SS] markers):
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


def _extract_usage(response) -> tuple[int | None, int | None]:
    """Return (prompt_tokens, completion_tokens) from a LiteLLM response, or (None, None)."""
    usage = getattr(response, "usage", None)
    if not usage:
        return None, None
    prompt = getattr(usage, "prompt_tokens", None)
    completion_tokens = getattr(usage, "completion_tokens", None)
    if prompt is None and isinstance(usage, dict):
        prompt = usage.get("prompt_tokens")
        completion_tokens = usage.get("completion_tokens")
    return prompt, completion_tokens


def _extract_cost(response, completion_cost) -> float | None:
    """Return the USD cost of a completion, or None when the provider/model isn't priced."""
    hidden = getattr(response, "_hidden_params", None) or {}
    cost = hidden.get("response_cost") if isinstance(hidden, dict) else None
    if cost is not None:
        try:
            return float(cost)
        except (TypeError, ValueError):
            pass

    try:
        computed = completion_cost(completion_response=response)
        return float(computed) if computed is not None else None
    except Exception:
        return None


def _cost_from_tokens(cost_per_token, model: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    """Compute USD cost from token counts using LiteLLM's pricing map."""
    try:
        input_cost, output_cost = cost_per_token(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        total = float((input_cost or 0) + (output_cost or 0))
        return total if total > 0 else None
    except Exception:
        return None


def summarize_text(text, model, length="comprehensive", video_id=None):
    """
    Send the transcript to the configured LLM and return a dict with:
        summary           - the generated text (with linkified timestamps)
        prompt_tokens     - input tokens (int or None)
        completion_tokens - output tokens (int or None)
        cost_usd          - USD cost per LiteLLM pricing (float or None)

    If `video_id` is supplied, any `[MM:SS]` / `[H:MM:SS]` markers the model
    emits are rewritten into clickable YouTube links via `linkify_timestamps`.
    """
    if not model:
        raise ValueError("A model id is required. Configure providers in config/providers.yaml.")

    litellm, completion, completion_cost, cost_per_token = _load_litellm()

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

        summary_text = response.choices[0].message.content
        summary_text = linkify_timestamps(summary_text, video_id)
        prompt_tokens, completion_tokens = _extract_usage(response)
        cost_usd = _extract_cost(response, completion_cost)

        if cost_usd is None and prompt_tokens and completion_tokens:
            cost_usd = _cost_from_tokens(cost_per_token, model, prompt_tokens, completion_tokens)

        return {
            "summary": summary_text,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": cost_usd,
        }

    except Exception as exc:
        error_msg = f"LLM API Error: {exc}"
        print(error_msg)
        if not getattr(litellm, "set_verbose", False):
            print("Tip: Set DEBUG=True in .env to see detailed error information")
        raise Exception(error_msg)


def summarize_text_stream(text, model, length="comprehensive", video_id=None):
    """
    Generator version of summarize_text for Server-Sent Events.

    Yields:
        {"type": "chunk", "content": "..."}       partial text chunk
        {"type": "done", "summary": "...",
         "prompt_tokens": int | None,
         "completion_tokens": int | None,
         "cost_usd": float | None}                final event with totals
        {"type": "error", "error": "..."}         on failure

    If `video_id` is supplied, `[MM:SS]` / `[H:MM:SS]` markers are rewritten
    into clickable YouTube links before each chunk leaves the server. A small
    trailing buffer ensures markers aren't split across chunks.

    The caller is responsible for persisting the final summary.
    """
    if not model:
        raise ValueError(
            "A model id is required. Configure providers in config/providers.yaml."
        )

    _, completion, completion_cost, cost_per_token = _load_litellm()

    prompt = get_prompt_template(length, text)
    max_tokens = 2048 if length == "comprehensive" else 1024

    chunks: list[str] = []
    final_response = None
    pending = ""  # trailing buffer so [MM:SS] markers survive chunk splits

    # Longest possible timestamp marker is "[HH:MM:SS]" = 10 chars. Hold
    # back a little extra to cover weird provider chunk boundaries.
    HOLDBACK = 12

    def _drain(tail: str, force: bool) -> tuple[str, str]:
        """
        Split `tail` into (ready_to_ship, still_buffered).

        `force=True` means the stream is ending — emit everything.
        Otherwise we keep the last HOLDBACK chars buffered so a timestamp
        marker straddling a chunk boundary can still be linkified in one go.
        """
        if force or len(tail) <= HOLDBACK:
            return tail, ""
        # Prefer to split at whitespace so we don't cut in the middle of a word.
        split_at = len(tail) - HOLDBACK
        space_idx = tail.rfind(" ", 0, split_at)
        if space_idx > 0:
            split_at = space_idx
        return tail[:split_at], tail[split_at:]

    try:
        stream = completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
            **_completion_kwargs_for(model),
        )

        for chunk in stream:
            final_response = chunk
            try:
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    chunks.append(content)
                    pending += content
                    ready, pending = _drain(pending, force=False)
                    if ready:
                        yield {
                            "type": "chunk",
                            "content": linkify_timestamps(ready, video_id),
                        }
            except (AttributeError, IndexError):
                continue

        # Flush whatever is still buffered.
        if pending:
            yield {
                "type": "chunk",
                "content": linkify_timestamps(pending, video_id),
            }
            pending = ""

        full_summary = linkify_timestamps("".join(chunks), video_id)
        prompt_tokens, completion_tokens = _extract_usage(final_response)
        cost_usd = _extract_cost(final_response, completion_cost)

        if cost_usd is None and prompt_tokens and completion_tokens:
            cost_usd = _cost_from_tokens(cost_per_token, model, prompt_tokens, completion_tokens)

        yield {
            "type": "done",
            "summary": full_summary,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": cost_usd,
        }

    except Exception as exc:
        yield {"type": "error", "error": f"LLM API Error: {exc}"}
