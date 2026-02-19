import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  timeout: 10000,
});

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'patient';
export type CaseStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface AuthUser {
  id: number;
  name: string;
  role: UserRole;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'textarea' | 'computed';
  required?: boolean;
  readOnly?: boolean;
  options?: Array<string | number | { label: string; value: string | number }>;
}

export interface ComputedFieldMatrixRule {
  target: string;
  dependencies: string[];
  type: 'matrix';
  matrix: Record<string, string>;
}

export interface FormSchema {
  title?: string;
  fields: FormField[];
  computedFields?: ComputedFieldMatrixRule[];
}

export interface FormTemplate {
  id: number;
  title: string;
  schema_json: FormSchema;
}

export interface WorkflowStep {
  step: number;
  label?: string;
  form_id: number;
  role_required: UserRole;
}

export interface WorkflowDefinition {
  id: number;
  title: string;
  steps_json: WorkflowStep[];
}

export interface MedicalCase {
  id: number;
  current_step: number;
  status: CaseStatus;
  data_jsonb: Record<string, unknown>;
  patient: AuthUser;
  workflow: WorkflowDefinition;
  current_step_meta?: WorkflowStep;
}

export interface CreateWorkflowPayload {
  title: string;
  steps_json: WorkflowStep[];
}

export interface CreateFormTemplatePayload {
  title: string;
  schema_json: FormSchema;
}

export const login = async (name: string): Promise<AuthUser> => {
  const response = await apiClient.post<AuthUser>('/api/login', { name });
  return response.data;
};

export const getUsers = async (): Promise<AuthUser[]> => {
  const response = await apiClient.get<AuthUser[]>('/api/users');
  return response.data;
};

export const getFormTemplates = async (): Promise<FormTemplate[]> => {
  const response = await apiClient.get<FormTemplate[]>('/api/form-templates');
  return response.data;
};

export const getFormTemplate = async (formId: number): Promise<FormTemplate> => {
  const response = await apiClient.get<FormTemplate>(`/api/form-templates/${formId}`);
  return response.data;
};

export const createFormTemplate = async (payload: CreateFormTemplatePayload): Promise<FormTemplate> => {
  const response = await apiClient.post<FormTemplate>('/api/form-templates', payload);
  return response.data;
};

export const getWorkflows = async (): Promise<WorkflowDefinition[]> => {
  const response = await apiClient.get<WorkflowDefinition[]>('/api/workflows');
  return response.data;
};

export const createWorkflow = async (payload: CreateWorkflowPayload): Promise<WorkflowDefinition> => {
  const response = await apiClient.post<WorkflowDefinition>('/api/workflows', payload);
  return response.data;
};

export const getCases = async (role?: UserRole): Promise<MedicalCase[]> => {
  const response = await apiClient.get<MedicalCase[]>('/api/cases', {
    params: role ? { role } : {},
  });
  return response.data;
};

export const getCase = async (caseId: number): Promise<MedicalCase> => {
  const response = await apiClient.get<MedicalCase>(`/api/cases/${caseId}`);
  return response.data;
};

export const submitCaseStep = async (caseId: number, step_data: Record<string, unknown>): Promise<MedicalCase> => {
  const response = await apiClient.post<MedicalCase>(`/api/cases/${caseId}/submit-step`, { step_data });
  return response.data;
};

export interface Biopsy {
  id: number;
  image_url: string;
  status: string;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  folder_id: string;
  biopsies: Biopsy[];
}

export const getPatients = async (): Promise<Patient[]> => {
  try {
    const response = await apiClient.get<Patient[]>('/patients');
    return response.data;
  } catch {
    return [];
  }
};

export interface AIResult {
  cancer_detected: boolean;
  confidence: number;
  cells_count: number;
  regions_found: number;
}

export const analyzeBiopsy = async (id: number): Promise<AIResult | null> => {
  void id;
  return null;
};

export default apiClient;
