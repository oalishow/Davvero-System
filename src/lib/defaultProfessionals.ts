import { Member } from "../types";

export const DEFAULT_PROFESSIONALS: Member[] = [
  { id: "prof_altair", name: "Padre Altair", email: "altair@fajopa.com", roles: ["REITOR"], isActive: true, createdAt: new Date().toISOString() },
  { id: "prof_anderson", name: "Padre Anderson", email: "anderson@fajopa.com", roles: ["VICE-REITOR"], isActive: true, createdAt: new Date().toISOString() },
  { id: "prof_braz", name: "Padre Bráz", email: "braz@fajopa.com", roles: ["DIRETOR ESPIRITUAL"], isActive: true, createdAt: new Date().toISOString() },
  { id: "prof_alessandra", name: "Dra. Alessandra", email: "alessandra@fajopa.com", roles: ["PSICÓLOGA"], isActive: true, createdAt: new Date().toISOString() }
];
