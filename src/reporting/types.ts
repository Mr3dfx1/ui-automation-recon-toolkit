export type ReconElementType = "button" | "link" | "input" | "select" | "textarea" | "other";

export type ReconElement = {
  type: ReconElementType;
  tagName: string;

  // identity / automation signals
  role?: string;
  accessibleName?: string;
  labelText?: string;
  testId?: string;

  // attributes
  text?: string;
  id?: string;
  name?: string;
  href?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  ariaDisabled?: boolean;

  // selector hints
  css?: string;
  xpath?: string;
};

export type ReconReport = {
  url: string;
  scannedAt: string; // ISO date
  counts: Record<ReconElementType, number>;
  elements: ReconElement[];
};
