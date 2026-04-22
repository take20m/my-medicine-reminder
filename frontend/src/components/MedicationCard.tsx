import type { Medication, RecordEntry, RecordStatus } from '../types';

interface MedicationCardProps {
  medication: Medication;
  status: RecordStatus;
  entry?: RecordEntry;
  isUpdating: boolean;
  onRecord: (status: RecordStatus) => void;
}

export function MedicationCard({ medication, status, entry, isUpdating, onRecord }: MedicationCardProps) {
  return (
    <div class="card" style={{
      borderLeft: status === 'taken' ? '4px solid var(--color-success)' :
                 status === 'skipped' ? '4px solid var(--color-gray-400)' :
                 '4px solid var(--color-primary)'
    }}>
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-xs)'
        }}>
          {medication.name}
        </h3>
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-gray-600)'
        }}>
          {medication.dosage}
          {medication.description && ` - ${medication.description}`}
        </p>
      </div>

      {status === 'pending' ? (
        <div class="flex gap-sm">
          <button
            onClick={() => onRecord('taken')}
            disabled={isUpdating}
            class="btn btn-outline-success"
            style={{ flex: 1 }}
          >
            {isUpdating ? (
              <div class="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            ) : (
              '飲んだと記録'
            )}
          </button>
          <button
            onClick={() => onRecord('skipped')}
            disabled={isUpdating}
            class="btn btn-outline"
            style={{ flex: 1 }}
          >
            スキップ
          </button>
        </div>
      ) : (
        <div class="flex items-center justify-between">
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: status === 'taken' ? 'var(--color-success)' : 'var(--color-gray-500)',
            fontWeight: 500
          }}>
            {status === 'taken' ? '✓ 服用済み' : '— スキップ'}
            {entry && (
              <span style={{ marginLeft: 'var(--spacing-sm)', fontWeight: 400 }}>
                ({new Date(entry.recordedAt).toLocaleTimeString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                  hour: '2-digit',
                  minute: '2-digit'
                })})
              </span>
            )}
          </span>
          <button
            onClick={() => onRecord('pending')}
            disabled={isUpdating}
            class="btn btn-outline"
            style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-xs) var(--spacing-sm)' }}
          >
            取り消し
          </button>
        </div>
      )}
    </div>
  );
}
