"use client";
import { useState } from "react";
import { Notebook, Check, X, Circle } from "@phosphor-icons/react";
import {
  type QuestionType,
  decodeChoices,
  isAnswered,
  isCorrect,
} from "@/lib/questionTypes";
import { quizImageUrl } from "@/lib/quizImages";

interface Question {
  id: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  image_path?: string | null;
}

interface QuizBlockProps {
  quizId: string;
  title: string;
  questions: Question[];
  patientId: string;
  /**
   * "preview" scores locally and never calls the submit API - used by the
   * staff course-preview screen, which has no real enrollment/attempt to
   * record against. Defaults to the normal graded flow.
   */
  mode?: "live" | "preview";
}

/** string for multiple choice and short answer, string[] for checkboxes. */
type Answer = string | string[];

export default function QuizBlock({ quizId, title, questions, mode = "live" }: QuizBlockProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);

  // Older rows predate question_type; they were all multiple choice.
  const typeOf = (q: Question): QuestionType => q.question_type ?? "multiple_choice";

  const answeredCount = questions.filter((q) => isAnswered(typeOf(q), answers[q.id])).length;
  const allAnswered = answeredCount === questions.length;

  const handleSubmit = async () => {
    if (!allAnswered) return;

    if (mode === "preview") {
      const correctCount = questions.filter((q) => isCorrect(typeOf(q), q.correct_answer, answers[q.id])).length;
      setScore(correctCount);
      setSubmitted(true);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, answers }),
    });
    const data = await res.json();
    setScore(data.score ?? 0);
    setSubmitted(true);
    setLoading(false);
  };

  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
  };

  const toggleCheckbox = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  };

  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Notebook size={18} weight="duotone" />
        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{title}</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-auto"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {submitted ? (
        <div>
          <div
            className="rounded-xl p-4 mb-4 text-center"
            style={{ background: pct >= 70 ? "var(--success-light)" : "var(--danger-light)" }}
          >
            <p className="text-2xl font-bold mb-1" style={{ color: pct >= 70 ? "var(--primary)" : "var(--danger)" }}>
              {pct}%
            </p>
            <p className="text-sm font-semibold" style={{ color: pct >= 70 ? "var(--primary)" : "var(--danger)" }}>
              {score} of {questions.length} correct — {pct >= 70 ? "Great job!" : "Keep practicing!"}
            </p>
          </div>

          {questions.map((q) => {
            const type = typeOf(q);
            const given = answers[q.id];
            const right = isCorrect(type, q.correct_answer, given);

            return (
              <div key={q.id} className="mb-4">
                {q.image_path && (
                  <img src={quizImageUrl(q.image_path)} alt="" className="max-w-full sm:max-w-sm rounded-xl mb-2 border" style={{ borderColor: "var(--border)" }} />
                )}
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>{q.question}</p>

                {type === "short_answer" ? (
                  <div
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: right ? "var(--success-light)" : "var(--danger-light)",
                      color: right ? "var(--primary)" : "var(--danger)",
                      border: `1px solid ${right ? "var(--secondary)" : "var(--danger-light)"}`,
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      {right ? <Check size={14} weight="bold" /> : <X size={14} weight="bold" />}
                      You answered: {typeof given === "string" && given ? given : "(blank)"}
                    </span>
                    {!right && (
                      <p className="mt-1" style={{ color: "var(--foreground-secondary)" }}>
                        Expected: <strong>{q.correct_answer}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {q.options.map((opt) => {
                      const correctSet =
                        type === "checkboxes" ? decodeChoices(q.correct_answer) : [q.correct_answer];
                      const optIsCorrect = correctSet.includes(opt);
                      const optSelected = Array.isArray(given) ? given.includes(opt) : given === opt;

                      return (
                        <div
                          key={opt}
                          className="px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                          style={{
                            background: optIsCorrect
                              ? "var(--success-light)"
                              : optSelected ? "var(--danger-light)" : "var(--card-secondary)",
                            color: optIsCorrect
                              ? "var(--primary)"
                              : optSelected ? "var(--danger)" : "var(--foreground-secondary)",
                            border: `1px solid ${
                              optIsCorrect
                                ? "var(--secondary)"
                                : optSelected ? "var(--danger-light)" : "var(--border)"
                            }`,
                          }}
                        >
                          <span className="inline-flex items-center gap-2">
                            {optIsCorrect ? (
                              <Check size={14} weight="bold" className="flex-shrink-0" />
                            ) : optSelected ? (
                              <X size={14} weight="bold" className="flex-shrink-0" />
                            ) : (
                              <Circle size={14} className="flex-shrink-0" />
                            )}
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={handleRetake} className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            Retake Quiz
          </button>
        </div>
      ) : (
        <div>
          {questions.map((q, qi) => {
            const type = typeOf(q);
            const given = answers[q.id];

            return (
              <div key={q.id} className="mb-5">
                {q.image_path && (
                  <img src={quizImageUrl(q.image_path)} alt="" className="max-w-full sm:max-w-sm rounded-xl mb-2 border" style={{ borderColor: "var(--border)" }} />
                )}
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  {qi + 1}. {q.question}
                  {type === "checkboxes" && (
                    <span className="font-normal ml-1" style={{ color: "var(--foreground-muted)" }}>
                      (select all that apply)
                    </span>
                  )}
                </p>

                {type === "short_answer" ? (
                  <input
                    type="text"
                    value={typeof given === "string" ? given : ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card-secondary)",
                      color: "var(--foreground)",
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const selected = Array.isArray(given) ? given.includes(opt) : given === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() =>
                            type === "checkboxes"
                              ? toggleCheckbox(q.id, opt)
                              : setAnswers({ ...answers, [q.id]: opt })
                          }
                          aria-pressed={selected}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                          style={{
                            background: selected ? "var(--primary-light)" : "var(--card-secondary)",
                            color: selected ? "var(--primary)" : "var(--foreground-secondary)",
                            border: `1px solid ${selected ? "var(--secondary)" : "var(--border)"}`,
                          }}
                        >
                          <span className="inline-flex items-center gap-2">
                            {type === "checkboxes" &&
                              (selected ? <Check size={14} weight="bold" /> : <Circle size={14} />)}
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={handleSubmit}
            disabled={loading || !allAnswered}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold primary-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting..." : "Submit Quiz"}
          </button>
          {!allAnswered && (
            <p className="text-xs mt-2" style={{ color: "var(--foreground-muted)" }}>
              Answered {answeredCount} of {questions.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
