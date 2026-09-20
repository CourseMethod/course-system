'use strict';

/**
 * Email template registry.
 *
 * Each template is a function of a context object returning { subject, html, text }.
 * Templates never touch the database or the network — they are pure, so they can
 * be rendered in a test or previewed in the admin dashboard without side effects.
 *
 * On the copy itself: these are transactional emails, and transactional email
 * that reads like marketing gets marked as spam, which takes your whole domain
 * down with it. The delivery email in particular has exactly one job — get the
 * customer to the download — and every sentence that does not serve that job
 * has been cut.
 */

const L = require('./layout');
const { escapeHtml } = require('../utils/validate');

/**
 * 1. DELIVERY — sent the instant payment succeeds.
 *
 * The most important email in the business. If this fails or lands in spam, the
 * customer's experience is "I paid and got nothing", and that becomes a refund
 * or a chargeback within the hour. Short, unmissable link, no upsell, no fluff.
 */
function delivery({ tierName, downloadUrl, expiresAt, supportEmail, orientationUrl, trackingPixelUrl }) {
  const expiryText = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const content = `
    ${L.heading(`Your copy of ${tierName} is ready`)}

    ${L.paragraph('Payment went through. Here is everything you just bought — one click:')}

    ${L.button('Download your course vault', downloadUrl)}

    ${L.callout(
      `<strong>Save this file somewhere you will find it again.</strong> This link works until <strong>${escapeHtml(expiryText)}</strong>. ` +
      'After that, or if you change computers, just reply to this email and I will send a fresh one — no hassle, no time limit on that.',
      { tone: 'accent' }
    )}

    ${L.subheading('Do this next (about 8 minutes)')}

    ${L.steps([
      'Unzip the file you just downloaded.',
      'Install <a href="https://obsidian.md" style="color:#4f46e5;">Obsidian</a> — it is free, and it is what turns the folder into a navigable course.',
      'In Obsidian choose <em>Open folder as vault</em> and point it at the unzipped folder.',
      'Open <strong>00-Command-Center.md</strong>. It tells you exactly where to start and in what order.',
    ])}

    ${L.paragraph(
      'If you would rather just read it in any text editor, that works too — every lesson is a plain Markdown file. ' +
      'Obsidian only adds the links between them.'
    )}

    ${orientationUrl ? L.paragraph(`There is also a <a href="${escapeHtml(orientationUrl)}" style="color:#4f46e5;">5-minute orientation</a> if you want the guided version.`) : ''}

    ${L.subheading('If something goes wrong')}

    ${L.paragraph(
      `Reply to this email. It comes straight to me at ${escapeHtml(supportEmail)}, and I answer every one within 24 hours — ` +
      'usually much faster. Broken link, wrong file, changed your mind: all fine, just say so.'
    )}

    ${L.signoff()}
  `;

  const html = L.render({
    title: `Your ${tierName} download`,
    // Preheader carries the one fact they want: the link is inside.
    preheader: 'Your download link is inside — plus the 8-minute setup.',
    content,
    trackingPixelUrl,
  });

  return {
    // No emoji, no marketing language: this subject has to survive spam filters
    // and be findable in six months by someone searching their inbox.
    subject: `${tierName} — your download link`,
    html,
    text: L.toPlainText(content),
  };
}

/**
 * 2. WELCOME — sent ~15 minutes after delivery.
 *
 * Purpose: set expectations and pre-empt the two things that kill completion —
 * feeling overwhelmed by the volume, and not knowing what "done" looks like.
 */
