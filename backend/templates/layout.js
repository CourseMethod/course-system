'use strict';

/**
 * Shared email layout.
 *
 * Email HTML is not web HTML. The constraints that shape everything below:
 *
 *   - Outlook renders with Word's engine. No flexbox, no grid, no float.
 *     Tables, or nothing.
 *   - Gmail strips <style> blocks in some contexts, so every rule that matters
 *     is an inline `style` attribute.
 *   - Dark mode in Apple Mail inverts colours unpredictably; explicit
 *     background colours on every container keep text readable.
 *   - Many clients block images by default, so the layout must make sense with
 *     zero images loaded. There is no logo image here for that reason.
 *   - Every HTML email ships with a plain-text alternative. Skipping it is one
 *     of the strongest spam signals there is.
 */

const { config } = require('../config');
const { escapeHtml } = require('../utils/validate');

const COLOURS = {
  ink: '#111827',
  body: '#374151',
  muted: '#6b7280',
  accent: '#4f46e5',
  accentDark: '#4338ca',
  border: '#e5e7eb',
  surface: '#f9fafb',
  white: '#ffffff',
};

/**
 * Wrap body content in the standard shell.
 *
 * @param {object} options
 * @param {string} options.title       Used as the <title> and for accessibility.
 * @param {string} options.preheader   The grey snippet next to the subject line
 *                                     in the inbox. This is prime real estate
 *                                     and most senders waste it — it is a second
 *                                     headline, not a repeat of the first.
 * @param {string} options.content     Inner HTML.
 * @param {string} [options.trackingPixelUrl]
 * @param {string} [options.unsubscribeUrl]
 */
function render({ title, preheader, content, trackingPixelUrl = null, unsubscribeUrl = null }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLOURS.surface}; -webkit-font-smoothing:antialiased;">

  <!-- Preheader: shown in the inbox preview, hidden in the open email. -->
  <div style="display:none; font-size:1px; color:${COLOURS.surface}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${escapeHtml(preheader)}
    <!-- Non-breaking spaces stop clients pulling body copy into the preview. -->
    ${'&#847;&zwnj;&nbsp;'.repeat(60)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOURS.surface};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; background-color:${COLOURS.white}; border-radius:12px; border:1px solid ${COLOURS.border};">

          <!-- Wordmark (text, not an image, so it survives image blocking) -->
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:${COLOURS.ink}; letter-spacing:-0.01em;">
                Course Printer
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; line-height:1.65; color:${COLOURS.body};">
              ${content}
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="border-top:1px solid ${COLOURS.border}; padding-top:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:${COLOURS.muted};">
                <p style="margin:0 0 8px 0;">
                  Questions? Just reply to this email — it reaches a real person.
                </p>
                <p style="margin:0 0 8px 0;">
                  &copy; ${new Date().getFullYear()} Course Printer
                </p>
                ${unsubscribeUrl ? `<p style="margin:0;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLOURS.muted}; text-decoration:underline;">Unsubscribe from tips and updates</a> &middot; You will still receive anything relating to your purchase.</p>` : ''}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  ${trackingPixelUrl ? `<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" style="display:block; border:0; width:1px; height:1px;" />` : ''}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Component helpers — keep every template visually consistent
// ---------------------------------------------------------------------------

/** A bulletproof button that renders correctly in Outlook. */
function button(label, url) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center" bgcolor="${COLOURS.accent}" style="border-radius:8px;">
          <a href="${escapeHtml(url)}"
             style="display:inline-block; padding:14px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 16px 0; font-size:23px; line-height:1.3; font-weight:700; color:${COLOURS.ink}; letter-spacing:-0.02em;">${escapeHtml(text)}</h1>`;
}

function subheading(text) {
  return `<h2 style="margin:28px 0 12px 0; font-size:17px; line-height:1.35; font-weight:700; color:${COLOURS.ink};">${escapeHtml(text)}</h2>`;
}

function paragraph(html) {
  return `<p style="margin:0 0 16px 0;">${html}</p>`;
}

/** A callout box for the single most important fact in the email. */
function callout(html, { tone = 'neutral' } = {}) {
  const tones = {
    neutral: { bg: COLOURS.surface, border: COLOURS.border },
    accent: { bg: '#eef2ff', border: '#c7d2fe' },
    warn: { bg: '#fffbeb', border: '#fde68a' },
  };
  const { bg, border } = tones[tone] || tones.neutral;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:${bg}; border:1px solid ${border}; border-radius:8px; padding:16px 18px; font-size:15px; line-height:1.6; color:${COLOURS.body};">
          ${html}
        </td>
      </tr>
    </table>`;
}

/** Numbered steps. Ordered lists render inconsistently, so this is a table. */
function steps(items) {
  const rows = items.map((item, index) => `
    <tr>
      <td valign="top" style="padding:0 12px 14px 0; width:26px;">
        <div style="width:24px; height:24px; background-color:${COLOURS.accent}; color:#ffffff; border-radius:12px; text-align:center; line-height:24px; font-size:13px; font-weight:700;">${index + 1}</div>
      </td>
      <td valign="top" style="padding:0 0 14px 0; font-size:15px; line-height:1.6; color:${COLOURS.body};">${item}</td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">${rows}</table>`;
}

function bullets(items) {
  return `<ul style="margin:0 0 16px 0; padding-left:20px;">${
    items.map((item) => `<li style="margin:0 0 8px 0; line-height:1.6;">${item}</li>`).join('')
  }</ul>`;
}

function signoff(name = 'The Course Printer team') {
  return `<p style="margin:24px 0 0 0;">— ${escapeHtml(name)}</p>`;
}

/**
 * Convert an HTML email body to a plain-text alternative.
 *
 * A real conversion, not a stub: links become "text (url)" so a text-only
 * reader can still act on them, which is the whole point.
 */
function toPlainText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return url.startsWith('http') ? `${text} ( ${url} )` : text;
    })
    .replace(/<li[^>]*>/gi, '\n  - ')
    .replace(/<\/(p|div|tr|h1|h2|h3)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&zwnj;/g, '')
    .replace(/&#847;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((line) => line.trimEnd()).join('\n')
    .trim();
}

module.exports = {
  render,
  button,
  heading,
  subheading,
  paragraph,
  callout,
  steps,
  bullets,
  signoff,
  toPlainText,
  COLOURS,
  supportEmail: () => config.email.supportEmail,
};
