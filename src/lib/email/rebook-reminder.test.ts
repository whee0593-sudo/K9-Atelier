import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRebookReminderCopy,
  buildRebookReminderEmail,
  buildRebookReminderEmailHtml,
} from "./rebook-reminder";

describe("rebook reminder email", () => {
  it("uses the dog name in the subject and the client first name in the greeting", () => {
    const email = buildRebookReminderEmail({
      firstName: "Sarah",
      petName: "Lychee",
    });

    assert.equal(email.subject, "Time for Lychee’s next spa visit?");
    assert.match(email.text, /^Hi Sarah,/);
    assert.match(email.html, /Hi Sarah,/);
    assert.match(email.text, /Lychee’s last visit/);
    assert.match(email.html, /Lychee’s last visit/);
    assert.match(email.text, /keep Lychee on a regular grooming schedule/);
    assert.match(email.text, /welcoming Lychee back to the spa/);
    assert.match(
      email.text,
      /a bath every 7–15 days and grooming every 3–4 weeks/,
    );
  });

  it("keeps body copy at regular weight and links the booking button", () => {
    const html = buildRebookReminderEmailHtml({
      firstName: "Sarah",
      petName: "Lychee",
    });

    assert.match(html, /https:\/\/k9atelier\.com\/email-logo\.png/);
    assert.match(
      html,
      /href="https:\/\/k9atelier\.com\/book"[^>]*>BOOK NEXT APPOINTMENT</,
    );
    assert.match(html, /background-color:#756578/);
    assert.match(html, />Warmly,</);
    assert.match(html, />Penny</);
    assert.match(html, />K9 Atelier</);
    assert.match(html, />Private Mobile Pet Spa</);
    assert.match(html, />Palm Beach</);
    assert.doesNotMatch(html, /<(strong|b)\b/i);
    assert.doesNotMatch(html, /font-weight:\s*(600|700|bold|bolder)/i);
  });

  it("escapes names and falls back when a name is missing", () => {
    const named = buildRebookReminderCopy({
      firstName: "Ann <script>",
      petName: "Maple & Co",
    });
    assert.equal(named.subject, "Time for Maple & Co’s next spa visit?");
    assert.match(buildRebookReminderEmailHtml({
      firstName: "Ann <script>",
      petName: "Maple & Co",
    }), /Hi Ann &lt;script&gt;,/);
    assert.match(buildRebookReminderEmailHtml({
      firstName: "Ann <script>",
      petName: "Maple & Co",
    }), /Maple &amp; Co/);

    const fallback = buildRebookReminderCopy({
      firstName: "  ",
      petName: "",
    });
    assert.equal(fallback.subject, "Time for your dog’s next spa visit?");
    assert.match(fallback.text, /^Hi there,/);
    assert.match(fallback.text, /BOOK NEXT APPOINTMENT: https:\/\/k9atelier\.com\/book/);
  });
});