function welcome({ firstName, tierName, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  const content = `
    ${L.heading('Read this before you open lesson one')}

    ${L.paragraph(greeting)}

    ${L.paragraph(
      `You now have ${escapeHtml(tierName)}. Forty lessons is a lot to look at, so let me save you the ` +
      'mistake almost everyone makes with a course like this.'
    )}

    ${L.paragraph('<strong>Do not read it all first.</strong>')}

    ${L.paragraph(
      'The people who finish and launch are not the ones who read fastest. They are the ones who read one ' +
      'lesson, do the thing at the bottom of it, and only then read the next one. The people who binge all ' +
      'forty lessons over a weekend feel productive and have built nothing by Monday.'
    )}

    ${L.callout(
      '<strong>Your first week, honestly:</strong><br>' +
      'Module 1 (Mindset) — about 40 minutes, and by the end you have picked your topic.<br>' +
      'Module 2 (Build) — three or four sittings, and by the end you have a real vault with real lessons in it.<br>' +
      '<br>That is it. Two modules. Do not touch Sell or Market until something exists to sell.'
    )}

    ${L.subheading('What "working" looks like')}

    ${L.paragraph('So you can tell progress from motion:')}

    ${L.bullets([
      '<strong>Week 1</strong> — a topic you have stopped second-guessing, and an outline.',
      '<strong>Week 2</strong> — lessons written. Rough is correct at this stage.',
      '<strong>Week 3</strong> — a live sales page and a working checkout.',
      '<strong>Week 4</strong> — posting daily, talking to people who reply.',
    ])}

    ${L.paragraph(
      'If you are behind that, you are not behind. That is a pace, not a deadline, and it assumes you have ' +
      'evenings free. What matters is the order, not the calendar.'
    )}

    ${L.subheading('One thing I want you to do today')}

    ${L.paragraph(
      'Open <strong>01-Mindset/02-Picking-Your-Topic.md</strong> and do the exercise in it. It takes twelve ' +
      'minutes and it is the single decision everything else depends on. Most people who stall stalled here, ' +
      'because they kept the decision open while trying to do the next step.'
    )}

    ${L.paragraph(
      `And if you get stuck — genuinely stuck, not just uncertain — reply to this email. I am at ` +
      `${escapeHtml(supportEmail)} and I would much rather answer a small question this week than hear in a ` +
      'month that you never started.'
    )}

    ${L.signoff()}
  `;

  return {
    subject: 'Before you start: the one mistake to avoid',
    html: L.render({
      title: 'Getting started',
      preheader: 'Forty lessons, and the wrong way to approach all of them.',
      content,
      trackingPixelUrl,
      unsubscribeUrl,
    }),
    text: L.toPlainText(content),
  };
}

/**
 * 3. ORIENTATION — day 2. Removes the practical friction that stops people.
 */
function orientation({ firstName, downloadUrl, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  const content = `
    ${L.heading('Getting the vault set up properly')}

    ${L.paragraph(greeting)}

    ${L.paragraph(
      'Quick practical one. Most of the setup questions I get are the same four, so here they are answered ' +
      'before you hit them.'
    )}

    ${L.subheading('"Obsidian looks complicated"')}

    ${L.paragraph(
      'It is a folder of text files with a nice reader on top. You need exactly three things: click a link to ' +
      'follow it, <strong>Ctrl/Cmd + O</strong> to jump to any lesson by name, and the left sidebar to see ' +
      'the structure. Ignore every other feature — plugins, graph view, canvas. They are genuinely useful ' +
      'later and a distraction now.'
    )}

    ${L.subheading('"Do I have to use Obsidian?"')}

    ${L.paragraph(
      'No. Every lesson is a plain <code>.md</code> file. VS Code, Notion (import the folder), Typora, or ' +
      'Notepad all work. You only lose the clickable links between lessons.'
    )}

    ${L.subheading('"Where do I actually start?"')}

    ${L.paragraph('<strong>00-Command-Center.md</strong>. It is the map. If you ever feel lost, go back to it.')}

    ${L.subheading('"My download link expired"')}

    ${L.paragraph(
      `Reply and I will send a new one. There is no limit on that and no charge — you bought it, it is yours.` +
      (downloadUrl ? ` Your current link: <a href="${escapeHtml(downloadUrl)}" style="color:#4f46e5;">download again</a>.` : '')
    )}

    ${L.callout(
      '<strong>A tip almost nobody uses:</strong> make a note in the vault called <em>My Course.md</em> and ' +
      'keep every idea in it as you read. By the end of Module 2 that scratch file becomes your outline. ' +
      'Building it as you go is far easier than facing a blank page afterwards.'
    )}

    ${L.paragraph(`Anything else, reply here — ${escapeHtml(supportEmail)}.`)}

    ${L.signoff()}
  `;

  return {
    subject: 'Setting up the vault (4 common questions)',
    html: L.render({
      title: 'Orientation',
      preheader: 'Obsidian in three shortcuts, and what to ignore.',
      content,
      trackingPixelUrl,
      unsubscribeUrl,
    }),
    text: L.toPlainText(content),
  };
}

/**
 * 4. WEEK ONE CHECK-IN — day 7.
 *
 * The highest-leverage email you send. A customer who has not opened the vault
 * by day 7 will almost certainly never open it, and that is who refunds and who
 * never becomes a testimonial. This email exists to catch them, and it works by
 * being genuinely easy to reply to.
 */
function weekOneCheckIn({ firstName, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  const content = `
    ${L.heading('A week in — how is it going?')}

    ${L.paragraph(greeting)}

    ${L.paragraph('Genuine question, and a short reply is a perfect reply. Which one are you?')}

    ${L.bullets([
      '<strong>"Building"</strong> — great. Reply with your topic, I am curious and I will tell you if I see a problem with it.',
      '<strong>"Stuck on something"</strong> — reply with what. Specific questions get specific answers.',
      '<strong>"Have not opened it"</strong> — reply with just that word. No judgement, and I have a suggestion that helps.',
    ])}

    ${L.paragraph(
      'That third one is why I send this. About a third of people who buy a course never open it, and it is ' +
      'almost never about the course — it is that the first step felt bigger than the twenty minutes they had ' +
      'free that evening. If that is you, say so and I will give you the twenty-minute version.'
    )}

    ${L.subheading('The bit that trips most people')}

    ${L.paragraph(
      'Choosing the topic. Specifically, being unable to stop reconsidering it. Here is the resolution: your ' +
      'first course does not need to be the right one, it needs to be <em>finished</em>. You learn more from ' +
      'shipping a mediocre course to twenty people than from perfecting the outline of one you never release. ' +
      'The second is always better, and you cannot get to it without the first.'
    )}

    ${L.paragraph(
      'So pick the one you could outline this week and start. If it turns out to be wrong, you will have ' +
      'learned the whole system and the next one takes a fraction of the time.'
    )}

    ${L.paragraph(`Reply and tell me where you are — ${escapeHtml(supportEmail)}.`)}

    ${L.signoff()}
  `;

  return {
    subject: 'How is the course going?',
    html: L.render({
      title: 'Week one check-in',
      preheader: 'Three possible answers. Any of them is fine.',
      content,
      trackingPixelUrl,
      unsubscribeUrl,
    }),
    text: L.toPlainText(content),
  };
}

/**
 * 5. CUSTOMER STORIES — day 21.
 *
 * IMPORTANT: this template renders REAL testimonials passed in from the
 * database (approved + consented only). If you have none yet, it renders a
 * different email entirely rather than inventing anyone — see the branch below.
 * Do not "temporarily" hardcode examples here to fill the space. That is
 * exactly the thing that is illegal, and it is also the thing that gets spotted.
 */
function customerStories({ firstName, testimonials = [], salesUrl, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  // No real stories yet — send something useful instead of something invented.
  if (!testimonials || testimonials.length === 0) {
    const content = `
      ${L.heading('What are you building?')}

      ${L.paragraph(greeting)}

      ${L.paragraph(
        'Three weeks in. I am collecting results from people working through this, and I would like yours — ' +
        'whatever stage it is at.'
      )}

      ${L.paragraph('Reply with any of these:')}

      ${L.bullets([
        'What you decided to teach, and why that one.',
        'What is working — a post that landed, a first sale, an email that got a reply.',
        'What is not. This is the more useful answer and it is the one I act on.',
      ])}

      ${L.paragraph(
        'If something has worked and you are willing to let me quote you on it, say so explicitly and I will ' +
        'ask you to confirm the exact wording before it goes anywhere. I do not publish anything without that.'
      )}

      ${L.signoff()}
    `;

    return {
      subject: 'What are you building?',
      html: L.render({ title: 'Check-in', preheader: 'Three weeks in — tell me where you got to.', content, trackingPixelUrl, unsubscribeUrl }),
      text: L.toPlainText(content),
    };
  }

  const stories = testimonials.slice(0, 3).map((t) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="border-left:3px solid ${L.COLOURS.accent}; padding:4px 0 4px 16px;">
          ${t.headline ? `<div style="font-weight:700; color:${L.COLOURS.ink}; margin-bottom:6px;">${escapeHtml(t.headline)}</div>` : ''}
          <div style="font-size:15px; line-height:1.65; color:${L.COLOURS.body};">${escapeHtml(t.quote)}</div>
          <div style="font-size:13px; color:${L.COLOURS.muted}; margin-top:8px;">
            — ${escapeHtml(t.name)}${t.result_timeframe ? `, ${escapeHtml(t.result_timeframe)}` : ''}
          </div>
        </td>
      </tr>
    </table>`).join('');

  const content = `
    ${L.heading('What other people have built with this')}

    ${L.paragraph(greeting)}

    ${L.paragraph(
      'A few things people working through this system have sent me recently. All published with their ' +
      'permission, in their own words:'
    )}

    ${stories}

    ${L.paragraph(
      'Nothing about these people is special. They picked something they already knew, wrote it down properly, ' +
      'and put it somewhere people could buy it. The gap between them and everyone still thinking about it is ' +
      'mostly just having started.'
    )}

    ${salesUrl ? L.paragraph(`If you are mid-build and want the next step, <a href="${escapeHtml(salesUrl)}" style="color:#4f46e5;">everything is here</a>.`) : ''}

    ${L.paragraph(
      `And if you have something working — a first sale, a post that did numbers, anything — reply and tell me. ` +
      `I read all of them (${escapeHtml(supportEmail)}).`
    )}

    ${L.signoff()}
  `;

  return {
    subject: 'What other people built with this',
    html: L.render({ title: 'Customer stories', preheader: 'Real results, in their words, with permission.', content, trackingPixelUrl, unsubscribeUrl }),
    text: L.toPlainText(content),
  };
}

/**
 * 6. UPSELL — day 30, and only to `method` customers.
 *
 * The rule that keeps an upsell from feeling like a bait-and-switch: it must be
 * the genuine next thing for someone who used what they already bought, and it
 * must be skippable without friction. Note the second-to-last paragraph — the
 * explicit "you do not need this" is not modesty, it is what makes the rest
 * credible.
 */
function upsell({ firstName, upgradeUrl, upgradePriceFormatted, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  const content = `
    ${L.heading('If the building is done, this is the part that sells it')}

    ${L.paragraph(greeting)}

    ${L.paragraph(
      'A month in. If you have written your lessons, there is a specific wall you are about to hit, and it is ' +
      'not a motivation problem — it is a plumbing problem.'
    )}

    ${L.paragraph(
      'You need somewhere to send people. That means a sales page, a checkout that works, a way to deliver the ' +
      'file automatically at 3am when someone in another timezone buys, and somewhere to see what is actually ' +
      'happening. Most people lose two or three weeks here, and a good number stop entirely — not because the ' +
      'course was bad, but because wiring up Stripe on a Tuesday night is miserable.'
    )}

    ${L.subheading('What The Engine is')}

    ${L.paragraph('The whole machine, working, for you to put your own words into:')}

    ${L.bullets([
      'The sales page — this exact system\'s page, as code you edit.',
      'Stripe checkout, already wired up, tested, handling failed cards properly.',
      'Automatic delivery — signed download links, expiry, resend, all of it.',
      'A customer database and an admin dashboard: sales, conversion rate, where buyers came from.',
      'The email system, with the sequence you are reading right now included.',
      'Deployment guides for five platforms, written for someone who has not done it before.',
      '30 days where you can email me directly and I will actually help you get it live.',
    ])}

    ${L.callout(
      `<strong>Upgrade price: ${escapeHtml(upgradePriceFormatted)}</strong><br>` +
      'You only pay the difference — what you already paid for The Method comes off.',
      { tone: 'accent' }
    )}

    ${L.button('See what is included', upgradeUrl)}

    ${L.paragraph(
      '<strong>And to be straight with you: you do not need this.</strong> Everything The Engine automates can ' +
      'be done by hand. Gumroad or Payhip will take payments and deliver a file for a cut of each sale, and for ' +
      'your first few sales that is genuinely the sensible choice. Start there if money is tight. This is for ' +
      'when you want to own the whole thing and stop paying a percentage forever.'
    )}

    ${L.paragraph(`Either way, reply if you want a second opinion on which makes sense for you — ${escapeHtml(supportEmail)}.`)}

    ${L.signoff()}
  `;

  return {
    subject: 'The part after the course is written',
    html: L.render({ title: 'The Engine', preheader: 'Sales page, checkout, delivery, dashboard — already built.', content, trackingPixelUrl, unsubscribeUrl }),
    text: L.toPlainText(content),
  };
}

/**
 * 7. TESTIMONIAL REQUEST — day 45, and only to engaged customers.
 *
 * This is how the testimonials table gets filled with real material. Note that
 * it asks for permission explicitly and separately from asking for the quote —
 * those are two different consents and conflating them is the mistake that
 * turns a nice email into an FTC problem.
 */
function testimonialRequest({ firstName, submitUrl, supportEmail, trackingPixelUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';

  const content = `
    ${L.heading('Would you tell me how it went?')}

    ${L.paragraph(greeting)}

    ${L.paragraph(
      'You bought this a while back. I would like to know what actually happened — good, bad or nothing at all. ' +
      'All three are useful and the last one is the most useful.'
    )}

    ${L.button('Tell me how it went', submitUrl)}

    ${L.paragraph('It takes two minutes. Three questions, none of them compulsory.')}

    ${L.callout(
      '<strong>On publishing:</strong> the form asks separately whether I may quote you publicly. If you say no, ' +
      'the feedback is still valuable and nothing goes anywhere. If you say yes, I will send you the exact ' +
      'wording and the name I would use, and it does not go live until you confirm it. If you mention numbers ' +
      'I will ask for a screenshot before I publish them — not because I doubt you, but because if I put a ' +
      'figure on a sales page I have to be able to stand behind it.'
    )}

    ${L.paragraph(`Or just reply to this email if that is easier — ${escapeHtml(supportEmail)}.`)}

    ${L.signoff()}
  `;

  return {
    subject: 'Two minutes: how did it go?',
    html: L.render({ title: 'Feedback', preheader: 'Three questions. Honest answers welcome.', content, trackingPixelUrl, unsubscribeUrl }),
    text: L.toPlainText(content),
  };
}

/** 8. DOWNLOAD RESEND — triggered by the customer, must arrive instantly. */
function downloadResend({ tierName, downloadUrl, expiresAt, supportEmail, trackingPixelUrl }) {
  const expiryText = new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const content = `
    ${L.heading('Here is your new download link')}

    ${L.paragraph(`A fresh link for ${escapeHtml(tierName)}, as requested:`)}

    ${L.button('Download your course vault', downloadUrl)}

    ${L.paragraph(`This one works until <strong>${escapeHtml(expiryText)}</strong>. Need another after that? Just ask again — there is no limit.`)}

    ${L.paragraph(`If the link does not work, reply to this email and I will sort it out: ${escapeHtml(supportEmail)}.`)}

    ${L.signoff()}
  `;

  return {
    subject: `${tierName} — your new download link`,
    html: L.render({ title: 'Download link', preheader: 'Fresh link inside.', content, trackingPixelUrl }),
    text: L.toPlainText(content),
  };
}

/** 9. SUPPORT ACKNOWLEDGEMENT — sets a reply expectation so nobody chases. */
function supportAcknowledgement({ reference, subject, kind, supportEmail }) {
  const isRefund = kind === 'refund';

  const content = `
    ${L.heading(isRefund ? 'Got your refund request' : 'Got your message')}

    ${L.paragraph(`Your reference is <strong>${escapeHtml(reference)}</strong> — quote it if you need to follow up.`)}

    ${L.callout(`<strong>What you sent:</strong><br>${escapeHtml(subject)}`)}

    ${isRefund
      ? L.paragraph(
          'Refunds are processed within one business day and I will not ask you to justify it. The money goes ' +
          'back to the card you paid with and takes 5–10 days to appear, which is your bank\'s timing, not mine. ' +
          'You will get a confirmation email the moment it is issued.'
        )
      : L.paragraph('I reply to everything within 24 hours, usually sooner. If it is urgent, reply to this email and say so.')
    }

    ${L.paragraph(`— ${escapeHtml(supportEmail)}`)}
  `;

  return {
    subject: `[${reference}] ${isRefund ? 'Refund request received' : 'We got your message'}`,
    html: L.render({ title: 'Support', preheader: `Reference ${reference}`, content }),
    text: L.toPlainText(content),
  };
}

/**
 * 10. REFUND CONFIRMATION.
 *
 * Deliberately gracious. A person you refunded well tells people you were fair;
 * a person you refunded grudgingly tells people you were difficult, and that
 * costs more than the refund did.
 */
function refundConfirmation({ amountFormatted, supportEmail }) {
  const content = `
    ${L.heading('Your refund is on its way')}

    ${L.paragraph(`<strong>${escapeHtml(amountFormatted)}</strong> has been refunded to the card you paid with.`)}

    ${L.paragraph('Banks take 5–10 business days to show it. That part is out of my hands, but it is on its way.')}

    ${L.paragraph(
      'No hard feelings at all — it clearly was not the right fit, and I would rather you had your money back ' +
      'than a file you are not using. Keep the vault if it is any use to you.'
    )}

    ${L.paragraph(
      'If there was something specific that did not work, I would genuinely like to know. One line is plenty, ' +
      'and it is how the thing gets better.'
    )}

    ${L.paragraph(`— ${escapeHtml(supportEmail)}`)}
  `;

  return {
    subject: 'Your refund has been processed',
    html: L.render({ title: 'Refund processed', preheader: 'Money is on its way back.', content }),
    text: L.toPlainText(content),
  };
}

/** 11. ADMIN ALERT — to you, not the customer. Plain and scannable on a phone. */
function adminAlert({ title, lines }) {
  const content = `
    ${L.heading(title)}
    ${L.bullets(lines.map((line) => escapeHtml(line)))}
  `;

  return {
    subject: `[Course Method] ${title}`,
    html: L.render({ title, preheader: title, content }),
    text: L.toPlainText(content),
  };
}

/** Registry used by the email service. */
const TEMPLATES = {
  delivery,
  welcome,
  orientation,
  week_one_check_in: weekOneCheckIn,
  customer_stories: customerStories,
  upsell,
  testimonial_request: testimonialRequest,
  download_resend: downloadResend,
  support_acknowledgement: supportAcknowledgement,
  refund_confirmation: refundConfirmation,
  admin_alert: adminAlert,
};

module.exports = { TEMPLATES, ...TEMPLATES };
