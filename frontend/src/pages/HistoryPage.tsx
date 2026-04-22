import { useState, useEffect } from 'preact/hooks';
import { getMedications, getRecordsInRange, recordMedication } from '../services/api';
import { formatJstDate, getTodayJstString, parseJstDate } from '../utils/date';
import { MedicationCard } from '../components/MedicationCard';
import type { Medication, DailyRecord, RecordStatus, TimingType } from '../types';
import { TIMING_LABELS, TIMING_ORDER } from '../types';

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 月初の曜日に合わせて空白を追加
  const startDayOfWeek = firstDay.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
    days.push(prevDate);
  }

  // 月の日数を追加
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // 末尾を埋める
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}

interface DayStatus {
  total: number;
  taken: number;
  skipped: number;
  pending: number;
}

export function HistoryPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [medications, setMedications] = useState<Medication[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  async function loadData() {
    setLoading(true);
    try {
      const { year, month } = currentMonth;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const from = formatJstDate(firstDay);
      const to = formatJstDate(lastDay);

      const [medsResult, recordsResult] = await Promise.all([
        getMedications(true),
        getRecordsInRange(from, to)
      ]);

      if (medsResult.success && medsResult.data) {
        setMedications(medsResult.data);
      }
      if (recordsResult.success && recordsResult.data) {
        setRecords(recordsResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function goToPrevMonth() {
    setCurrentMonth(prev => {
      const newMonth = prev.month - 1;
      if (newMonth < 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: newMonth };
    });
  }

  function goToNextMonth() {
    setCurrentMonth(prev => {
      const newMonth = prev.month + 1;
      if (newMonth > 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: newMonth };
    });
  }

  function getDayStatus(date: Date): DayStatus | null {
    const dateStr = formatJstDate(date);
    const record = records.find(r => r.date === dateStr);

    // その日に服用すべき薬の数を計算
    const totalMeds = medications.reduce((count, med) => {
      return count + med.timings.length;
    }, 0);

    if (totalMeds === 0) return null;

    let taken = 0;
    let skipped = 0;

    if (record) {
      record.entries.forEach(entry => {
        if (entry.status === 'taken') taken++;
        else if (entry.status === 'skipped') skipped++;
      });
    }

    return {
      total: totalMeds,
      taken,
      skipped,
      pending: totalMeds - taken - skipped
    };
  }

  function getStatusColor(status: DayStatus | null): string {
    if (!status || status.total === 0) return 'transparent';

    const completionRate = (status.taken + status.skipped) / status.total;

    if (status.taken === status.total) return 'var(--color-success)';
    if (completionRate >= 1) return 'var(--color-gray-400)';
    if (completionRate > 0) return 'var(--color-warning)';
    return 'transparent';
  }

  const days = getMonthDays(currentMonth.year, currentMonth.month);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const today = formatJstDate(new Date());

  const selectedRecord = selectedDate
    ? records.find(r => r.date === selectedDate)
    : null;

  return (
    <div class="container" style={{ padding: 'var(--spacing-md)' }}>
      <h2 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-md)'
      }}>
        服用履歴
      </h2>

      {/* 月切り替え */}
      <div class="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-md)' }}>
        <button
          onClick={goToPrevMonth}
          class="btn btn-outline"
        >
          ←
        </button>
        <span style={{ fontWeight: 600 }}>
          {currentMonth.year}年{currentMonth.month + 1}月
        </span>
        <button
          onClick={goToNextMonth}
          class="btn btn-outline"
        >
          →
        </button>
      </div>

      {/* カレンダー */}
      <div class="card" style={{ padding: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        {/* 曜日ヘッダー */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          marginBottom: 'var(--spacing-xs)'
        }}>
          {weekDays.map((day, i) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontSize: 'var(--font-size-xs)',
                color: i === 0 ? 'var(--color-danger)' : i === 6 ? 'var(--color-primary)' : 'var(--color-gray-600)',
                padding: 'var(--spacing-xs)'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        {loading ? (
          <div class="flex items-center justify-center" style={{ padding: 'var(--spacing-xl)' }}>
            <div class="spinner" />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px'
          }}>
            {days.map((date, i) => {
              const dateStr = formatJstDate(date);
              const isCurrentMonth = date.getMonth() === currentMonth.month;
              const isToday = dateStr === today;
              const status = getDayStatus(date);
              const statusColor = getStatusColor(status);
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? 'var(--color-white)' :
                           !isCurrentMonth ? 'var(--color-gray-400)' :
                           date.getDay() === 0 ? 'var(--color-danger)' :
                           date.getDay() === 6 ? 'var(--color-primary)' :
                           'var(--color-gray-700)',
                    border: isToday && !isSelected ? '2px solid var(--color-primary)' : 'none',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>
                    {date.getDate()}
                  </span>
                  {isCurrentMonth && status && status.total > 0 && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isSelected ? 'var(--color-white)' : statusColor,
                      marginTop: '2px'
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 凡例 */}
      <div class="flex gap-md" style={{
        justifyContent: 'center',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-gray-600)'
      }}>
        <span class="flex items-center gap-sm">
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-success)'
          }} />
          全て服用
        </span>
        <span class="flex items-center gap-sm">
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-warning)'
          }} />
          一部服用
        </span>
        <span class="flex items-center gap-sm">
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-gray-400)'
          }} />
          スキップ
        </span>
      </div>

      {/* 選択した日の詳細 */}
      {selectedDate && (
        <DayDetail
          date={selectedDate}
          record={selectedRecord}
          medications={medications}
          onRecordUpdated={updateLocalRecord}
        />
      )}
    </div>
  );

  function updateLocalRecord(updated: DailyRecord) {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.date === updated.date);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }
}

