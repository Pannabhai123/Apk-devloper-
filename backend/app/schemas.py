from typing import Literal
from pydantic import BaseModel, Field, field_validator


class Option(BaseModel):
    label: str = Field(pattern="^[A-D]$")
    text: str = Field(max_length=4000)


class QuestionUpdate(BaseModel):
    number: str | None = Field(default=None, max_length=30)
    text: str | None = Field(default=None, min_length=1, max_length=12000)
    options: list[Option] | None = None
    correct_answer: str | None = Field(default=None, max_length=4000)
    explanation: str | None = Field(default=None, max_length=12000)
    answer_source: Literal["pdf", "ai", "manual", "none"] | None = None
    answer_confidence: Literal["certain", "uncertain", "none"] | None = None


class GenerateRequest(BaseModel):
    mode: Literal["A", "B", "C", "D"] = "C"
    question_color: str = "#73F59A"
    option_color: str = "#FFFFFF"
    highlight_color: str = "#FF9D4D"
    background_color: str = "#07110D"
    font_family: str = "Nirmala UI"
    question_font_size: int = Field(default=28, ge=18, le=44)
    option_font_size: int = Field(default=22, ge=16, le=34)
    show_question_numbers: bool = True
    custom_answer_slide: bool = True
    custom_include_explanation: bool = True
    custom_show_options_on_answer: bool = False

    @field_validator("question_color", "option_color", "highlight_color", "background_color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if len(value) != 7 or not value.startswith("#"):
            raise ValueError("Use a six-digit hex colour")
        int(value[1:], 16)
        return value


class SettingsUpdate(BaseModel):
    teacher_name: str | None = Field(default=None, max_length=100)
    institute_name: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=250)
    default_mode: Literal["A", "B", "C", "D"] | None = None
    auto_ocr: bool | None = None
    default_font: str | None = Field(default=None, max_length=100)
