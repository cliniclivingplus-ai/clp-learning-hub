"use client";
import { useState, useEffect } from "react";
import { Notebook, Image as ImageIcon, X } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import {
  QUESTION_TYPES,
  type QuestionType,
  encodeChoices,
  decodeChoices,
} from "@/lib/questionTypes";
import { describeImageError, uploadQuizImage, quizImageUrl } from "@/lib/quizImages";

interface Question {
  id?: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  image_path?: string | null;
}

interface QuizBuilderProps {
  lessonId?: string;
  moduleId?: string;
  label: string;
}

const inputStyle = {
  borderColor: "var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
};

/** How an existing question's answer reads in the list. */
function describeAnswer(q: Question) {
  if (q.question_type === "checkboxes") return decodeChoices(q.correct_answer).join(", ");
  return q.correct_answer;
}

export default function QuizBuilder({ lessonId, moduleId, label }: QuizBuilderProps) {
  const supabase = createClient();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // New question form
  const [newType, setNewType] = useState<QuestionType>("multiple_choice");
  const [newQ, setNewQ] = useState("");
  const [newOpts, setNewOpts] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState("");        // multiple_choice / short_answer
  const [newChecked, setNewChecked] = useState<string[]>([]); // checkboxes
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");

  // Edit-in-place form for an existing question - mirrors the "new question"
  // fields above, just seeded from the question being edited instead of blank.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<QuestionType>("multiple_choice");
  const [editQ, setEditQ] = useState("");
  const [editOpts, setEditOpts] = useState<string[]>(["", "", "", ""]);
  const [editCorrect, setEditCorrect] = useState("");
  const [editChecked, setEditChecked] = useState<string[]>([]);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePath, setEditImagePath] = useState<string | null>(null);
  const [editImageError, setEditImageError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchQuiz(); }, []);

  const fetchQuiz = async () => {
    setLoading(true);
    let query = supabase
      .from("quizzes")
      .select("id, title, quiz_questions(id, question, question_type, options, correct_answer, image_path)");
    if (lessonId) query = query.eq("lesson_id", lessonId);
    if (moduleId) query = query.eq("module_id", moduleId);
    const { data } = await query.maybeSingle();
    if (data) {
      setQuizId(data.id);
      setQuestions((data.quiz_questions as Question[]) || []);
    }
    setLoading(false);
  };

  const ensureQuiz = async () => {
    if (quizId) return quizId;
    const { data } = await supabase.from("quizzes").insert({
      title: `${label} Quiz`,
      lesson_id: lessonId || null,
      module_id: moduleId || null,
    }).select("id").single();
    setQuizId(data!.id);
    return data!.id;
  };

  const resetForm = () => {
    setNewQ("");
    setNewOpts(["", "", "", ""]);
    setNewCorrect("");
    setNewChecked([]);
    setNewImage(null);
    setImageError("");
    setShowForm(false);
  };

  const handleChooseImage = (file: File | null) => {
    setImageError("");
    if (!file) { setNewImage(null); return; }
    const problem = describeImageError(file);
    if (problem) { setImageError(problem); return; }
    setNewImage(file);
  };

  // Changing type mid-edit keeps the question text but clears answers, which
  // no longer mean the same thing.
  const changeType = (type: QuestionType) => {
    setNewType(type);
    setNewCorrect("");
    setNewChecked([]);
  };

  const filledOptions = newOpts.map((o) => o.trim()).filter(Boolean);

  const canAdd = (() => {
    if (!newQ.trim()) return false;
    if (newType === "short_answer") return !!newCorrect.trim();
    if (filledOptions.length < 2) return false;
    if (newType === "checkboxes") return newChecked.length > 0;
    return !!newCorrect;
  })();

  const handleAddQuestion = async () => {
    if (!canAdd) return;
    setAdding(true);

    let imagePath: string | null = null;
    if (newImage) {
      try {
        imagePath = await uploadQuizImage(supabase, newImage);
      } catch (e: any) {
        setAdding(false);
        setImageError(e?.message || "Could not upload the image.");
        return;
      }
    }

    const qid = await ensureQuiz();

    const correct =
      newType === "checkboxes" ? encodeChoices(newChecked) : newCorrect.trim();

    const { data, error } = await supabase.from("quiz_questions").insert({
      quiz_id: qid,
      question: newQ.trim(),
      question_type: newType,
      options: newType === "short_answer" ? [] : filledOptions,
      correct_answer: correct,
      image_path: imagePath,
    }).select("id, question, question_type, options, correct_answer, image_path").single();

    setAdding(false);
    if (error) { alert("Could not add the question: " + error.message); return; }
    setQuestions([...questions, data as Question]);
    resetForm();
  };

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("quiz_questions").delete().eq("id", qid);
    setQuestions(questions.filter((q) => q.id !== qid));
  };

  const startEdit = (q: Question) => {
    setShowForm(false);
    setEditingId(q.id!);
    setEditType(q.question_type);
    setEditQ(q.question);
    const opts = [...(q.options || [])];
    while (opts.length < 4) opts.push("");
    setEditOpts(opts);
    if (q.question_type === "checkboxes") {
      setEditCorrect("");
      setEditChecked(decodeChoices(q.correct_answer));
    } else {
      setEditCorrect(q.correct_answer);
      setEditChecked([]);
    }
    setEditImage(null);
    setEditImagePath(q.image_path || null);
    setEditImageError("");
  };

  const cancelEdit = () => setEditingId(null);

  const changeEditType = (type: QuestionType) => {
    setEditType(type);
    setEditCorrect("");
    setEditChecked([]);
  };

  const toggleEditChecked = (opt: string) => {
    setEditChecked((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  };

  const updateEditOption = (index: number, value: string) => {
    const previous = editOpts[index];
    const updated = [...editOpts];
    updated[index] = value;
    setEditOpts(updated);
    if (previous && editCorrect === previous) setEditCorrect(value);
    if (previous) setEditChecked((prev) => prev.map((o) => (o === previous ? value : o)));
  };

  const handleChooseEditImage = (file: File | null) => {
    setEditImageError("");
    if (!file) { setEditImage(null); return; }
    const problem = describeImageError(file);
    if (problem) { setEditImageError(problem); return; }
    setEditImage(file);
  };

  const editFilledOptions = editOpts.map((o) => o.trim()).filter(Boolean);

  const canSaveEdit = (() => {
    if (!editQ.trim()) return false;
    if (editType === "short_answer") return !!editCorrect.trim();
    if (editFilledOptions.length < 2) return false;
    if (editType === "checkboxes") return editChecked.length > 0;
    return !!editCorrect;
  })();

  const handleSaveEdit = async () => {
    if (!canSaveEdit || !editingId) return;
    setSaving(true);

    let imagePath = editImagePath;
    if (editImage) {
      try {
        imagePath = await uploadQuizImage(supabase, editImage);
      } catch (e: any) {
        setSaving(false);
        setEditImageError(e?.message || "Could not upload the image.");
        return;
      }
    }

    const correct = editType === "checkboxes" ? encodeChoices(editChecked) : editCorrect.trim();

    const { data, error } = await supabase
      .from("quiz_questions")
      .update({
        question: editQ.trim(),
        question_type: editType,
        options: editType === "short_answer" ? [] : editFilledOptions,
        correct_answer: correct,
        image_path: imagePath,
      })
      .eq("id", editingId)
      .select("id, question, question_type, options, correct_answer, image_path")
      .single();

    setSaving(false);
    if (error) { alert("Could not save the question: " + error.message); return; }
    setQuestions(questions.map((q) => (q.id === editingId ? (data as Question) : q)));
    setEditingId(null);
  };

  const toggleChecked = (opt: string) => {
    setNewChecked((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const updateOption = (index: number, value: string) => {
    const previous = newOpts[index];
    const updated = [...newOpts];
    updated[index] = value;
    setNewOpts(updated);
    // Keep the answer pointing at the option the author is still editing -
    // but only if they had actually chosen it. Without the `previous` guard an
    // empty option matches the empty answer, so typing into the first box
    // silently marks it correct.
    if (previous && newCorrect === previous) setNewCorrect(value);
    if (previous) setNewChecked((prev) => prev.map((o) => (o === previous ? value : o)));
  };

  if (loading) {
    return <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>Loading quiz...</div>;
  }

  const typeHint = QUESTION_TYPES.find((t) => t.value === newType)?.hint;

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Notebook size={16} weight="duotone" />
          <h4 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{label} Quiz</h4>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => { cancelEdit(); showForm ? resetForm() : setShowForm(true); }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {showForm ? "Cancel" : "+ Add Question"}
        </button>
      </div>

      {questions.length > 0 && (
        <div className="space-y-2 mb-4">
          {questions.map((q, i) =>
            editingId === q.id ? (
              <div key={q.id} className="rounded-xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Question</label>
                  <input
                    type="text"
                    value={editQ}
                    onChange={(e) => setEditQ(e.target.value)}
                    placeholder="Enter your question"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={inputStyle}
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Image <span className="font-normal" style={{ color: "var(--foreground-muted)" }}>(optional)</span>
                  </label>
                  {editImage ? (
                    <div className="flex items-center gap-2">
                      <img src={URL.createObjectURL(editImage)} alt="" className="max-w-[160px] rounded-lg border" style={{ borderColor: "var(--border)" }} />
                      <button type="button" onClick={() => handleChooseEditImage(null)} aria-label="Remove image" style={{ color: "var(--foreground-muted)" }}>
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  ) : editImagePath ? (
                    <div className="flex items-center gap-2">
                      <img src={quizImageUrl(editImagePath)} alt="" className="max-w-[160px] rounded-lg border" style={{ borderColor: "var(--border)" }} />
                      <button type="button" onClick={() => setEditImagePath(null)} aria-label="Remove image" style={{ color: "var(--foreground-muted)" }}>
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                      style={{ background: "var(--card)", border: "1px dashed var(--border)", color: "var(--foreground-secondary)" }}
                    >
                      <ImageIcon size={15} weight="bold" />
                      Attach an image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleChooseEditImage(e.target.files?.[0] ?? null)} />
                    </label>
                  )}
                  {editImageError && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{editImageError}</p>}
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Answer type</label>
                  <select
                    value={editType}
                    onChange={(e) => changeEditType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={inputStyle}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {editType === "short_answer" ? (
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Expected answer</label>
                    <input
                      type="text"
                      value={editCorrect}
                      onChange={(e) => setEditCorrect(e.target.value)}
                      placeholder="e.g. fibre"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Options</label>
                    <div className="space-y-2">
                      {editOpts.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type={editType === "checkboxes" ? "checkbox" : "radio"}
                            name={`edit-correct-${q.id}`}
                            disabled={!opt.trim()}
                            checked={
                              editType === "checkboxes"
                                ? editChecked.includes(opt) && !!opt
                                : editCorrect === opt && !!opt
                            }
                            onChange={() => {
                              if (!opt.trim()) return;
                              if (editType === "checkboxes") toggleEditChecked(opt);
                              else setEditCorrect(opt);
                            }}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateEditOption(oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 rounded-lg border text-sm"
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditOpts([...editOpts, ""])}
                      className="text-xs font-semibold mt-1"
                      style={{ color: "var(--primary)" }}
                    >
                      + Add option
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !canSaveEdit}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold primary-gradient disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Question"}
                  </button>
                  <button onClick={cancelEdit} className="text-xs font-semibold" style={{ color: "var(--foreground-secondary)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={q.id}
                className="rounded-xl p-3 flex items-start justify-between gap-2"
                style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  {q.image_path && (
                    <img
                      src={quizImageUrl(q.image_path)}
                      alt=""
                      className="max-w-[220px] rounded-lg mb-2 border"
                      style={{ borderColor: "var(--border)" }}
                    />
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {i + 1}. {q.question}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "var(--accent-blue-light)", color: "var(--accent-blue)" }}
                    >
                      {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label ?? q.question_type}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    {q.question_type !== "short_answer" && (q.options as string[]).length > 0 && (
                      <>Options: {(q.options as string[]).join(", ")} · </>
                    )}
                    Correct: <strong>{describeAnswer(q)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => startEdit(q)} className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteQuestion(q.id!)} className="text-xs" style={{ color: "var(--danger)" }}>
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl p-4" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Question</label>
            <input
              type="text"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="Enter your question"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={inputStyle}
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
              Image <span className="font-normal" style={{ color: "var(--foreground-muted)" }}>(optional)</span>
            </label>
            {newImage ? (
              <div className="flex items-center gap-2">
                <img src={URL.createObjectURL(newImage)} alt="" className="max-w-[160px] rounded-lg border" style={{ borderColor: "var(--border)" }} />
                <button type="button" onClick={() => handleChooseImage(null)} aria-label="Remove image" style={{ color: "var(--foreground-muted)" }}>
                  <X size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <label
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: "var(--card)", border: "1px dashed var(--border)", color: "var(--foreground-secondary)" }}
              >
                <ImageIcon size={15} weight="bold" />
                Attach an image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleChooseImage(e.target.files?.[0] ?? null)} />
              </label>
            )}
            {imageError && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{imageError}</p>}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Answer type</label>
            <select
              value={newType}
              onChange={(e) => changeType(e.target.value as QuestionType)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={inputStyle}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {typeHint && (
              <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{typeHint}</p>
            )}
          </div>

          {newType === "short_answer" ? (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Expected answer</label>
              <input
                type="text"
                value={newCorrect}
                onChange={(e) => setNewCorrect(e.target.value)}
                placeholder="e.g. fibre"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                Keep it to a word or two - anything longer is hard to match exactly.
              </p>
            </div>
          ) : (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                Options
              </label>
              <div className="space-y-2">
                {newOpts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={newType === "checkboxes" ? "checkbox" : "radio"}
                      name="correct"
                      disabled={!opt.trim()}
                      checked={
                        newType === "checkboxes"
                          ? newChecked.includes(opt) && !!opt
                          : newCorrect === opt && !!opt
                      }
                      onChange={() => {
                        if (!opt.trim()) return;
                        if (newType === "checkboxes") toggleChecked(opt);
                        else setNewCorrect(opt);
                      }}
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-1.5 rounded-lg border text-sm"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {newType === "checkboxes"
                    ? "Tick every option that should count as correct. Blank options are ignored."
                    : "Select the correct answer. Blank options are ignored."}
                </p>
                <button
                  type="button"
                  onClick={() => setNewOpts([...newOpts, ""])}
                  className="text-xs font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  + Add option
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleAddQuestion}
            disabled={adding || !canAdd}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold primary-gradient disabled:opacity-60"
          >
            {adding ? "Adding..." : "Add Question"}
          </button>
        </div>
      )}

      {questions.length === 0 && !showForm && (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          No questions yet. Click + Add Question to create the first one.
        </p>
      )}
    </div>
  );
}
