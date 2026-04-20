from __future__ import annotations

import os
from dataclasses import dataclass


class TranslationError(RuntimeError):
    pass


class BaseTranslator:
    name = "base"

    def translate_lines(
        self, lines: list[dict], source_lang: str = "es", target_lang: str = "zh-Hant"
    ) -> list[dict]:
        raise NotImplementedError


class DummyTranslator(BaseTranslator):
    name = "dummy"

    def translate_lines(
        self, lines: list[dict], source_lang: str = "es", target_lang: str = "zh-Hant"
    ) -> list[dict]:
        out = []
        for item in lines:
            row = dict(item)
            row["zh"] = row.get("zh") or "[未翻譯] " + row.get("es", "")
            out.append(row)
        return out


@dataclass
class OptionalOpenAITranslator(BaseTranslator):
    model: str = "gpt-4.1-mini"
    name: str = "openai"

    def __post_init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise TranslationError("OPENAI_API_KEY is not set.")

        try:
            from openai import OpenAI
        except ImportError as e:
            raise TranslationError("openai package is not installed.") from e
        self.client = OpenAI(api_key=self.api_key)

    def translate_lines(
        self, lines: list[dict], source_lang: str = "es", target_lang: str = "zh-Hant"
    ) -> list[dict]:
        out = []
        for item in lines:
            es = item.get("es", "")
            if not es:
                out.append(dict(item))
                continue
            prompt = (
                "Translate the following Spanish subtitle line into Traditional Chinese. "
                "Return translation only, no extra notes.\n"
                f"Spanish: {es}"
            )
            try:
                resp = self.client.responses.create(
                    model=self.model,
                    input=prompt,
                    temperature=0.2,
                )
                zh = (resp.output_text or "").strip()
                if not zh:
                    zh = f"[翻譯失敗] {es}"
            except Exception as e:
                raise TranslationError(f"OpenAI translation failed: {e}") from e

            row = dict(item)
            row["zh"] = zh
            out.append(row)
        return out


def build_translator(name: str) -> BaseTranslator:
    lowered = (name or "dummy").lower()
    if lowered == "dummy":
        return DummyTranslator()
    if lowered == "openai":
        try:
            return OptionalOpenAITranslator()
        except TranslationError:
            return DummyTranslator()
    raise TranslationError(f"Unsupported translator: {name}")
