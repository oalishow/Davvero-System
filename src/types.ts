export const AVAILABLE_SEMINARIES = [
  "SPSCJ - Seminário Provincial Sagrado Coração de Jesus",
  "Seminário Rainha dos Apóstolos",
  "Seminário Diocesano São José",
  "Religiosos",
  "Sem Vínculo de Seminário"
];

export interface Member {
  id: string;
  name: string;
  ra?: string;
  cpf?: string;
  birthdate?: string;
  email?: string;
  validityDate?: string;
  alphaCode?: string;
  photoUrl?: string | null;
  roles?: string[];
  course?: string;
  seminary?: string;
  diocese?: string;
  isActive?: boolean;
  isApproved?: boolean;
  status?: "VALID" | "PENDING" | "REVOKED";
  createdAt?: string;
  deletedAt?: string | null;
  legacyId?: string;
  legacyQrCode?: string;
  pendingChanges?: any;
  hasPendingAction?: boolean;
  deletionRequested?: boolean;
  deletionRequestedAt?: string;
  acceptedTermsVersion?: number;
  externalCertificates?: {
    id: string;
    title: string;
    fileUrl: string;
    uploadedAt: string;
  }[];
}

export interface CertificateTemplate {
  bodyText: string;
  fontFamily: string;
  bgStyle: string;
  signatureName: string;
  signatureRole: string;
  signature2Name?: string;
  signature2Role?: string;
  isApproved: boolean;
  backgroundImageUrl?: string;
  showFajopaDirectorSignature?: boolean;
  showSeminarRectorSignature?: boolean;
  fajopaDirectorName?: string;
  seminarRectorName?: string;
  fajopaDirectorSignatureUrl?: string;
  seminarRectorSignatureUrl?: string;
  hasCustomBg?: boolean;
  hasFajopaSignature?: boolean;
  hasRectorSignature?: boolean;
}

export interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  format: "online" | "presencial" | "hibrido";
  location?: string;
  link?: string;
  locationOrLink?: string; // KEEP THIS FOR OLD DATA
  description: string;
  hours?: string | number;
  maxParticipants: number;
  status: string;
  imageUrl?: string;
  certificateTemplate?: CertificateTemplate;
  organizationCertificateTemplate?: CertificateTemplate;
  organizationHours?: string | number;
  registrationDeadline?: string;
  isRegistrationPaused?: boolean;
  deletedAt?: string;
  speaker?: string;
  schedulePdfUrl?: string;
  isSeminary?: boolean; // NEW: Indicates if it's a seminary event
  seminaryId?: string; // SPSCJ, Marília, Bauru, or ALL
  isPaid?: boolean; // Pagamento: true se for evento pago
  price?: number;   // Pagamento: valor do evento
  googleFormsLink?: string; // Link externo para Forms
  hotmartLink?: string;     // Link externo para Hotmart
  isPinned?: boolean; // Se o evento está fixado
  presenceConfig?: {
    enabled: boolean;
    openMode: "default_30min" | "custom";
    customOpenTime?: string; 
    closeMode: "24h_after" | "1h_after" | "custom" | "manual";
    customCloseTime?: string;
  };
}

export interface Attendance {
  id: string;
  eventId: string;
  studentId: string;
  status: "inscrito" | "presente" | "apto_para_certificado" | "cancelado";
  checkInDates?: string[]; // Array of YYYY-MM-DD
  isOrganizer?: boolean;
  timestamp: string;
  member?: Member;
  paymentStatus?: "pendente" | "pago" | "isento";
  transactionId?: string;
  paymentMethod?: "mercadopago" | "paypal" | "pix_manual";
}

export interface Notification {
  id: string;
  recipientId: string; // The specific memberId or "admin"
  title: string;
  message: string;
  type: "carteirinha" | "inscricao" | "certificado" | "edicao" | "visitante" | "backup" | "sistema" | "evento";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export type AvailabilityStatus = "LIVRE" | "OCUPADO" | "CANCELADO";

export interface Availability {
  id: string;
  professionalId: string;
  professionalName: string;
  date: string;       // Formato YYYY-MM-DD
  startTime: string;  // Formato HH:mm
  endTime: string;    // Formato HH:mm
  status: AvailabilityStatus;
  location?: string;
  seminary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  availabilityId: string; // Referência à Availability
  memberId: string;       // Referência ao Member (Seminarian)
  studentName?: string;   // Desnormalizado para agendamentos Whatsapp sem vínculo
  professionalId: string; // Desnormalizado para facilitar queries
  date: string;           // Desnormalizado
  startTime: string;      // Desnormalizado
  endTime?: string;       // Desnormalizado
  location?: string;      // Desnormalizado
  status: "CONFIRMADO" | "CANCELADO";
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MuralPost {
  id: string;
  tabFn: "academico" | "seminario"; // Which tab it belongs to
  authorId?: string; // If known (memberId)
  authorName: string; // The selected or provided name
  authorPhotoUrl?: string;
  text: string;
  type: "message" | "poll";
  mediaUrl?: string; // For images/PDFs
  mediaType?: "image" | "pdf" | "link" | "video" | "document";
  pollOptions?: { id: string; text: string; votes: number }[];
  isAnonymousPoll?: boolean; // Se a enquete é anônima (padrão)
  voterDetails?: { userId: string; userName: string; optionId: string }[]; // Para enquetes públicas
  votedUserIds?: string[]; // IDs of users who voted
  createdAt: any;
  isPinned: boolean;
  orderIndex?: number; // For manual reordering
  expiresAt?: any; // Auto delete timestamp
  status: "pending" | "approved"; // Non-admin posts are pending by default
  isAdminPost?: boolean;
  likes?: string[]; // Array of member IDs who liked
  commentsCount?: number;
}

export interface MuralComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: any;
}
