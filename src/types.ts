export interface CheckItem {
  label: string;
  pass: boolean;
  warn?: boolean;
}

export interface DimensionResult {
  percentage: number;
  score: number;
  max: number;
  passed: number;
  total: number;
  checks: number;
  items: CheckItem[];
}

export interface NegativeSignal {
  label: string;
  found: boolean;
  detail?: string;
}

export interface SeoSupplement {
  https: boolean;
  hasTitle: boolean;
  hasMetaDesc: boolean;
  responsive: boolean;
}

export interface Recommendation {
  issue: string;
  fix: string;
  dimension: string;
  priority: "high" | "medium" | "low";
}

export interface AuditResult {
  url: string;
  score: number;
  level: "Excellent" | "Good" | "Basic" | "Critical";
  timestamp: string;
  summary: string;
  dimensions: Record<string, DimensionResult>;
  negativeSignals: NegativeSignal[];
  seoSupplement: SeoSupplement;
  recommendations: Recommendation[];
  raw: Record<string, unknown>;
}

export type ExportFormat = "md" | "json" | "csv";

export interface HistoryEntry {
  url: string;
  score: number;
  level: string;
  timestamp: string;
}
