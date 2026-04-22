import { useState, useEffect } from 'preact/hooks';
import { getMedications, getDailyRecord, recordMedication } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { getJstMinutesOfDay, getTodayJstString } from '../utils/date';
import { MedicationCard } from '../components/MedicationCard';
import type { Medication, DailyRecord, RecordEntry, TimingType, RecordStatus } from '../types';
import { TIMING_LABELS, TIMING_ORDER } from '../types';

function getCurrentTiming(settings?: { timings: Record<TimingType, string> }): TimingType | null {
  if (!settings) return 'morning';

  const currentMinutes = getJstMinutesOfDay(new Date());

  const timings = TIMING_ORDER.map(timing => ({
    timing,
    minutes: timeToMinutes(settings.timings[timing])
  })).sort((a, b) => a.minutes - b.minutes);

  // 現在時刻に最も近い過去のタイミングを返す
  for (let i = timings.length - 1; i >= 0; i--) {
    if (currentMinutes >= timings[i].minutes) {
      return timings[i].timing;
    }
  }

  return timings[0].timing;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

interface MedicationWithStatus extends Medication {
  status: RecordStatus;
  entry?: RecordEntry;
}

export function HomePage() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTiming, setActiveTiming] = useState<TimingType>('morning');

  const today = getTodayJstString();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user?.settings) {
      const current = getCurrentTiming(user.settings);
      if (current) {
        setActiveTiming(current);
      }
    }
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [medsResult, recordResult] = await Promise.all([
        getMedications(true),
        getDailyRecord(today)
      ]);

      if (medsResult.success && medsResult.data) {
        setMedications(medsResult.data);
      }
      if (recordResult.success && recordResult.data) {
        setRecord(recordResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecord(medicationId: string, timing: TimingType, status: RecordStatus) {
    setUpdating(`${medicationId}-${timing}`);
    try {
      const result = await recordMedication({
        date: today,
        medicationId,
        timing,
        status
      });

      if (result.success && result.data) {
        setRecord(result.data);
      }
    } catch (error) {
      console.error('Failed to record:', error);
    } finally {
      setUpdating(null);
    }
  }

  function getMedicationsForTiming(timing: TimingType): MedicationWithStatus[] {
    return medications
      .filter(med => med.timings.includes(timing))
      .map(med => {
        const entry = record?.entries.find(
          e => e.medicationId === med.id && e.timing === timing
        );
        return {
          ...med,
          status: entry?.status || 'pending',
          entry
        };
      });
  }

  if (loading) {
    return (
      <div class="container flex items-center justify-center" style={{ padding: 'var(--spacing-xl)' }}>
        <div class="spinner" />
      </div>
    );
  }

  const medicationsForTiming = getMedicationsForTiming(activeTiming);
  const allDone = medicationsForTiming.every(m => m.status !== 'pending');

  return (
    <div class="container" style={{ padding: 'var(--spacing-md)' }}>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-gray-600)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          {new Date().toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
          })}
        </p>
      </div>

      {/* タイミング切り替えタブ */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        marginBottom: 'var(--spacing-md)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '6px 2px 2px'
      }}>
        {TIMING_ORDER.map(timing => {
          const medsForTiming = getMedicationsForTiming(timing);
          const hasMeds = medsForTiming.length > 0;
          const allDoneForTiming = medsForTiming.every(m => m.status !== 'pending');

          return (
            <button
              key={timing}
              onClick={() => setActiveTiming(timing)}
              style={{
                flex: '1 0 auto',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius)',
                background: activeTiming === timing ? 'var(--color-primary)' : 'var(--color-white)',
                color: activeTiming === timing ? 'var(--color-white)' : 'var(--color-gray-700)',
                border: activeTiming === timing ? 'none' : '1px solid var(--color-gray-200)',
                fontWeight: 500,
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {TIMING_LABELS[timing]}
              {user?.settings && (
                <span style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  opacity: 0.8
                }}>
                  {user.settings.timings[timing]}
                </span>
              )}
              {hasMeds && allDoneForTiming && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  color: 'white',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 薬リスト */}
      {medicationsForTiming.length === 0 ? (
        <div class="card text-center" style={{ padding: 'var(--spacing-xl)' }}>
          <p style={{ color: 'var(--color-gray-600)' }}>
            {TIMING_LABELS[activeTiming]}に服用する薬はありません
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {allDone && (
            <div class="card" style={{
              background: '#f0fff4',
              borderLeft: '4px solid var(--color-success)',
              padding: 'var(--spacing-md)'
            }}>
              <p style={{
                color: 'var(--color-success)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                {TIMING_LABELS[activeTiming]}のお薬は全て完了です
              </p>
            </div>
          )}

          {medicationsForTiming.map(med => (
            <MedicationCard
              key={med.id}
              medication={med}
              status={med.status}
              entry={med.entry}
              isUpdating={updating === `${med.id}-${activeTiming}`}
              onRecord={(status) => handleRecord(med.id, activeTiming, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
