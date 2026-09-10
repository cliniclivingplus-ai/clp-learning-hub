"use client";
import { useState } from "react";
import { useStaffBasePath } from "@/lib/useStaffBasePath";
import Link from "next/link";
import {
  Copy, Check, Question, Notebook, ClipboardText, FilePdf,
  GoogleLogo, YoutubeLogo, ArrowRight,
} from "@phosphor-icons/react";

const DRIVE_SERVICE_ACCOUNT = "clp-video-reader@project-5fb2ba69-c1d4-4710-bf9.iam.gserviceaccount.com";

function CopyableEmail() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DRIVE_SERVICE_ACCOUNT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) - the
      // email is still shown and selectable by hand either way.
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code
        className="text-sm px-3 py-2 rounded-lg break-all"
        style={{ background: "var(--card-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        {DRIVE_SERVICE_ACCOUNT}
      </code>
      <button
        onClick={handleCopy}
        className="text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 flex-shrink-0"
        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
      >
        {copied ? <><Check size={14} weight="bold" /> Copied</> : <><Copy size={14} weight="bold" /> Copy</>}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {n}
        </div>
        <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed pl-11" style={{ color: "var(--foreground-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function SubItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5" style={{ color: "var(--foreground-muted)" }}>{icon}</div>
      <div>
        <p className="font-medium" style={{ color: "var(--foreground)" }}>{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}

/**
 * Self-serve, start-to-finish walkthrough for building a course - written so
 * a brand new admin or instructor never has to ask someone else how to do
 * it. Shared between /admin/guide and /instructor/guide; useStaffBasePath
 * resolves which prefix the links should use.
 */
export default function CourseCreationGuide() {
  const base = useStaffBasePath();

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Adding a Course</h1>
        <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
          Everything you need to build a course from nothing to published, without asking anyone else.
        </p>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-8 text-sm" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
        <Question size={18} weight="bold" className="flex-shrink-0" />
        <span>A course is built from <strong>Modules</strong> (like chapters), each holding one or more <strong>Lessons</strong>. Build in this order: create the course → add modules → add lessons inside them → preview → publish.</span>
      </div>

      <div className="space-y-4">

        <Step n={1} title="Create the course">
          <p>
            Go to <strong>Courses → New course</strong>. Fill in:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Title</strong> - required. The URL slug fills in automatically from this; you can edit it separately if needed.</li>
            <li><strong>Description</strong> - shown on the public course card and detail page.</li>
            <li><strong>Category</strong> - type an existing one or a brand new one. New categories get their own colour automatically.</li>
            <li><strong>Publish toggle</strong> - leave this off for now. Nothing is visible to learners until you publish, so there's no rush and no risk in building with it off.</li>
          </ul>
          <p>Click <strong>Create course and add lessons</strong> - you'll land straight on the course's content page.</p>
        </Step>

        <Step n={2} title="Add a module">
          <p>
            On the Course content page, use <strong>Add Module</strong> (e.g. "Week 1" or "Introduction"). Add as many as the course needs - you can always add more later.
          </p>
        </Step>

        <Step n={3} title="Add a lesson, and choose where its video lives">
          <p>Inside a module, click <strong>Add Lesson</strong>. Give it a title, then pick one video source (or none, for a text/notes-only lesson):</p>

          <SubItem icon={<YoutubeLogo size={18} weight="duotone" />} title="YouTube">
            Paste the video URL or ID. The video must be set to <strong>Unlisted</strong> on YouTube - never Public, since anyone with the link could otherwise watch it outside the app.
          </SubItem>

          <SubItem icon={<GoogleLogo size={18} weight="duotone" />} title="Google Drive video or audio">
            For anything you don't want hosted on YouTube. Paste the Drive share link or file ID into the "Google Drive video" (or "Google Drive audio") field.
            <span className="block mt-1 font-medium" style={{ color: "var(--danger)" }}>
              This is the one step that's easy to miss - see the callout below before you do this.
            </span>
          </SubItem>

          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            Save the lesson once the video is set - lesson resources (next step) need a saved lesson to attach to.
          </p>
        </Step>

        <div className="card p-6" style={{ border: "1px solid var(--danger-light)", background: "var(--danger-light)" }}>
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: "var(--danger)" }}>
            <GoogleLogo size={18} weight="bold" /> Before pasting any Google Drive link
          </h3>
          <p className="text-sm mb-3" style={{ color: "var(--foreground-secondary)" }}>
            The app streams Drive videos through a private Google account - it never uses your personal Drive login. That account can only see files you've explicitly shared with it. If you skip this step, the video will fail to load for every learner (and for you, in the live preview).
          </p>
          <ol className="text-sm space-y-1.5 list-decimal pl-5 mb-4" style={{ color: "var(--foreground-secondary)" }}>
            <li>In Google Drive, right-click the video file (or the folder it's in) and choose <strong>Share</strong>.</li>
            <li>Paste in the email below.</li>
            <li>Set its role to <strong>Viewer</strong> (never Editor - Viewer is all the app ever needs).</li>
            <li>Click Send/Share, then come back and paste that file's link into the lesson.</li>
          </ol>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>Share every course video with this account:</p>
          <CopyableEmail />
        </div>

        <Step n={4} title="Fill out the rest of the lesson">
          <p>Once a lesson is saved, its editor grows a few more optional sections:</p>
          <SubItem icon={<Notebook size={18} weight="duotone" />} title="Lesson Notes">
            A rich-text area shown under the video - links you paste in render in blue automatically.
          </SubItem>
          <SubItem icon={<FilePdf size={18} weight="duotone" />} title="Lesson resources">
            Upload PDFs or images directly (no Drive needed under 45 MB) - a handout, a recipe, a worksheet. Attach as many as the lesson needs, and swap or remove any of them later.
          </SubItem>
          <SubItem icon={<Notebook size={18} weight="duotone" />} title="Lesson Quiz">
            Add multiple-choice, checkbox, or short-answer questions. Every question stays editable afterward - click Edit on it any time to fix wording or the correct answer.
          </SubItem>
          <SubItem icon={<ClipboardText size={18} weight="duotone" />} title="Assignment">
            One title + prompt per lesson, for anything you want a written response to.
          </SubItem>
        </Step>

        <Step n={5} title="Module-level extras (optional)">
          <p>Back on the Course content page, each module can also carry:</p>
          <SubItem icon={<FilePdf size={18} weight="duotone" />} title="Module resources">
            PDFs/images relevant to the whole module rather than one lesson.
          </SubItem>
          <SubItem icon={<Notebook size={18} weight="duotone" />} title="Module quiz">
            A quiz with a pass threshold, sitting after all the module's lessons - use it as a knowledge check before a learner moves on.
          </SubItem>
        </Step>

        <Step n={6} title="Add a course picture (optional)">
          <p>
            Click the small image square next to the course title on the Course content page to upload a cover photo (JPEG/PNG/WebP, up to 5 MB).
            It appears on the public catalog card and the course detail page. Click it again any time to replace it.
          </p>
        </Step>

        <Step n={7} title="Preview everything before publishing">
          <p>
            Click <strong>Preview course</strong>. This walks through every module and lesson exactly as an enrolled learner will see it - real video, notes, resources, quiz questions, assignment prompt - with nothing tracked or saved. Use it to catch anything before it goes live.
          </p>
        </Step>

        <Step n={8} title="Publish">
          <p>
            Click <strong>Publish course</strong> on the Course content page. It's now visible in the public catalog and learners can enroll. Instructors can publish or unpublish their own courses at any time; admins can do this for any course. Toggling it off instantly hides it again without deleting anything.
          </p>
        </Step>

      </div>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link
          href={`${base}/courses/new`}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold primary-gradient inline-flex items-center gap-1.5"
        >
          Start a new course <ArrowRight size={14} weight="bold" />
        </Link>
        <Link
          href={`${base}/courses`}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
          style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}
        >
          Back to Courses
        </Link>
      </div>
    </div>
  );
}