interface DayDetailProps {
  date: string;
  record: DailyRecord | null | undefined;
  medications: Medication[];
  onRecordUpdated: (updated: DailyRecord) => void;
}

function DayDetail({ date, record, medications, onRecordUpdated }: DayDetailProps) {
  const dateObj = parseJstDate(date);
  const isEditable = date <= getTodayJstString();
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleRecord(medicationId: string, timing: TimingType, status: RecordStatus) {
    setUpdating(`${medicationId}-${timing}`);
    try {
      const result = await recordMedication({ date, medicationId, timing, status });
      if (result.success && result.data) {
        onRecordUpdated(result.data);
      }
    } catch (error) {
      console.error('Failed to record:', error);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div class="card">
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-md)'
      }}>
        {dateObj.toLocaleDateString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short'
        })}
      </h3>

      {TIMING_ORDER.map(timing => {
        const medsForTiming = medications.filter(m => m.timings.includes(timing));
        if (medsForTiming.length === 0) return null;

        return (
          <div key={timing} style={{ marginBottom: 'var(--spacing-md)' }}>
            <h4 style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-gray-600)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              {TIMING_LABELS[timing]}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {medsForTiming.map(med => {
                const entry = record?.entries.find(
                  e => e.medicationId === med.id && e.timing === timing
                );
                const status = entry?.status || 'pending';

                if (isEditable) {
                  return (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      status={status}
                      entry={entry}
                      isUpdating={updating === `${med.id}-${timing}`}
                      onRecord={(newStatus) => handleRecord(med.id, timing, newStatus)}
                    />
                  );
                }

                return (
                  <div
                    key={med.id}
                    class="flex items-center justify-between"
                    style={{
                      padding: 'var(--spacing-sm)',
                      background: 'var(--color-gray-100)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <span>{med.name}</span>
                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: status === 'taken' ? 'var(--color-success)' :
                             status === 'skipped' ? 'var(--color-gray-500)' :
                             'var(--color-gray-400)'
                    }}>
                      {status === 'taken' ? '✓ 服用' :
                       status === 'skipped' ? '— スキップ' : '未記録'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
