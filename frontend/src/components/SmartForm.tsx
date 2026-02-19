import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { FormField, FormSchema } from '../services/api';

type Primitive = string | number | boolean | null;
type FormValues = Record<string, Primitive>;

interface OfflineQueueItem {
  caseId: number;
  stepData: FormValues;
  timestamp: string;
}

interface SmartFormProps {
  caseId: number;
  schema: FormSchema;
  initialData?: Record<string, unknown>;
  readOnly?: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}

const OFFLINE_QUEUE_KEY = 'offline_queue';

const isValuePresent = (value: Primitive): boolean => value !== null && value !== '';

const normalizeOptionValue = (field: FormField, value: string): Primitive => {
  const options = field.options ?? [];
  const hasNumberOption = options.some((option) => {
    if (typeof option === 'number') {
      return true;
    }
    if (typeof option === 'object') {
      return typeof option.value === 'number';
    }
    return false;
  });

  if (hasNumberOption) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const mapInitialData = (fields: FormField[], source?: Record<string, unknown>): FormValues => {
  if (!source) {
    return {};
  }

  return fields.reduce<FormValues>((accumulator, field) => {
    const candidate = source[field.name];
    if (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean' || candidate === null) {
      accumulator[field.name] = candidate;
    }
    return accumulator;
  }, {});
};

export default function SmartForm({ caseId, schema, initialData, readOnly = false, onSubmit }: SmartFormProps) {
  const [formValues, setFormValues] = useState<FormValues>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const computedRules = useMemo(() => schema.computedFields ?? [], [schema.computedFields]);

  useEffect(() => {
    setFormValues(mapInitialData(schema.fields, initialData));
  }, [initialData, schema.fields]);

  useEffect(() => {
    if (!computedRules.length) {
      return;
    }

    setFormValues((previousValues) => {
      let hasChanges = false;
      const nextValues: FormValues = { ...previousValues };

      for (const rule of computedRules) {
        if (rule.type !== 'matrix' || rule.dependencies.length < 2) {
          continue;
        }

        const dependencyValues = rule.dependencies.map((dependency) => nextValues[dependency]);
        if (dependencyValues.some((value) => !isValuePresent(value))) {
          continue;
        }

        const matrixKey = `${String(dependencyValues[0])},${String(dependencyValues[1])}`;
        const computedValue = rule.matrix[matrixKey] ?? null;
        if (nextValues[rule.target] !== computedValue) {
          nextValues[rule.target] = computedValue;
          hasChanges = true;
        }
      }

      return hasChanges ? nextValues : previousValues;
    });
  }, [computedRules, formValues]);

  useEffect(() => {
    const flushOfflineQueue = async () => {
      if (!navigator.onLine) {
        return;
      }

      const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!rawQueue) {
        return;
      }

      let parsedQueue: OfflineQueueItem[] = [];
      try {
        parsedQueue = JSON.parse(rawQueue) as OfflineQueueItem[];
      } catch {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        return;
      }

      const matchingItems = parsedQueue.filter((item) => item.caseId === caseId);
      if (!matchingItems.length) {
        return;
      }

      try {
        for (const item of matchingItems) {
          await onSubmit(item.stepData);
        }

        const remainingItems = parsedQueue.filter((item) => item.caseId !== caseId);
        if (remainingItems.length) {
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingItems));
        } else {
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
        }

        setMessage('Synchronisation offline terminée.');
      } catch {
        setMessage('Des éléments offline restent en attente de synchronisation.');
      }
    };

    void flushOfflineQueue();
  }, [caseId, onSubmit]);

  const handleFieldChange = (field: FormField, rawValue: string) => {
    const value = field.type === 'select' ? normalizeOptionValue(field, rawValue) : rawValue;
    setFormValues((previousValues) => ({
      ...previousValues,
      [field.name]: value,
    }));
  };

  const pushOfflineQueue = (stepData: FormValues) => {
    const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    let queue: OfflineQueueItem[] = [];

    if (rawQueue) {
      try {
        queue = JSON.parse(rawQueue) as OfflineQueueItem[];
      } catch {
        queue = [];
      }
    }

    queue.push({
      caseId,
      stepData,
      timestamp: new Date().toISOString(),
    });

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await onSubmit(formValues);
      setMessage('Formulaire soumis avec succès.');
    } catch {
      pushOfflineQueue(formValues);
      setMessage('API injoignable : sauvegarde offline effectuée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schema.fields.map((field) => {
          const value = formValues[field.name] ?? '';
          const isComputed = field.type === 'computed';
          const isTextarea = field.type === 'textarea';

          return (
            <div key={field.name} className={isTextarea ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>

              {field.type === 'select' ? (
                <select
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={String(value)}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                  disabled={readOnly}
                  required={field.required}
                >
                  <option value="">Sélectionner</option>
                  {(field.options ?? []).map((option) => {
                    if (typeof option === 'object') {
                      return (
                        <option key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </option>
                      );
                    }

                    return (
                      <option key={String(option)} value={String(option)}>
                        {String(option)}
                      </option>
                    );
                  })}
                </select>
              ) : null}

              {field.type === 'text' || field.type === 'date' ? (
                <input
                  type={field.type}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={String(value)}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                  disabled={readOnly || Boolean(field.readOnly)}
                  required={field.required}
                />
              ) : null}

              {field.type === 'textarea' ? (
                <textarea
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 min-h-24"
                  value={String(value)}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                  disabled={readOnly || Boolean(field.readOnly)}
                  required={field.required}
                />
              ) : null}

              {isComputed ? (
                <input
                  type="text"
                  className="w-full bg-emerald-900/30 border border-emerald-500 rounded-lg px-3 py-2 text-emerald-200 font-semibold"
                  value={String(value)}
                  readOnly
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}

      <button
        type="submit"
        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-60"
        disabled={readOnly || isSubmitting}
      >
        {isSubmitting ? 'Envoi...' : 'Soumettre'}
      </button>
    </form>
  );
}
