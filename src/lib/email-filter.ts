/**
 * Email Filter — filters out non-individual email addresses.
 *
 * Used during Build PRM (contact import) and Gmail sync to exclude
 * clearly automated, marketing, and system email addresses.
 *
 * IMPORTANT: This filter is intentionally conservative (minimal false positives).
 * It only blocks addresses that are OBVIOUSLY not real people.
 * Borderline cases are left for the AI classifier to decide with full context.
 */

/**
 * Clearly non-human local parts (before the @).
 * Only includes prefixes that are NEVER a real person's email.
 */
const BLOCKED_PREFIXES = [
  // Automated / system — never a real person
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "bounce", "bounces",
  "daemon", "cron", "scheduler",
  // Notification systems — never a person
  "notifications", "notification",
  "newsletter", "newsletters",
  // Transactional — never a person
  "unsubscribe",
  "receipts", "receipt",
];

/** Bulk email / transactional service domains — emails FROM these domains are never individuals */
const BLOCKED_DOMAINS = [
  // Email delivery services
  "sendgrid.net", "sendgrid.com",
  "mailchimp.com", "mandrillapp.com",
  "constantcontact.com",
  "mailgun.org", "mailgun.com",
  "amazonses.com",
  "postmarkapp.com",
  "sparkpostmail.com",
  "sendinblue.com", "brevo.com",
  "mailjet.com",
  "convertkit.com",
  "drip.com",
  "klaviyo.com",
  "activecampaign.com",
  "campaignmonitor.com",
  "e.customerio.com",
  // Social media notification domains
  "facebookmail.com",
  "twittermail.com",
  "redditmail.com",
  // Platform notification domains (not the main domain — e.g. github.com is blocked
  // but someone@company.com who works at GitHub should NOT be blocked)
  "slack-notifications.com",
  "intercom-mail.com",
  "zendeskmail.com",
  "hubspotmail.com",
  // Transactional commerce
  "groupon.com",
  "retailmenot.com",
  // Discourse / forums
  "discourse.org",
  "googlegroups.com",
];

/** Subdomain prefixes used by transactional / promotional email systems */
const TRANSACTIONAL_SUBDOMAINS = [
  "bounce.", "mailer.",
  "noreply.", "no-reply.", "auto.",
  "notifications.", "updates.",
  "promo.", "marketing.", "newsletter.",
];

/** Gmail label IDs that indicate non-individual emails */
const BLOCKED_GMAIL_LABELS = [
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
];

/**
 * Checks if an email address is OBVIOUSLY from an automated, system, or
 * bulk-mail source rather than an individual person.
 *
 * This filter is intentionally conservative — it only catches clear-cut cases.
 * Ambiguous cases (info@, team@, hello@, support@) are NOT blocked here
 * because they could be a real person at a small company. The AI classifier
 * handles those with full name + email context.
 */
export function isNonIndividualEmail(
  email: string,
  gmailLabelIds?: string[]
): boolean {
  /* Check Gmail category labels first (most reliable signal) */
  if (gmailLabelIds?.some((label) => BLOCKED_GMAIL_LABELS.includes(label))) {
    return true;
  }

  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;

  if (BLOCKED_PREFIXES.includes(local)) return true;
  if (BLOCKED_DOMAINS.includes(domain)) return true;
  if (TRANSACTIONAL_SUBDOMAINS.some((prefix) => domain.startsWith(prefix))) return true;

  return false;
}
