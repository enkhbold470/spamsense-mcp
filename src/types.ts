export interface CheckPhoneArgs {
  number: string;
}

export interface NormalizedNumberMeta {
  raw: string;
  digits: string;
  country_code: string | null;
  national_number: string | null;
  e164: string | null;
  valid: boolean;
}

export interface PhoneSpamAnalysis {
  input: string;
  normalized: {
    digits: string;
    e164: string | null;
    country_code: string | null;
    national_number: string | null;
    area_code: string | null;
    exchange: string | null;
  };
  signals: Record<string, boolean> & { blacklisted: boolean };
  spam_score: number;
  risk_level: 'low' | 'medium' | 'high';
}

