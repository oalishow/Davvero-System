export interface AutoApproveCandidate {
  name?: string;
  cpf?: string;
  ra?: string;
  email?: string;
  alphaCode?: string;
}

export interface AutoApproveSettings {
  autoApproveEnabled?: boolean;
  autoApproveWhitelist?: string[];
  autoApproveWhitelistText?: string;
}

function normalizeStr(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Checks if a registration candidate qualifies for automatic approval.
 * Evaluates both the global autoApprove switch and the whitelist (Names, CPFs, RAs, Emails).
 */
export function checkAutoApproval(
  candidate: AutoApproveCandidate,
  settings?: AutoApproveSettings
): boolean {
  if (!settings) return false;

  // 1. If global automatic approval is enabled
  if (settings.autoApproveEnabled === true) {
    return true;
  }

  // 2. Check Whitelist
  const list = settings.autoApproveWhitelist || [];
  const textItems = settings.autoApproveWhitelistText
    ? settings.autoApproveWhitelistText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const allEntries = Array.from(new Set([...list, ...textItems]))
    .map((e) => e.trim())
    .filter(Boolean);

  if (allEntries.length === 0) return false;

  const cleanCandCpf = (candidate.cpf || "").replace(/\D/g, "");
  const cleanCandName = normalizeStr(candidate.name || "");
  const cleanCandRa = normalizeStr(candidate.ra || "");
  const cleanCandEmail = (candidate.email || "").trim().toLowerCase();
  const cleanCandAlpha = (candidate.alphaCode || "").trim().toLowerCase();

  for (const rawEntry of allEntries) {
    const cleanEntry = normalizeStr(rawEntry);
    const entryDigits = rawEntry.replace(/\D/g, "");

    // Check CPF match (numeric comparison if entry has digits)
    if (cleanCandCpf && entryDigits && cleanCandCpf.length >= 7 && (cleanCandCpf === entryDigits || entryDigits.includes(cleanCandCpf))) {
      return true;
    }

    // Check RA match
    if (cleanCandRa && cleanEntry && cleanCandRa === cleanEntry) {
      return true;
    }

    // Check Email match
    if (cleanCandEmail && rawEntry.includes("@") && cleanCandEmail === rawEntry.trim().toLowerCase()) {
      return true;
    }

    // Check AlphaCode match
    if (cleanCandAlpha && rawEntry.length === 6 && cleanCandAlpha === rawEntry.trim().toLowerCase()) {
      return true;
    }

    // Check Name match (exact or substring matching for multi-word names)
    if (cleanCandName && cleanEntry.length >= 3) {
      if (
        cleanCandName === cleanEntry ||
        cleanCandName.includes(cleanEntry) ||
        cleanEntry.includes(cleanCandName)
      ) {
        return true;
      }
    }
  }

  return false;
}
