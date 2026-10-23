from app.services.question_parser import parse_page_text


def test_english_questions_preserve_order_and_fields():
    text = """1. What is the capital of Bihar?
(A) Gaya (B) Patna (C) Muzaffarpur (D) Bhagalpur
Answer: B
Explanation: Patna is the capital of Bihar.
2) Which planet is known as the Red Planet?
A. Earth
B. Venus
C. Mars
D. Jupiter
Ans: (C)
"""
    questions = parse_page_text(text, 3)
    assert [q["number"] for q in questions] == ["1", "2"]
    assert questions[0]["options"][1] == {"label": "B", "text": "Patna"}
    assert questions[0]["correct_answer"] == "B"
    assert questions[0]["explanation"] == "Patna is the capital of Bihar."
    assert questions[1]["page_number"] == 3
    assert questions[1]["correct_answer"] == "C"


def test_hindi_text_options_answers_and_explanation():
    text = """प्रश्न 1. भारत की राजधानी क्या है?
(क) मुंबई (ख) नई दिल्ली (ग) कोलकाता (घ) चेन्नई
उत्तर: ख
व्याख्या: नई दिल्ली भारत की राजधानी है।
2. हिंदी भाषा की लिपि कौन-सी है?
A. रोमन
B. देवनागरी
C. गुरमुखी
D. अरबी
"""
    questions = parse_page_text(text, 2)
    assert len(questions) == 2
    assert questions[0]["text"] == "भारत की राजधानी क्या है?"
    assert [o["text"] for o in questions[0]["options"]] == ["मुंबई", "नई दिल्ली", "कोलकाता", "चेन्नई"]
    assert questions[0]["correct_answer"] == "B"
    assert questions[0]["explanation"] == "नई दिल्ली भारत की राजधानी है।"
    assert "missing_answer" in questions[1]["flags"]


def test_wrapped_explanation_lines_are_preserved():
    questions = parse_page_text(
        "1. A question?\nA. One\nB. Two\nC. Three\nD. Four\nAnswer: A\n"
        "Explanation: The first line\ncontinues with useful reasoning.\n",
        1,
    )
    assert questions[0]["explanation"] == "The first line continues with useful reasoning."


def test_incomplete_and_unstructured_text_is_not_invented():
    assert parse_page_text("This is a readable page without a numbered question.", 1) == []
    questions = parse_page_text("7. Only two options?\nA. Yes\nB. No", 1)
    assert len(questions) == 1
    assert "missing_options" in questions[0]["flags"]
    assert "missing_answer" in questions[0]["flags"]
