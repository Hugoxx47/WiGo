import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SmartForm from '../components/SmartForm';
import {
  getCases,
  getFormTemplate,
  submitCaseStep,
  type AuthUser,
  type FormSchema,
  type MedicalCase,
  type UserRole,
} from '../services/api';

const USER_STORAGE_KEY = 'biopsie_user';

const parseCurrentUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.name && parsed.role) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

export default function UserTaskList() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => parseCurrentUser());
  const [medicalCases, setMedicalCases] = useState<MedicalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<MedicalCase | null>(null);
  const [activeSchema, setActiveSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userRole: UserRole | undefined = currentUser?.role;

  const loadCases = useCallback(async () => {
    if (!userRole) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getCases(userRole);
      const strictlyFiltered = data.filter((item) => {
        const requiredRole = item.current_step_meta?.role_required;
        return requiredRole === userRole;
      });

      setMedicalCases(strictlyFiltered);
    } catch {
      setErrorMessage('Impossible de charger les tâches.');
    } finally {
      setIsLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    void loadCases();
  }, [currentUser, loadCases, navigate]);

  const openCurrentStepForm = async (item: MedicalCase) => {
    const formId = item.current_step_meta?.form_id;
    if (!formId) {
      setErrorMessage('Aucun formulaire associé à cette étape.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const template = await getFormTemplate(formId);
      const stepDataKey = `step_${item.current_step}`;
      const initialStepData = (item.data_jsonb[stepDataKey] as Record<string, unknown> | undefined) ?? {};

      setSelectedCase(item);
      setActiveSchema(template.schema_json);

      if (!Object.keys(initialStepData).length) {
        return;
      }
    } catch {
      setErrorMessage('Le formulaire de cette étape est introuvable.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedInitialData = useMemo(() => {
    if (!selectedCase) {
      return {};
    }

    const stepDataKey = `step_${selectedCase.current_step}`;
    const currentData = selectedCase.data_jsonb[stepDataKey];
    if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
      return currentData as Record<string, unknown>;
    }

    return {};
  }, [selectedCase]);

  const handleSubmitStep = async (values: Record<string, string | number | boolean | null>) => {
    if (!selectedCase) {
      return;
    }

    await submitCaseStep(selectedCase.id, values);
    setSelectedCase(null);
    setActiveSchema(null);
    await loadCases();
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inbox des tâches</h1>
            <p className="text-slate-400 text-sm">Traitement séquentiel piloté par workflow</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{currentUser?.name}</span>
            <span className="px-2 py-1 rounded-full text-xs bg-cyan-800/40 border border-cyan-600 text-cyan-200">
              {currentUser?.role}
            </span>
            {currentUser?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => navigate('/admin/workflows')}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
              >
                Admin Workflow
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-sm"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {isLoading ? <p className="text-slate-400">Chargement...</p> : null}
        {errorMessage ? <p className="text-rose-300 text-sm">{errorMessage}</p> : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {medicalCases.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Case #{item.id}</h2>
                  <p className="text-sm text-slate-300">Patient: {item.patient.name}</p>
                  <p className="text-xs text-slate-400">Workflow: {item.workflow.title}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs bg-slate-800 border border-slate-600">
                  {item.status}
                </span>
              </div>

              <div className="text-sm text-slate-300">
                Étape courante: <span className="text-cyan-300">{item.current_step_meta?.label || `Step ${item.current_step}`}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void openCurrentStepForm(item)}
                  className="flex-1 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold"
                >
                  Ouvrir le formulaire
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/viewer?url=biopsie_cmu_1.dzi`, {
                      state: {
                        patientName: item.patient.name,
                        folderId: `CASE-${item.id}`
                      }
                    });
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm font-semibold"
                  title="Voir l'image"
                >
                  👁️
                </button>
              </div>
            </article>
          ))}
        </div>

        {!medicalCases.length && !isLoading ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-6 text-slate-400">
            Aucune tâche assignée à votre rôle pour le moment.
          </div>
        ) : null}

        {selectedCase && activeSchema ? (
          <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Case #{selectedCase.id} · Étape {selectedCase.current_step}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/viewer?url=biopsie_cmu_1.dzi`, {
                      state: {
                        patientName: selectedCase.patient.name,
                        folderId: `CASE-${selectedCase.id}`
                      }
                    });
                  }}
                  className="text-sm px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1"
                >
                  Ouvrir l'Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCase(null);
                    setActiveSchema(null);
                  }}
                  className="text-sm px-3 py-1 rounded-lg border border-slate-600 hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>

            <SmartForm
              caseId={selectedCase.id}
              schema={activeSchema}
              initialData={selectedInitialData}
              onSubmit={handleSubmitStep}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
