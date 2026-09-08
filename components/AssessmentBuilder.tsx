"use client";
import { useState, useEffect } from "react";
import { Target } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { QUESTION_TYPES, type QuestionType, encodeChoices, decodeChoices } from "@/lib/questionTypes";

interface AssessmentBuilderProps {
  moduleId: string;
  moduleTitle: string;
}

export default function AssessmentBuilder({ moduleId, moduleTitle }: AssessmentBuilderProps) {
  const supabase = createClient();
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [passThreshold, setPassThreshold] = useState(70);
  const [creating, setCreating] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newOpts, setNewOpts] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState("");
  const [newType, setNewType] = useState<QuestionType>("multiple_choice");
  const [newChecked, setNewChecked] = useState<string[]>([]);
  const [addingQ, setAddingQ] = useState(false);

  // Edit-in-place form for an existing question - mirrors the "new question"
  // fields above, just seeded from the question being edited instead of blank.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<QuestionType>("multiple_choice");
  const [editQ, setEditQ] = useState("");
  const [editOpts, setEditOpts] = useState<string[]>(["", "", "", ""]);
  const [editCorrect, setEditCorrect] = useState("");
  const [editChecked, setEditChecked] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { fetchAssessment(); }, [moduleId]);

  const fetchAssessment = async () => {
    setLoading(true);
    const { data } = await supabase.from("assessments")
      .select("id, title, instructions, pass_threshold, assessment_questions(id, question, question_type, options, correct_answer, order)")
      .eq("module_id", moduleId).maybeSingle();
    if (data) {
      setAssessment(data);
      setQuestions(data.assessment_questions || []);
      setTitle(data.title);
      setInstructions(data.instructions || "");
      setPassThreshold(data.pass_threshold);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const { data } = await supabase.from("assessments").insert({
      module_id: moduleId, title, instructions, pass_threshold: passThreshold,
    }).select("id, title, instructions, pass_threshold").single();
    setAssessment(data);
    setCreating(false);
  };

  const filledOptions = newOpts.map(o => o.trim()).filter(Boolean);

  const canAddQuestion = (() => {
    if (!newQ.trim()) return false;
    if (newType === "short_answer") return !!newCorrect.trim();
    if (filledOptions.length < 2) return false;
    if (newType === "checkboxes") return newChecked.length > 0;
    return !!newCorrect;
  })();

  const changeType = (type: QuestionType) => {
    setNewType(type);
    setNewCorrect("");
    setNewChecked([]);
  };

  const toggleChecked = (opt: string) => {
    setNewChecked(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  };

  const updateOption = (index: number, value: string) => {
    const previous = newOpts[index];
    const updated = [...newOpts];
    updated[index] = value;
    setNewOpts(updated);
    if (newCorrect === previous) setNewCorrect(value);
    setNewChecked(prev => prev.map(o => (o === previous ? value : o)));
  };

  const handleAddQuestion = async () => {
    if (!canAddQuestion) return;
    setAddingQ(true);
    const correct = newType === "checkboxes" ? encodeChoices(newChecked) : newCorrect.trim();
    const { data, error } = await supabase.from("assessment_questions").insert({
      assessment_id: assessment.id,
      question: newQ.trim(),
      question_type: newType,
      options: newType === "short_answer" ? [] : filledOptions,
      correct_answer: correct,
      order: questions.length + 1,
    }).select("id, question, question_type, options, correct_answer, order").single();
    setAddingQ(false);
    if (error) { alert("Could not add the question: " + error.message); return; }
    setQuestions([...questions, data]);
    setNewQ(""); setNewOpts(["", "", "", ""]); setNewCorrect(""); setNewChecked([]); setShowQuestionForm(false);
  };

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("assessment_questions").delete().eq("id", qid);
    setQuestions(questions.filter(q => q.id !== qid));
  };

  const startEdit = (q: any) => {
    setShowQuestionForm(false);
    setEditingId(q.id);
    const type = (q.question_type ?? "multiple_choice") as QuestionType;
    setEditType(type);
    setEditQ(q.question);
    const opts = [...(q.options || [])];
    while (opts.length < 4) opts.push("");
    setEditOpts(opts);
    if (type === "checkboxes") {
      setEditCorrect("");
      setEditChecked(decodeChoices(q.correct_answer));
    } else {
      setEditCorrect(q.correct_answer);
      setEditChecked([]);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const changeEditType = (type: QuestionType) => {
    setEditType(type);
    setEditCorrect("");
    setEditChecked([]);
  };

  const toggleEditChecked = (opt: string) => {
    setEditChecked(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
  };

  const updateEditOption = (index: number, value: string) => {
    const previous = editOpts[index];
    const updated = [...editOpts];
    updated[index] = value;
    setEditOpts(updated);
    if (previous && editCorrect === previous) setEditCorrect(value);
    if (previous) setEditChecked(prev => prev.map(o => (o === previous ? value : o)));
  };

  const editFilledOptions = editOpts.map(o => o.trim()).filter(Boolean);

  const canSaveEdit = (() => {
    if (!editQ.trim()) return false;
    if (editType === "short_answer") return !!editCorrect.trim();
    if (editFilledOptions.length < 2) return false;
    if (editType === "checkboxes") return editChecked.length > 0;
    return !!editCorrect;
  })();

  const handleSaveEdit = async () => {
    if (!canSaveEdit || !editingId) return;
    setSavingEdit(true);
    const correct = editType === "checkboxes" ? encodeChoices(editChecked) : editCorrect.trim();
    const { data, error } = await supabase.from("assessment_questions")
      .update({
        question: editQ.trim(),
        question_type: editType,
        options: editType === "short_answer" ? [] : editFilledOptions,
        correct_answer: correct,
      })
      .eq("id", editingId)
      .select("id, question, question_type, options, correct_answer, order")
      .single();
    setSavingEdit(false);
    if (error) { alert("Could not save the question: " + error.message); return; }
    setQuestions(questions.map(q => (q.id === editingId ? data : q)));
    setEditingId(null);
  };

  if (loading) return <div className="text-xs mt-4" style={{ color: "var(--foreground-muted)" }}>Loading...</div>;

  return (
    <div className="card p-5 mt-4" style={{ border: "1px solid var(--secondary)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} weight="duotone" />
        <h4 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Module Quiz</h4>
        {assessment && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
            Pass {assessment.pass_threshold}% · {questions.length} question{questions.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!assessment ? (
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            Create a module quiz with a pass mark. Learners must pass to complete this module.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={`${moduleTitle} Quiz`}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Instructions (optional)</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
                placeholder="Instructions for the patient..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Pass Threshold (%)</label>
              <input type="number" value={passThreshold} onChange={e => setPassThreshold(Number(e.target.value))}
                min={1} max={100}
                className="w-24 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
            </div>
            <button onClick={handleCreate} disabled={creating || !title}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold primary-gradient disabled:opacity-60">
              {creating ? "Creating..." : "Create Module Quiz"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {questions.map((q, i) =>
            editingId === q.id ? (
              <div key={q.id} className="rounded-xl p-4 mb-2" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Question</label>
                  <input type="text" value={editQ} onChange={e => setEditQ(e.target.value)}
                    placeholder="Enter your question"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Answer type</label>
                  <select value={editType} onChange={e => changeEditType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}>
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {editType === "short_answer" ? (
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Expected answer</label>
                    <input type="text" value={editCorrect} onChange={e => setEditCorrect(e.target.value)}
                      placeholder="e.g. fibre"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
                  </div>
                ) : (
                  <div className="mb-3 space-y-2">
                    {editOpts.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type={editType === "checkboxes" ? "checkbox" : "radio"}
                          name={`edit-qcorrect-${q.id}`}
                          disabled={!opt.trim()}
                          checked={editType === "checkboxes"
                            ? editChecked.includes(opt) && !!opt
                            : editCorrect === opt && !!opt}
                          onChange={() => {
                            if (!opt.trim()) return;
                            if (editType === "checkboxes") toggleEditChecked(opt);
                            else setEditCorrect(opt);
                          }} />
                        <input type="text" value={opt} onChange={e => updateEditOption(oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          className="flex-1 px-3 py-1.5 rounded-lg border text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditOpts([...editOpts, ""])}
                      className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                      + Add option
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={handleSaveEdit} disabled={savingEdit || !canSaveEdit}
                    className="px-4 py-2 rounded-lg text-white text-xs font-semibold primary-gradient disabled:opacity-60">
                    {savingEdit ? "Saving..." : "Save Question"}
                  </button>
                  <button onClick={cancelEdit} className="text-xs font-semibold" style={{ color: "var(--foreground-secondary)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={q.id} className="rounded-xl p-3 mb-2 flex items-start justify-between gap-2"
                style={{ background: "var(--card-secondary)", border: "1px solid var(--border)" }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{i + 1}. {q.question}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    <span className="mr-1">
                      {QUESTION_TYPES.find(t => t.value === (q.question_type ?? "multiple_choice"))?.label}
                    </span>
                    · Correct: <strong>
                      {(q.question_type ?? "multiple_choice") === "checkboxes"
                        ? decodeChoices(q.correct_answer).join(", ")
                        : q.correct_answer}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => startEdit(q)} className="text-xs font-semibold" style={{ color: "var(--primary)" }}>Edit</button>
                  <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs" style={{ color: "var(--danger)" }}>Delete</button>
                </div>
              </div>
            )
          )}

          <button onClick={() => { cancelEdit(); setShowQuestionForm(!showQuestionForm); }} className="text-xs font-semibold mt-2"
            style={{ color: "var(--primary)" }}>
            {showQuestionForm ? "Cancel" : "+ Add Question"}
          </button>

          {showQuestionForm && (
            <div className="rounded-xl p-4 mt-3" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Question</label>
                <input type="text" value={newQ} onChange={e => setNewQ(e.target.value)}
                  placeholder="Enter your question"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Answer type</label>
                <select value={newType} onChange={e => changeType(e.target.value as QuestionType)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }}>
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  {QUESTION_TYPES.find(t => t.value === newType)?.hint}
                </p>
              </div>

              {newType === "short_answer" ? (
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Expected answer</label>
                  <input type="text" value={newCorrect} onChange={e => setNewCorrect(e.target.value)}
                    placeholder="e.g. fibre"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
                  <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                    Keep it to a word or two - anything longer is hard to match exactly.
                  </p>
                </div>
              ) : (
                <div className="mb-3 space-y-2">
                  {newOpts.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type={newType === "checkboxes" ? "checkbox" : "radio"}
                        name="qcorrect"
                        disabled={!opt.trim()}
                        checked={newType === "checkboxes"
                          ? newChecked.includes(opt) && !!opt
                          : newCorrect === opt && !!opt}
                        onChange={() => {
                          if (!opt.trim()) return;
                          if (newType === "checkboxes") toggleChecked(opt);
                          else setNewCorrect(opt);
                        }} />
                      <input type="text" value={opt} onChange={e => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg border text-sm"
                        style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--foreground)" }} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                      {newType === "checkboxes"
                        ? "Tick every option that counts as correct. Blank options are ignored."
                        : "Select the correct answer. Blank options are ignored."}
                    </p>
                    <button type="button" onClick={() => setNewOpts([...newOpts, ""])}
                      className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                      + Add option
                    </button>
                  </div>
                </div>
              )}
              <button onClick={handleAddQuestion}
                disabled={addingQ || !canAddQuestion}
                className="px-4 py-2 rounded-lg text-white text-xs font-semibold primary-gradient disabled:opacity-60">
                {addingQ ? "Adding..." : "Add Question"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}