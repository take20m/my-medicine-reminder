import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { getMedications, deleteMedication, updateMedication } from '../services/api';
import type { Medication } from '../types';
import { TIMING_LABELS } from '../types';

export function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadMedications();
  }, []);

  async function loadMedications() {
    setLoading(true);
    try {
      const result = await getMedications();
      if (result.success && result.data) {
        setMedications(result.data);
      }
    } catch (error) {
      console.error('Failed to load medications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('この薬を削除しますか？')) return;

    setDeleting(id);
    try {
      const result = await deleteMedication(id);
      if (result.success) {
        setMedications(medications.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete medication:', error);
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(medication: Medication) {
    try {
      const result = await updateMedication(medication.id, {
        active: !medication.active
      });
      if (result.success && result.data) {
        setMedications(medications.map(m =>
          m.id === medication.id ? result.data! : m
        ));
      }
    } catch (error) {
      console.error('Failed to update medication:', error);
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
      <div class="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          お薬一覧
        </h2>
        <button
          onClick={() => route('/medications/new')}
          class="btn btn-primary"
        >
          + 新規登録
        </button>
      </div>

      {medications.length === 0 ? (
        <div class="card text-center" style={{ padding: 'var(--spacing-xl)' }}>
          <p style={{ color: 'var(--color-gray-600)', marginBottom: 'var(--spacing-md)' }}>
            まだ薬が登録されていません
          </p>
          <button
            onClick={() => route('/medications/new')}
            class="btn btn-primary"
          >
            最初の薬を登録する
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {medications.map(med => (
            <div
              key={med.id}
              class="card"
              style={{
                opacity: med.active ? 1 : 0.6
              }}
            >
              <div class="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 600
                }}>
                  {med.name}
                  {!med.active && (
                    <span style={{
                      marginLeft: 'var(--spacing-sm)',
                      fontSize: 'var(--font-size-xs)',
                      background: 'var(--color-gray-200)',
                      color: 'var(--color-gray-600)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)'
                    }}>
                      休止中
                    </span>
                  )}
                </h3>
              </div>

              <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-gray-600)',
                marginBottom: 'var(--spacing-xs)'
              }}>
                {med.dosage}
              </p>

              {med.description && (
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-gray-500)',
                  marginBottom: 'var(--spacing-sm)'
                }}>
                  {med.description}
                </p>
              )}

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-xs)',
                flexWrap: 'wrap',
                marginBottom: 'var(--spacing-md)'
              }}>
                {med.timings.map(timing => (
                  <span
                    key={timing}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      background: 'var(--color-primary)',
                      color: 'var(--color-white)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {TIMING_LABELS[timing]}
                  </span>
                ))}
              </div>

              <div class="flex gap-sm">
                <button
                  onClick={() => route(`/medications/${med.id}`)}
                  class="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  編集
                </button>
                <button
                  onClick={() => handleToggleActive(med)}
                  class="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  {med.active ? '休止' : '再開'}
                </button>
                <button
                  onClick={() => handleDelete(med.id)}
                  disabled={deleting === med.id}
                  class="btn btn-outline"
                  style={{
                    color: 'var(--color-danger)',
                    borderColor: 'var(--color-danger)'
                  }}
                >
                  {deleting === med.id ? (
                    <div class="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  ) : (
                    '削除'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
