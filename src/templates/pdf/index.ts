export type LogoSet = {
  tenant: string | null;
  client: string | null;
  dgert: string | null;
};

export type ActionPDFData = {
  action: any;        // TrainingAction com course, sessions, enrollments, trainers, room, clientOrg
  tenant: any;        // Tenant
  trainees: any[];    // Trainees inscritos com signatures e checkIns
  logos: LogoSet;
};

export type CertificatePDFData = {
  trainee: any;
  course: any;
  action: any;
  certificate: any;
  tenant: any;
  logos: LogoSet;
};
