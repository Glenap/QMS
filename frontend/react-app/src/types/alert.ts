// IS-456/10262 quality alerts (mirrors app/schemas/alert.py).

export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED';

export interface AlertResponse {
  alert_id: number;
  level: AlertLevel;
  category: string;
  title: string;
  message: string;
  sample_id: number | null;
  pour_id: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
}

export interface AlertCount {
  count: number;
}

export interface RmcNotify {
  subject: string;
  message: string;
}
