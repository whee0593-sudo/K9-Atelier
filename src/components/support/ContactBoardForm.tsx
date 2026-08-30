"use client";

import { useEffect, useRef, useState } from "react";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import {
  CONTACT_INQUIRY_CONSULTATION,
  CONTACT_INQUIRY_TYPES,
  MAX_SUPPORT_PHOTO_BYTES,
  MAX_SUPPORT_PHOTOS,
  SUPPORT_PHOTO_ACCEPT,
  inquiryTypeFromQuery,
  isAllowedSupportPhoto,
  isValidContact,
} from "@/lib/support-contact";

type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

function inputClass() {
  return `${bookingFieldClass} font-body`;
}

export function ContactBoardForm({
  initialInquiry,
}: {
  initialInquiry?: string;
}) {
  const [inquiryType, setInquiryType] = useState(
    inquiryTypeFromQuery(initialInquiry),
  );
  const [contact, setContact] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [groomingPreferences, setGroomingPreferences] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const isConsultation = inquiryType === CONTACT_INQUIRY_CONSULTATION;

  useEffect(() => {
    setInquiryType(inquiryTypeFromQuery(initialInquiry));
  }, [initialInquiry]);

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

    const accepted: PhotoDraft[] = [];
    for (const file of incoming.slice(0, remaining)) {
      if (!isAllowedSupportPhoto(file)) {
        setError("Photos must be JPG, JPEG, PNG, or WEBP.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_SUPPORT_PHOTO_BYTES) {
        setError("Each photo must be 4 MB or smaller.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

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
    const resolvedSubject = isConsultation
      ? "Grooming Consultation"
      : subject.trim();
    if (!resolvedSubject) {
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
      body.set("subject", resolvedSubject);
      body.set("inquiryType", inquiryType);
      body.set("message", message.trim());
      if (isConsultation && groomingPreferences.trim()) {
        body.set("groomingPreferences", groomingPreferences.trim());
      }
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
      setGroomingPreferences("");
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
        <label htmlFor="board-inquiry" className={bookingLabelClass}>
          Inquiry Type
          <span className="text-champagne"> *</span>
        </label>
        <select
          id="board-inquiry"
          value={inquiryType}
          onChange={(event) => {
            setInquiryType(inquiryTypeFromQuery(event.target.value));
            setError(null);
          }}
          className={inputClass()}
        >
          {CONTACT_INQUIRY_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {isConsultation ? (
        <div className="border border-gray-line/80 bg-dusty-lavender/20 px-5 py-5 md:px-6">
          <p className="font-body text-sm leading-relaxed text-ink">
            To help me understand your dog’s coat and grooming needs, please
            include:
          </p>
          <ul className="font-body mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-taupe">
            <li>A clear, front-facing photo of your dog’s face</li>
            <li>A full-body photo taken from the side</li>
            <li>Clear close-up photos showing the coat’s current condition</li>
            <li>Your grooming preferences or concerns</li>
            <li>The coat length you would like to maintain between appointments</li>
          </ul>
        </div>
      ) : null}

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

      {isConsultation ? null : (
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
      )}

      {isConsultation ? (
        <div>
          <label htmlFor="board-preferences" className={bookingLabelClass}>
            Grooming Preferences &amp; Coat Goals
          </label>
          <textarea
            id="board-preferences"
            rows={5}
            value={groomingPreferences}
            onChange={(event) => {
              setGroomingPreferences(event.target.value);
              setError(null);
            }}
            placeholder="Tell me about your preferred style, any coat or skin concerns, and the coat length you would like to maintain."
            className={`${inputClass()} min-h-[8rem] py-4 resize-y`}
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="board-message" className={bookingLabelClass}>
          Message
          <span className="text-champagne"> *</span>
        </label>
        <textarea
          id="board-message"
          rows={isConsultation ? 6 : 10}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setError(null);
          }}
          placeholder={
            isConsultation
              ? "Share your dog’s name, breed, and anything else I should know."
              : "Write your note here."
          }
          className={`${inputClass()} min-h-[10rem] py-4 resize-y`}
        />
      </div>

      <div>
        <p className={bookingLabelClass}>Upload Photos</p>
        <p className="font-body mt-1 text-xs text-taupe">
          {isConsultation
            ? "Please upload clear front-facing, side-profile, and close-up coat photos."
            : "Optional photos to help us understand your question."}{" "}
          Up to {MAX_SUPPORT_PHOTOS} photos · JPG, JPEG, PNG, or WEBP · 4 MB each
        </p>
        <div className="mt-3 rounded-sm border border-dashed border-gray-line bg-ivory px-4 py-5">
          {photos.length > 0 ? (
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <li key={photo.id} className="relative">
                  <img
                    src={photo.previewUrl}
                    alt={photo.file.name}
                    className="h-24 w-full rounded-sm object-cover"
                  />
                  <p className="font-body mt-1 truncate text-[11px] text-taupe">
                    {photo.file.name}
                  </p>
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
            <label className="font-body block min-h-11 cursor-pointer text-center text-sm text-taupe">
              <span className="underline decoration-champagne/70 underline-offset-4 hover:text-deep-lavender">
                {photos.length === 0 ? "Add photos" : "Add another photo"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORT_PHOTO_ACCEPT}
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
