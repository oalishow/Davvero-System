import type { Member } from "../types";

/**
 * Determines the official document title on the ID card according to the member's profile/roles:
 * - Professor / Docente -> "DOCUMENTO UNIVERSITÁRIO"
 * - Profissionais da educação, funcionários e colaboradores -> "DOCUMENTO DO PROFISSIONAL DA EDUCAÇÃO"
 * - Alunos sem ser seminarista -> "DOCUMENTO ESTUDANTIL"
 * - Seminaristas com vínculo vocacional -> "DOCUMENTO ESTUDANTIL E VOCACIONAL"
 */
export function getCardDocumentTitle(member?: Partial<Member> | null, customFrontText?: string): string {
  if (!member) return customFrontText || "DOCUMENTO ESTUDANTIL";

  const roles = (member.roles || []).map((r) => (r || "").trim().toUpperCase());
  const course = (member.course || "").trim().toUpperCase();

  // 1. Professor (Docente) -> DOCUMENTO UNIVERSITÁRIO
  const isProfessor = roles.some(
    (r) => r.includes("PROFESSOR") || r.includes("DOCENTE") || r.includes("PROF.")
  ) || course.includes("PROFESSOR") || course.includes("DOCENTE");
  if (isProfessor) {
    return "DOCUMENTO UNIVERSITÁRIO";
  }

  // 2. Seminarista -> DOCUMENTO ESTUDANTIL E VOCACIONAL
  const semStr = (member.seminary || "").toUpperCase();
  const hasSeminaryBond = Boolean(member.seminary) && !semStr.includes("SEM VÍNCULO") && !semStr.includes("SEM VINCULO") && semStr.trim() !== "";
  const isSeminarista = roles.some((r) => r.includes("SEMINARISTA")) || hasSeminaryBond;

  // 3. Profissional da Educação, Funcionários e Colaboradores -> DOCUMENTO DO PROFISSIONAL DA EDUCAÇÃO
  const isFuncionarioOrColaborador = roles.some(
    (r) =>
      r.includes("PROFISSIONAL") ||
      r.includes("EDUCAÇÃO") ||
      r.includes("EDUCACAO") ||
      r.includes("COLABORADOR") ||
      r.includes("FUNCIONÁRI") ||
      r.includes("FUNCIONARI") ||
      r.includes("SECRETÁRI") ||
      r.includes("SECRETARI") ||
      r.includes("COORDENAD") ||
      r.includes("DIRETO") ||
      r.includes("ADMIN") ||
      r.includes("PSICÓLOG") ||
      r.includes("PSICOLOG") ||
      r.includes("EQUIPE")
  ) || course.includes("ADMINISTRAÇÃO") || course.includes("SECRETARIA");

  if (isFuncionarioOrColaborador && !isSeminarista) {
    return "DOCUMENTO DO PROFISSIONAL DA EDUCAÇÃO";
  }

  if (isSeminarista) {
    return "DOCUMENTO ESTUDANTIL E VOCACIONAL";
  }

  // 4. Alunos sem ser seminarista -> DOCUMENTO ESTUDANTIL
  return "DOCUMENTO ESTUDANTIL";
}

/**
 * Returns the institutional back description matching the member's document category.
 */
export function getCardDocumentDescription(member?: Partial<Member> | null, customDescription?: string): string {
  if (customDescription && customDescription.trim()) {
    return customDescription;
  }

  if (!member) {
    return "Documento de identificação estudantil padronizado nos termos da legislação vigente para comprovação de vínculo acadêmico.";
  }

  const roles = (member.roles || []).map((r) => (r || "").trim().toUpperCase());

  if (roles.some((r) => r.includes("PROFESSOR") || r.includes("DOCENTE"))) {
    return "Documento de identificação universitária docente oficial da Faculdade João Paulo II, comprovando o vínculo acadêmico e funcional com a instituição para todos os fins de direito.";
  }

  const semStr = (member.seminary || "").toUpperCase();
  const hasSeminaryBond = Boolean(member.seminary) && !semStr.includes("SEM VÍNCULO") && !semStr.includes("SEM VINCULO") && semStr.trim() !== "";
  const isSeminarista = roles.some((r) => r.includes("SEMINARISTA")) || hasSeminaryBond;

  if (
    roles.some(
      (r) =>
        r.includes("COLABORADOR") ||
        r.includes("FUNCIONÁRI") ||
        r.includes("FUNCIONARI") ||
        r.includes("SECRETÁRI") ||
        r.includes("SECRETARI") ||
        r.includes("COORDENAD") ||
        r.includes("DIRETO") ||
        r.includes("ADMIN") ||
        r.includes("EDUCAÇÃO") ||
        r.includes("EDUCACAO") ||
        r.includes("PROFISSIONAL")
    ) &&
    !isSeminarista
  ) {
    return "Documento de identificação do profissional da educação oficial da Faculdade João Paulo II, comprovando vínculo institucional, funcional e profissional.";
  }

  if (isSeminarista) {
    return "Documento de identificação estudantil e vocacional da Faculdade João Paulo II e Seminário Provincial Sagrado Coração de Jesus, comprovando formação acadêmica e vínculo vocacional.";
  }

  return "Documento de identificação estudantil é padronizado e apresenta os dados requeridos pela Lei 12.933/2013 para comprovação de matrícula, sendo sua aceitação sujeita aos critérios dos organizadores de eventos.";
}
