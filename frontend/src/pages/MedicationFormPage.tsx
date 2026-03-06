import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { getMedication, createMedication, updateMedication } from '../services/api';
import type { TimingType } from '../types';
import { TIMING_LABELS, TIMING_ORDER } from '../types';

interface Props {
  id?: string;
}

export function MedicationFormPage({ id }: Props) {
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dosage, setDosage] = useState('');
  const [timings, setTimings] = useState<TimingType[]>([]);

  useEffect(() => {
    if (isEdit) {
      loadMedication();
    }
  }, [id]);

  async function loadMedication() {
    setLoading(true);
    try {
      const result = await getMedication(id!);
      if (result.success && result.data) {
        setName(result.data.name);
        setDescription(result.data.description || '');
        setDosage(result.data.dosage);
        setTimings(result.data.timings);
      }
    } catch (error) {
      console.error('Failed to load medication:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleTiming(timing: TimingType) {
    if (timings.includes(timing)) {
      setTimings(timings.filter(t => t !== timing));
    } else {
      setTimings([...timings, timing]);
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);

    // バリデーション
    if (!name.trim()) {
      setError('薬の名前を入力してください');
      return;
    }
    if (!dosage.trim()) {
      setError('用量を入力してください');
      return;
    }
    if (timings.length === 0) {
      setError('服用タイミングを1つ以上選択してください');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        dosage: dosage.trim(),
        timings
      };

      const result = isEdit
        ? await updateMedication(id!, data)
        : await createMedication(data);

      if (result.success) {
        route('/medications');
      } else {
        setError(result.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save medication:', error);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div class="container flex items-center justify-center" style={{ padding: 'var(--spacing-xl)' }}>
        <div class="spinner" />
      </div>
    );
  }

  return (
    <div class="container" style={{ padding: 'var(--spacing-md)' }}>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <button
          onClick={() => route('/medications')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
          }}
        >
          ← 戻る
        </button>
      </div>

      <h2 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-lg)'
      }}>
        {isEdit ? '薬を編集' : '新しい薬を登録'}
      </h2>

      {error && (
        <div style={{
          background: '#fef2f2',
          color: 'var(--color-danger)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label class="form-label" for="name">
            薬の名前 <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="name"
            type="text"
            class="form-input"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="例: 血圧の薬"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="dosage">
            用量 <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="dosage"
            type="text"
            class="form-input"
            value={dosage}
            onInput={(e) => setDosage((e.target as HTMLInputElement).value)}
            placeholder="例: 1錠"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="description">
            説明（任意）
          </label>
          <input
            id="description"
            type="text"
            class="form-input"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
            placeholder="例: 白い錠剤"
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            服用タイミング <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--spacing-sm)'
          }}>
            {TIMING_ORDER.map(timing => (
              <button
                key={timing}
                type="button"
                onClick={() => toggleTiming(timing)}
                style={{
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius)',
                  border: timings.includes(timing)
                    ? '2px solid var(--color-primary)'
                    : '1px solid var(--color-gray-300)',
                  background: timings.includes(timing)
                    ? 'rgba(74, 144, 164, 0.1)'
                    : 'var(--color-white)',
                  color: timings.includes(timing)
                    ? 'var(--color-primary)'
                    : 'var(--color-gray-700)',
                  fontWeight: timings.includes(timing) ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {TIMING_LABELS[timing]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'var(--spacing-xl)' }}>
          <button
            type="submit"
            disabled={saving}
            class="btn btn-primary btn-block btn-lg"
          >
            {saving ? (
              <div class="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
            ) : (
              isEdit ? '保存' : '登録'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
