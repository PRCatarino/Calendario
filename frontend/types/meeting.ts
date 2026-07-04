export interface Meeting {
  id: string;
  clientId?: number;
  clientName: string;
  title: string;
  start: Date;
  end: Date;
  notes: string;
  /** round avatar = client logo/profile photo */
  imageUrl: string;
  /** banner/content = meeting cover thumbnail (Drive image / video frame) */
  coverThumbUrl?: string;
  /** Drive cover URL (capa da reunião): thumbnail (image) or preview (video) */
  coverUrl?: string;
  coverType: 'image' | 'video';
  /** true once a frame is stored as the cover (e.g. captured mid-video frame) */
  hasFrame: boolean;
  status: MeetingStatus;
  rejectReason?: string;
  /** soft palette key — maps to a background/border style in lib/colors */
  color: MeetingColor;
}

export type MeetingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MeetingColor =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'indigo'
  | 'teal';

export type CalendarView = 'month' | 'week';

/** payload coming out of the NewMeetingModal form */
export interface NewMeetingInput {
  /** pick an existing client… */
  clientId?: number;
  /** …or create one inline */
  newClient?: { name: string; username: string; password: string };
  title: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  notes: string;
  /** Drive cover URL (capa) — type is auto-detected server-side */
  coverUrl?: string;
}
