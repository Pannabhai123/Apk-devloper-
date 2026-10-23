export type ProjectStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface PageIssue { page: number; reason?: string; message?: string }
export interface Project {
  id: string;
  title: string;
  original_filename: string;
  status: ProjectStatus;
  progress: number;
  total_pages: number;
  processed_pages: number;
  readable_pages: number;
  unreadable_pages: PageIssue[];
  warnings: PageIssue[];
  error: string | null;
  extraction_method: string;
  question_count: number;
  pptx_count: number;
  created_at: string;
  updated_at: string;
  generation_settings?: Partial<GenerateSettings>;
}

export interface QuestionOption { label: 'A' | 'B' | 'C' | 'D'; text: string }
export interface Question {
  id: string;
  project_id: string;
  position: number;
  number: string;
  text: string;
  options: QuestionOption[];
  correct_answer: string | null;
  explanation: string | null;
  answer_source: 'pdf' | 'ai' | 'manual' | 'none';
  answer_confidence: 'certain' | 'uncertain' | 'none';
  flags: string[];
  page_number: number;
  extraction_method: string;
}

export type PresentationMode = 'A' | 'B' | 'C' | 'D';
export interface GenerateSettings {
  mode: PresentationMode;
  question_color: string;
  option_color: string;
  highlight_color: string;
  background_color: string;
  font_family: string;
  question_font_size: number;
  option_font_size: number;
  show_question_numbers: boolean;
  custom_answer_slide: boolean;
  custom_include_explanation: boolean;
  custom_show_options_on_answer: boolean;
}

export interface ExportRecord {
  id: string;
  project_id: string;
  project_title?: string;
  original_filename?: string;
  kind: 'pptx' | 'pdf';
  mode: PresentationMode;
  slide_count: number;
  created_at: string;
}

export interface Capabilities {
  pdf_text: boolean;
  pptx: boolean;
  pdf_export: boolean;
  ocr: { available: boolean; version: string | null; languages: string[]; hindi: boolean; english: boolean };
  ai_configured: boolean;
  ai_extraction_enabled: boolean;
  ai_model: string | null;
}

export interface AppSettings {
  teacher_name: string;
  institute_name: string;
  address: string;
  default_mode: PresentationMode;
  auto_ocr: boolean;
  default_font: string;
}

export interface DashboardData {
  stats: { projects: number; questions: number; presentations: number; pages_processed: number };
  recent_projects: Project[];
  recent_exports: ExportRecord[];
}
