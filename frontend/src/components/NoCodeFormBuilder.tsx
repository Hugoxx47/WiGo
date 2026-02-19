import { useMemo, useState, type DragEvent } from 'react';
import type { FormSchema } from '../services/api';

type BuilderFieldType = 'text' | 'select' | 'date' | 'textarea' | 'computed';

interface BuilderField {
  id: string;
  name: string;
  label: string;
  type: BuilderFieldType;
  required: boolean;
  readOnly: boolean;
  optionsText: string;
  dependenciesText: string;
  matrixText: string;
}

interface NoCodeFormBuilderProps {
  isLoading: boolean;
  onCreateTemplate: (title: string, schema: FormSchema) => Promise<void>;
  onTemplateCreated?: (message: string) => void;
}

interface BlockDefinition {
  type: BuilderFieldType;
  label: string;
  description: string;
}

const blockPalette: BlockDefinition[] = [
  { type: 'text', label: 'Bloc Texte', description: 'Champ texte simple' },
  { type: 'select', label: 'Bloc Select', description: 'Liste déroulante' },
  { type: 'date', label: 'Bloc Date', description: 'Sélecteur de date' },
  { type: 'textarea', label: 'Bloc Zone texte', description: 'Texte long / observations' },
  { type: 'computed', label: 'Bloc Calculé', description: 'Champ calculé via dépendances' },
];

const createField = (type: BuilderFieldType, index: number): BuilderField => {
  const baseName = `${type}_${index}`;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: baseName,
    label: baseName.replace('_', ' ').toUpperCase(),
    type,
    required: type !== 'computed',
    readOnly: type === 'computed',
    optionsText: type === 'select' ? 'A, B, C' : '',
    dependenciesText: type === 'computed' ? 'score_antre,score_corps' : '',
    matrixText:
      type === 'computed'
        ? '{\n  "0,0": "0",\n  "0,1": "I",\n  "0,2": "II",\n  "0,3": "II",\n  "1,0": "I",\n  "1,1": "I",\n  "1,2": "II",\n  "1,3": "III",\n  "2,0": "II",\n  "2,1": "II",\n  "2,2": "III",\n  "2,3": "IV",\n  "3,0": "II",\n  "3,1": "III",\n  "3,2": "IV",\n  "3,3": "IV"\n}'
        : '',
  };
};

const createOlgaPreset = (): { title: string; fields: BuilderField[] } => {
  const fields: BuilderField[] = [
    {
      id: 'olga-1',
      name: 'patient_reference',
      label: 'Référence patient',
      type: 'text',
      required: true,
      readOnly: false,
      optionsText: '',
      dependenciesText: '',
      matrixText: '',
    },
    {
      id: 'olga-2',
      name: 'prelevement_date',
      label: 'Date de prélèvement',
      type: 'date',
      required: true,
      readOnly: false,
      optionsText: '',
      dependenciesText: '',
      matrixText: '',
    },
    {
      id: 'olga-3',
      name: 'score_antre',
      label: 'Score Antre',
      type: 'select',
      required: true,
      readOnly: false,
      optionsText: '0,1,2,3',
      dependenciesText: '',
      matrixText: '',
    },
    {
      id: 'olga-4',
      name: 'score_corps',
      label: 'Score Corps',
      type: 'select',
      required: true,
      readOnly: false,
      optionsText: '0,1,2,3',
      dependenciesText: '',
      matrixText: '',
    },
    {
      id: 'olga-5',
      name: 'stade_olga',
      label: 'Stade OLGA',
      type: 'computed',
      required: false,
      readOnly: true,
      optionsText: '',
      dependenciesText: 'score_antre,score_corps',
      matrixText:
        '{\n  "0,0": "0",\n  "0,1": "I",\n  "0,2": "II",\n  "0,3": "II",\n  "1,0": "I",\n  "1,1": "I",\n  "1,2": "II",\n  "1,3": "III",\n  "2,0": "II",\n  "2,1": "II",\n  "2,2": "III",\n  "2,3": "IV",\n  "3,0": "II",\n  "3,1": "III",\n  "3,2": "IV",\n  "3,3": "IV"\n}',
    },
    {
      id: 'olga-6',
      name: 'commentaire',
      label: 'Commentaire',
      type: 'textarea',
      required: false,
      readOnly: false,
      optionsText: '',
      dependenciesText: '',
      matrixText: '',
    },
  ];

  return {
    title: 'Stadification OLGA',
    fields,
  };
};

