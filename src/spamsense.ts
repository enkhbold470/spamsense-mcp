// Internal spam analysis helpers (no external API calls)
import { NormalizedNumberMeta, PhoneSpamAnalysis } from './types.js';

function normalizeNumber(raw: string): NormalizedNumberMeta {
  const digits = (raw || '').replace(/\D+/g, '');
  let country_code: string | null = null;
  let national_number: string | null = null;
  let e164: string | null = null;
  let valid = false;

  if (digits.length === 11 && digits.startsWith('1')) {
    country_code = '+1';
    national_number = digits.slice(1);
    valid = true;
  } else if (digits.length === 10) {
    country_code = '+1';
    national_number = digits;
    valid = true;
  } else {
    national_number = digits;
  }

  if (country_code && national_number) {
    e164 = `${country_code}${national_number}`;
  }

  return { raw, digits, country_code, national_number, e164, valid };
}

function hasRepeatedDigits(digits: string, n = 6): boolean {
  const re = new RegExp(`(\\d)\\1{${n - 1},}`);
  return re.test(digits);
}

function hasSequence(digits: string, run = 4): boolean {
  for (let i = 0; i <= digits.length - run; i++) {
    const window = digits.slice(i, i + run);
    // Increasing e.g., 0123, 1234
    const inc = Array.from({ length: window.length - 1 }, (_, j) =>
      Number(window[j + 1]) - Number(window[j])
    ).every((d) => d === 1);
    if (inc) return true;
    // Decreasing e.g., 9876
    const dec = Array.from({ length: window.length - 1 }, (_, j) =>
      Number(window[j]) - Number(window[j + 1])
    ).every((d) => d === 1);
    if (dec) return true;
  }
  return false;
}

export function analyzePhone(number: string): PhoneSpamAnalysis {
  const meta = normalizeNumber(number);
  const digits = meta.digits;

  let area: string | null = null;
  let exchange: string | null = null;
  if (meta.national_number && meta.national_number.length === 10) {
    area = meta.national_number.slice(0, 3);
    exchange = meta.national_number.slice(3, 6);
  }

  const suspicious_area_codes = new Set([
    '809', '876', '284', '473', '649', '664', '721', '758', '784', '868', '869', '441',
  ]);
  const toll_free_area_codes = new Set(['800', '833', '844', '855', '866', '877', '888']);

  const signals = {
    invalid_length: !meta.valid,
    repeated_digits: hasRepeatedDigits(digits),
    sequential_pattern: hasSequence(digits),
    contains_0000: digits.includes('0000'),
    contains_555: digits.includes('555'),
    suspicious_area_code: area ? suspicious_area_codes.has(area) : false,
    toll_free: area ? toll_free_area_codes.has(area) : false,
  } as const;

  // Hard-coded blacklist of known-abusive numbers (digits-only)
  // Extend this list as needed for your deployment.
  const blacklist = new Set<string>([
    // Example NANP spam/callback scams (normalized as digits)
    '18095551234',
    '18095550000',
    '18765551234',
    '12845551234',
    '16495551234',
    '17215551234',
    '17585551234',
    '17845551234',
    '18685551234',
    '18695551234',
    '14415551234',
  ]);
  const is_blacklisted = blacklist.has(digits);

  let score = 0;
  if (is_blacklisted) score = Math.max(score, 100);
  if (signals.invalid_length) score = Math.max(score, 80);
  if (signals.suspicious_area_code) score = Math.max(score, 60);
  if (signals.repeated_digits) score = Math.max(score, 40);
  if (signals.sequential_pattern) score = Math.max(score, 30);
  if (signals.contains_0000 || signals.contains_555) score = Math.max(score, 25);
  if (signals.toll_free) score = Math.max(score, 10);

  const level: 'low' | 'medium' | 'high' = score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low';

  return {
    input: number,
    normalized: {
      digits,
      e164: meta.e164,
      country_code: meta.country_code,
      national_number: meta.national_number,
      area_code: area,
      exchange,
    },
    signals: { ...signals, blacklisted: is_blacklisted },
    spam_score: score,
    risk_level: level,
  };
}
