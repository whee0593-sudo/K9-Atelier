"use client";

import { useEffect, useRef, useState } from "react";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { isValidContact, MAX_SUPPORT_PHOTOS } from "@/lib/support-contact";

type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

function inputClass() {
  return `${bookingFieldClass} font-body`;
}

export function ContactBoardForm() {
  const [contact, setContact] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  function replacePhotos(next: PhotoDraft[]) {
    setPhotos((current) => {
      const keep = new Set(next.map((photo) => photo.previewUrl));
      for (const photo of current) {
        if (!keep.has(photo.previewUrl)) URL.revokeObjectURL(photo.previewUrl);
      }
      return next;
    });
  }

  function handlePhotosSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const remaining = MAX_SUPPORT_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`You can upload up to ${MAX_SUPPORT_PHOTOS} photos.`);
      return;
    }
    const accepted = incoming.slice(0, remaining).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    replacePhotos([...photos, ...accepted]);
    if (incoming.length > remaining) {
      setError(`You can upload up to ${MAX_SUPPORT_PHOTOS} photos.`);
    } else {
      setError(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(id: string) {
    replacePhotos(photos.filter((photo) => photo.id !== id));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || success) return;
    setError(null);

    if (!isValidContact(contact)) {
      setError("Please enter a valid email address or phone number.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    if (!message.trim()) {
      setError("Please enter your message.");
      return;
    }

    setSending(true);
    try {
      const body = new FormData();
      body.set("contact", contact.trim());
      body.set("subject", subject.trim());
      body.set("message", message.trim());
      for (const photo of photos) {
        body.append("photos", photo.file);
      }

      const res = await fetch("/api/support", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      setContact("");
      setSubject("");
      setMessage("");
      replacePhotos([]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return (
      <p
        className="border border-gray-line/80 bg-dusty-lavender/25 px-6 py-5 text-sm leading-relaxed text-ink"
        role="status"
      >
        Thank you — your message has been sent. We will get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-left">
      <div>
        <label htmlFor="board-contact" className={bookingLabelClass}>
          Email or phone number
          <span className="text-champagne"> *</span>
        </label>
        <p className="font-body mt-1 text-xs text-taupe">
          Leave one — whichever is easiest for us to reach you.
        </p>
        <input
          id="board-contact"
          type="text"
          autoComplete="email tel"
          value={contact}
          onChange={(event) => {
            setContact(event.target.value);
            setError(null);
          }}
          placeholder="you@example.com or (561) 555-0123"
          className={inputClass()}
        />
      </div>

      <div>
        <label htmlFor="board-subject" className={bookingLabelClass}>
          Subject
          <span className="text-champagne"> *</span>
        </label>
        <input
          id="board-subject"
          type="text"
          maxLength={120}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setError(null);
          }}
          placeholder="How can we help?"
          className={inputClass()}
        />
      </div>

      <div>
        <label htmlFor="board-message" className={bookingLabelClass}>
          Message
          <span className="text-champagne"> *</span>
        </label>
        <textarea
          id="board-message"
          rows={10}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setError(null);
          }}
          placeholder="Write your note here."
          className={`${inputClass()} min-h-[12rem] py-4 resize-y`}
        />
      </div>

      <div>
        <p className={bookingLabelClass}>Photos</p>
        <p className="font-body mt-1 text-xs text-taupe">
          Optional · up to {MAX_SUPPORT_PHOTOS} photos · JPG, PNG, WEBP, or HEIC
          · 4 MB each
        </p>
        <div className="mt-3 rounded-sm border border-dashed border-gray-line bg-ivory px-4 py-5">
          {photos.length > 0 ? (
            <ul className="mb-4 grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <li key={photo.id} className="relative">
                  <img
                    src={photo.previewUrl}
                    alt={photo.file.name}
                    className="h-24 w-full rounded-sm object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 bg-ink/80 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ivory"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photos.length < MAX_SUPPORT_PHOTOS ? (
            <label className="font-body block cursor-pointer text-center text-sm text-taupe">
              <span className="underline decoration-champagne/70 underline-offset-4 hover:text-deep-lavender">
                {photos.length === 0 ? "Add photos" : "Add another photo"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                multiple
                className="sr-only"
                onChange={(event) => handlePhotosSelected(event.target.files)}
              />
            </label>
          ) : (
            <p className="font-body text-center text-xs text-taupe">
              Maximum of {MAX_SUPPORT_PHOTOS} photos reached.
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={sending} className={bookingPrimaryBtnClass}>
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