export default function NoCodeFormBuilder({ isLoading, onCreateTemplate, onTemplateCreated }: NoCodeFormBuilderProps) {
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dropHint = useMemo(() => {
    if (fields.length > 0) {
      return 'Formulaire en cours de création';
    }
    return 'Glisse un bloc depuis la palette pour commencer';
  }, [fields.length]);

  const addFieldFromType = (type: BuilderFieldType) => {
    setFields((previous) => [...previous, createField(type, previous.length + 1)]);
  };

  const handlePaletteDragStart = (event: DragEvent<HTMLButtonElement>, type: BuilderFieldType) => {
    event.dataTransfer.setData('application/x-form-block', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-form-block') as BuilderFieldType;
    if (!type) {
      return;
    }
    addFieldFromType(type);
  };

  const updateField = (id: string, patch: Partial<BuilderField>) => {
    setFields((previous) => previous.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const removeField = (id: string) => {
    setFields((previous) => previous.filter((field) => field.id !== id));
  };

  const parseOptionValue = (value: string): string | number => {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return trimmedValue;
    }

    const numeric = Number(trimmedValue);
    if (!Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(trimmedValue)) {
      return numeric;
    }

    return trimmedValue;
  };

  const buildSchema = (): FormSchema => {
    const duplicateName = new Set<string>();
    const fieldsPayload = fields.map((field) => {
      const normalizedName = field.name.trim();
      if (!normalizedName) {
        throw new Error('Chaque champ doit avoir un name.');
      }

      if (duplicateName.has(normalizedName)) {
        throw new Error(`Le name "${normalizedName}" est dupliqué.`);
      }
      duplicateName.add(normalizedName);

      const baseField = {
        name: normalizedName,
        label: field.label.trim() || normalizedName,
        type: field.type,
        required: field.required,
        readOnly: field.readOnly,
      } as const;

      if (field.type === 'select') {
        const options = field.optionsText
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .map(parseOptionValue);

        if (!options.length) {
          throw new Error(`Le champ select "${normalizedName}" doit avoir au moins une option.`);
        }

        return {
          ...baseField,
          options,
        };
      }

      return baseField;
    });

    const computedFields = fields
      .filter((field) => field.type === 'computed')
      .map((field) => {
        const dependencies = field.dependenciesText
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);

        if (dependencies.length < 2) {
          throw new Error(`Le champ calculé "${field.name}" doit avoir au moins 2 dépendances.`);
        }

        let matrix: Record<string, string>;
        try {
          matrix = JSON.parse(field.matrixText) as Record<string, string>;
        } catch {
          throw new Error(`La matrice JSON du champ "${field.name}" est invalide.`);
        }

        return {
          target: field.name.trim(),
          dependencies,
          type: 'matrix' as const,
          matrix,
        };
      });

    return {
      title: title.trim(),
      fields: fieldsPayload,
      computedFields,
    };
  };

  const saveTemplate = async () => {
    if (!title.trim()) {
      setError('Le titre du formulaire est obligatoire.');
      return;
    }

    if (!fields.length) {
      setError('Ajoute au moins un bloc dans la zone de drop.');
      return;
    }

    try {
      setError(null);
      const schema = buildSchema();
      await onCreateTemplate(title.trim(), schema);
      onTemplateCreated?.('Formulaire créé avec succès.');
    } catch (creationError: unknown) {
      if (creationError instanceof Error) {
        setError(creationError.message);
      } else {
        setError('Erreur de création du formulaire.');
      }
    }
  };

  const loadOlgaPreset = () => {
    const preset = createOlgaPreset();
    setTitle(preset.title);
    setFields(preset.fields);
    setError(null);
    onTemplateCreated?.('Preset OLGA chargé.');
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Builder No-Code des formulaires</h2>
        <button
          type="button"
          onClick={loadOlgaPreset}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-sm"
        >
          Charger preset OLGA
        </button>
      </div>

      <div>
        <label className="block text-sm text-slate-300 mb-1">Titre du formulaire</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
          placeholder="Ex: Formulaire gastrite"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <aside className="space-y-2 lg:col-span-1">
          <p className="text-sm text-slate-300">Palette de blocs (glisser-déposer)</p>
          {blockPalette.map((block) => (
            <button
              key={block.type}
              type="button"
              draggable
              onDragStart={(event) => handlePaletteDragStart(event, block.type)}
              onClick={() => addFieldFromType(block.type)}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700"
            >
              <p className="text-sm font-medium">{block.label}</p>
              <p className="text-xs text-slate-400">{block.description}</p>
            </button>
          ))}
        </aside>

        <div
          className="lg:col-span-2 rounded-lg border-2 border-dashed border-slate-600 bg-slate-950/40 p-4 min-h-56"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm text-slate-300 mb-3">{dropHint}</p>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <article key={field.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">#{index + 1} · {field.type}</p>
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="px-2.5 py-1.5 rounded-md bg-rose-700 hover:bg-rose-600 text-xs"
                  >
                    Supprimer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name (clé JSON)</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(event) => updateField(field.id, { name: event.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Label affiché</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(event) => updateField(field.id, { label: event.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-2 text-sm"
                    />
                  </div>
                </div>

                {field.type === 'select' ? (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Options (séparées par virgules)</label>
                    <input
                      type="text"
                      value={field.optionsText}
                      onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-2 text-sm"
                    />
                  </div>
                ) : null}

                {field.type === 'computed' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Dépendances (ex: score_antre,score_corps)</label>
                      <input
                        type="text"
                        value={field.dependenciesText}
                        onChange={(event) => updateField(field.id, { dependenciesText: event.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Matrice JSON</label>
                      <textarea
                        value={field.matrixText}
                        onChange={(event) => updateField(field.id, { matrixText: event.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-2 min-h-32 font-mono text-xs"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateField(field.id, { required: event.target.checked })}
                    />
                    Requis
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={field.readOnly}
                      onChange={(event) => updateField(field.id, { readOnly: event.target.checked })}
                    />
                    Lecture seule
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void saveTemplate()}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70"
        >
          {isLoading ? 'Création...' : 'Créer le formulaire'}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </section>
  );
}
