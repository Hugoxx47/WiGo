import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import NoCodeFormBuilder from '../components/NoCodeFormBuilder';
import {
  createFormTemplate,
  createWorkflow,
  getFormTemplates,
  getWorkflows,
  type AuthUser,
  type FormSchema,
  type FormTemplate,
  type UserRole,
  type WorkflowDefinition,
  type WorkflowStep,
} from '../services/api';

const USER_STORAGE_KEY = 'biopsie_user';

interface EditableStep {
  step: number;
  form_id: number;
  role_required: UserRole;
  label: string;
}

const parseCurrentUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const roleOptions: UserRole[] = ['admin', 'doctor', 'nurse', 'patient'];

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const [currentUser] = useState<AuthUser | null>(() => parseCurrentUser());
  const [title, setTitle] = useState('');
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const firstTemplateId = useMemo(() => templates[0]?.id ?? 0, [templates]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (currentUser.role !== 'admin') {
      navigate('/inbox');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [formsData, workflowsData] = await Promise.all([getFormTemplates(), getWorkflows()]);
        setTemplates(formsData);
        setWorkflows(workflowsData);

        if (!steps.length && formsData.length) {
          setSteps([
            {
              step: 1,
              form_id: formsData[0].id,
              role_required: 'nurse',
              label: 'Étape 1',
            },
          ]);
        }
      } catch {
        setErrorMessage('Impossible de charger les workflows/formulaires.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [currentUser, navigate, steps.length]);

  const addStep = () => {
    if (!firstTemplateId) {
      return;
    }

    setSteps((previous) => [
      ...previous,
      {
        step: previous.length + 1,
        form_id: firstTemplateId,
        role_required: 'nurse',
        label: `Étape ${previous.length + 1}`,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((previous) =>
      previous
        .filter((_, currentIndex) => currentIndex !== index)
        .map((step, newIndex) => ({ ...step, step: newIndex + 1 })),
    );
  };

  const updateStep = (index: number, patch: Partial<EditableStep>) => {
    setSteps((previous) => previous.map((step, currentIndex) => (currentIndex === index ? { ...step, ...patch } : step)));
  };

  const handleCreateTemplate = async (formTitle: string, schema: FormSchema) => {
    setLoading(true);
    setFormMessage(null);

    try {
      const newTemplate = await createFormTemplate({
        title: formTitle,
        schema_json: schema,
      });

      const refreshedTemplates = await getFormTemplates();
      setTemplates(refreshedTemplates);
      setFormMessage(`Formulaire créé (id: ${newTemplate.id}).`);

      if (!steps.length) {
        setSteps([
          {
            step: 1,
            form_id: newTemplate.id,
            role_required: 'nurse',
            label: 'Étape 1',
          },
        ]);
      }
    } catch (error: unknown) {
      const fallbackMessage = 'Erreur API lors de la création du formulaire.';
      if (error instanceof Error) {
        setFormMessage(error.message || fallbackMessage);
      } else {
        setFormMessage(fallbackMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !steps.length) {
      setErrorMessage('Titre et étapes sont obligatoires.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const payload: WorkflowStep[] = steps.map((step, index) => ({
        step: index + 1,
        label: step.label,
        form_id: step.form_id,
        role_required: step.role_required,
      }));

      await createWorkflow({
        title: title.trim(),
        steps_json: payload,
      });

      const refreshed = await getWorkflows();
      setWorkflows(refreshed);
      setTitle('');
      setSteps((previous) =>
        previous.map((step, index) => ({
          ...step,
          step: index + 1,
          label: `Étape ${index + 1}`,
        })),
      );
    } catch {
      setErrorMessage('Échec de création du workflow.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workflow Builder</h1>
            <p className="text-sm text-slate-400">Association Formulaire + Rôle par étape</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-sm"
          >
            Retour Inbox
          </button>
        </header>

        <NoCodeFormBuilder
          isLoading={loading}
          onCreateTemplate={handleCreateTemplate}
          onTemplateCreated={setFormMessage}
        />

        {formMessage ? <p className="text-sm text-cyan-300">{formMessage}</p> : null}

        <form onSubmit={saveWorkflow} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Titre du workflow</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
              placeholder="Workflow biopsie gastrique"
              required
            />
          </div>

          {steps.map((step, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border border-slate-700 rounded-lg p-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Étape</label>
                <input type="number" value={step.step} readOnly className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Formulaire</label>
                <select
                  value={step.form_id}
                  onChange={(event) => updateStep(index, { form_id: Number(event.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Rôle requis</label>
                <select
                  value={step.role_required}
                  onChange={(event) => updateStep(index, { role_required: event.target.value as UserRole })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={step.label}
                  onChange={(event) => updateStep(index, { label: event.target.value })}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
                  placeholder="Label"
                />
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm"
                >
                  Suppr.
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addStep}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700"
            >
              Ajouter une étape
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-70"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le workflow'}
            </button>
          </div>

          {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}
        </form>

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
          <h2 className="text-lg font-semibold">Workflows existants</h2>
          {workflows.map((workflow) => (
            <article key={workflow.id} className="border border-slate-700 rounded-lg p-3 space-y-2">
              <h3 className="font-medium">{workflow.title}</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                {workflow.steps_json.map((step) => (
                  <li key={`${workflow.id}-${step.step}`}>
                    Étape {step.step} · {step.label || 'Sans label'} · form #{step.form_id} · rôle {step.role_required}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
