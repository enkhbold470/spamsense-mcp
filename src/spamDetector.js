// Heuristic spam/scam detector for call/message intent
// Pure JS, no external network or models required.

const POS_SIGNALS = [
  { pattern: /free\b|prize|win(?:ner)?\b|lottery|sweepstake/i, weight: 3, reason: "Prize/lottery bait" },
  { pattern: /gift\s*card|voucher/i, weight: 2.5, reason: "Gift card incentive" },
  { pattern: /act\s*now|urgent|immediately|limited\s*time/i, weight: 2, reason: "Urgency pressure" },
  { pattern: /verify\s+(?:your\s+)?(?:identity|account|details|information)/i, weight: 3, reason: "Verification lure" },
  { pattern: /bank\s+account|routing\s+number|sort\s+code|otp\b|one[-\s]?time\s*password/i, weight: 2.5, reason: "Sensitive data request" },
  { pattern: /warranty|extended\s+warranty|auto\s+warranty/i, weight: 3, reason: "Car warranty spam" },
  { pattern: /(irs|revenue\s+service|tax\s+office)\b/i, weight: 3, reason: "Government/tax scare" },
  { pattern: /(account|amazon|apple|microsoft).{0,20}(suspended|locked|unusual|suspicious)/i, weight: 3, reason: "Account suspension scare" },
  { pattern: /press\s*(?:1|one)\b|automated\s+message|robocall/i, weight: 2.5, reason: "Robocall prompt" },
  { pattern: /pre-?approved|guaranteed\s+loan|payday\s+loan/i, weight: 2.5, reason: "Loan bait" },
  { pattern: /student\s+loan\s+forgiveness|debt\s+relief/i, weight: 2.5, reason: "Debt relief bait" },
  { pattern: /(bitcoin|crypto(?:currency)?)\b/i, weight: 2, reason: "Crypto lure" },
  { pattern: /delivery\s+failed|final\s+attempt|customs\s+(?:fee|duty)/i, weight: 2, reason: "Fake delivery notice" },
  { pattern: /wire\s+transfer|western\s+union|moneygram/i, weight: 2.5, reason: "Wire transfer request" },
  { pattern: /gift\s*card|itunes\s*card|steam\s*card/i, weight: 3, reason: "Gift-card payment request" },
  { pattern: /confidential|do\s+not\s+share|secret/i, weight: 1.5, reason: "Secrecy pressure" },
];

const NEG_SIGNALS = [
  { pattern: /interview|schedule|meeting|calendar|agenda/i, weight: 2, reason: "Business scheduling" },
  { pattern: /doctor|clinic|dentist|appointment|pharmacy/i, weight: 2, reason: "Healthcare appointment" },
  { pattern: /delivery|courier|tracking\s+number|order\s+update/i, weight: 1.5, reason: "Logistics update" },
  { pattern: /invoice|receipt|purchase order|purchase-order|quote/i, weight: 1.5, reason: "Transactional docs" },
  { pattern: /recruit(er|ing)|candidate|offer\s+letter|hiring/i, weight: 1.5, reason: "Hiring/recruiting" },
  { pattern: /follow\s*up|as\s+discussed|per\s+our\s+call/i, weight: 1.2, reason: "Contextual follow-up" },
];

const INTENT_LABELS = [
  { label: "scam/spam", pattern: /(warranty|sweepstake|lottery|verify\s+account|account\s+suspended|press\s*1|gift\s*card|student\s+loan|debt\s+relief|irs|tax\s+office)/i },
  { label: "sales", pattern: /(offer|quote|plan|subscribe|discount|limited\s*time|save\s+\d+%)/i },
  { label: "support", pattern: /(support|help\s+desk|issue|ticket|troubleshoot|service\s+request)/i },
  { label: "delivery", pattern: /(delivery|courier|package|parcel|driver|drop\s*off|pickup)/i },
  { label: "recruiting", pattern: /(interview|resume|cv|opening|position|role|candidate)/i },
  { label: "collections", pattern: /(past\s+due|overdue|collections|balance\s+due|debt\s+collector)/i },
  { label: "personal", pattern: /(dinner|party|family|catch\s*up|birthday|see\s+you)/i },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function detectCallSpamIntent({ text, callerId, direction, locale } = {}) {
  const raw = typeof text === "string" ? text : "";
  const content = raw.trim();

  const matches = [];
  let pos = 0;
  let neg = 0;

  for (const sig of POS_SIGNALS) {
    if (sig.pattern.test(content)) {
      matches.push({ type: "positive", pattern: sig.pattern.source, weight: sig.weight, reason: sig.reason });
      pos += sig.weight;
    }
  }
  for (const sig of NEG_SIGNALS) {
    if (sig.pattern.test(content)) {
      matches.push({ type: "negative", pattern: sig.pattern.source, weight: sig.weight, reason: sig.reason });
      neg += sig.weight * 0.8; // slightly discounted negative weight
    }
  }

  // Structural signals
  const exclamations = (content.match(/!{2,}/g) || []).length;
  if (exclamations) {
    matches.push({ type: "positive", pattern: "!{2,}", weight: Math.min(1.5, 0.5 * exclamations), reason: "Excessive punctuation" });
    pos += Math.min(1.5, 0.5 * exclamations);
  }

  const linkCount = (content.match(/https?:\/\//gi) || []).length;
  if (linkCount) {
    matches.push({ type: "positive", pattern: "https?://", weight: Math.min(1.5, 0.7 * linkCount), reason: "Contains external link(s)" });
    pos += Math.min(1.5, 0.7 * linkCount);
  }

  // Caller ID heuristics
  if (callerId) {
    const cid = String(callerId).toLowerCase();
    if (/unknown|private|blocked|no\s*caller\s*id/.test(cid)) {
      matches.push({ type: "positive", pattern: "blocked/unknown callerId", weight: 1.2, reason: "Hidden caller ID" });
      pos += 1.2;
    }
  }

  // Compute score and label
  const rawScore = pos - neg;
  // 6.0 is around 2-3 strong signals; normalize to [0,1]
  const score = clamp(rawScore / 6.0, 0, 1);
  const confidence = clamp(0.3 + score * 0.7, 0, 1);

  let label = "not_spam";
  let isSpam = false;
  if (score >= 0.6) {
    label = "spam";
    isSpam = true;
  } else if (score >= 0.4) {
    label = "likely_spam";
  }

  // Determine coarse intent
  let intent = "unknown";
  for (const item of INTENT_LABELS) {
    if (item.pattern.test(content)) {
      intent = item.label;
      break;
    }
  }
  if (isSpam) intent = "scam/spam";

  // Reasons summary
  const reasons = matches
    .filter((m) => (isSpam ? m.type === "positive" : true))
    .slice(0, 6)
    .map((m) => m.reason)
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    isSpam,
    label,
    confidence: Number(confidence.toFixed(2)),
    intent,
    score: Number(score.toFixed(2)),
    reasons,
    matches,
    meta: {
      direction: direction || null,
      callerId: callerId || null,
      locale: locale || null,
      length: content.length,
    },
  };
}
