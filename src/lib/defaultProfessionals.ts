import { Member } from "../types";

export const DEFAULT_PROFESSIONALS: Member[] = [
  { 
    id: "prof_altair", 
    name: "Padre Altair", 
    email: "altair@fajopa.com", 
    roles: ["REITOR"], 
    seminary: "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
    isActive: true, 
    createdAt: new Date().toISOString() 
  },
  { 
    id: "prof_anderson", 
    name: "Padre Anderson", 
    email: "anderson@fajopa.com", 
    roles: ["VICE-REITOR"], 
    seminary: "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
    isActive: true, 
    createdAt: new Date().toISOString() 
  },
  { 
    id: "prof_alan", 
    name: "Padre Alan", 
    email: "alan@fajopa.com", 
    roles: ["DIRETOR ESPIRITUAL"], 
    seminary: "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
    isActive: true, 
    createdAt: new Date().toISOString() 
  },
  { 
    id: "prof_alessandra", 
    name: "Dra. Alessandra", 
    email: "alessandra@fajopa.com", 
    roles: ["PSICÓLOGA"], 
    seminary: "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
    isActive: true, 
    createdAt: new Date().toISOString() 
  }
];
