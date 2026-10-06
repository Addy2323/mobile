export type Merchant = {
  id: string;
  display_name: string;
  legal_name: string | null;
  category: string;
  phone: string | null;
  verification_status: string;
  destination_id: string;
  payment_rail: string;
  support_contact: string | null;
  city: string | null;
  rating: number;
  created_at: string;
};

export type Split = {
  id: string;
  title: string;
  category: string;
  currency: string;
  total_amount: number;
  mode: string;
  organizer_name: string;
  organizer_phone: string;
  merchant_id: string | null;
  status: string;
  due_at: string | null;
  note: string | null;
  settlement_percent: number;
  amount_paid: number;
  participant_count: number;
  ref_code: string;
  created_at: string;
  merchant?: Merchant | null;
};

export type Participant = {
  id: string;
  split_id: string;
  name: string;
  phone: string | null;
  allocation_amount: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  payment_ref: string | null;
  is_organizer: boolean;
  claim_status?: string;
  created_at: string;
};

export type PaymentAttempt = {
  id: string;
  split_participant_id: string;
  amount: number;
  provider: string;
  provider_tx_ref: string | null;
  status: string;
  payment_method: string | null;
  idempotency_key?: string | null;
  requested_at: string;
  completed_at: string | null;
  failure_code: string | null;
  participant?: Participant | null;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

interface QueryFilter {
  column: string;
  value: any;
  operator?: 'eq' | 'in' | 'neq';
}

class PostgresQueryBuilder {
  private tableName: string;
  private filters: QueryFilter[] = [];
  private orderConfig: { column: string; ascending: boolean } | null = null;
  private limitValue: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private payload: any = null;
  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'SELECT';

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_columns?: string) {
    return this;
  }

  insert(data: any) {
    this.operation = 'INSERT';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.operation = 'UPDATE';
    this.payload = data;
    return this;
  }

  delete() {
    this.operation = 'DELETE';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value, operator: 'eq' });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, value, operator: 'neq' });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, value: values, operator: 'in' });
    return this;
  }

  or(_searchQuery: string) {
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderConfig = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const res = await this.execute();
      return onfulfilled ? onfulfilled(res) : (res as any);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      if (this.operation === 'INSERT') {
        return await this.executeInsert();
      } else if (this.operation === 'UPDATE') {
        return await this.executeUpdate();
      } else if (this.operation === 'DELETE') {
        return await this.executeDelete();
      } else {
        return await this.executeSelect();
      }
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Database error' } };
    }
  }

  private async executeInsert(): Promise<{ data: any; error: any }> {
    if (this.tableName === 'split_participants' && Array.isArray(this.payload)) {
      const results = [];
      for (const p of this.payload) {
        const res = await fetch(`${API_BASE}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return { data: null, error: { message: errData.error || 'Failed to insert participant' } };
        }
        results.push(await res.json());
      }
      return { data: results, error: null };
    }

    let endpoint = `${API_BASE}/${this.tableName.replace('_', '-')}`;
    if (this.tableName === 'split_participants') endpoint = `${API_BASE}/participants`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { data: null, error: { message: errData.error || `Failed to insert into ${this.tableName}` } };
    }

    const data = await res.json();
    return { data, error: null };
  }

  private async executeUpdate(): Promise<{ data: any; error: any }> {
    const idFilter = this.filters.find(f => f.column === 'id');
    if (!idFilter) {
      return { data: null, error: { message: 'Update requires id filter' } };
    }

    let endpoint = `${API_BASE}/${this.tableName.replace('_', '-')}/${idFilter.value}`;
    if (this.tableName === 'split_participants') endpoint = `${API_BASE}/participants/${idFilter.value}`;

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { data: null, error: { message: errData.error || `Failed to update ${this.tableName}` } };
    }

    const data = await res.json();
    return { data, error: null };
  }

  private async executeDelete(): Promise<{ data: any; error: any }> {
    const idFilter = this.filters.find(f => f.column === 'id');
    if (!idFilter) {
      return { data: null, error: { message: 'Delete requires id filter' } };
    }

    let endpoint = `${API_BASE}/${this.tableName.replace('_', '-')}/${idFilter.value}`;
    if (this.tableName === 'split_participants') endpoint = `${API_BASE}/participants/${idFilter.value}`;

    const res = await fetch(endpoint, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { data: null, error: { message: errData.error || `Failed to delete from ${this.tableName}` } };
    }

    const data = await res.json();
    return { data, error: null };
  }

  private async executeSelect(): Promise<{ data: any; error: any }> {
    const idFilter = this.filters.find(f => f.column === 'id');
    const refFilter = this.filters.find(f => f.column === 'ref_code');
    const splitIdFilter = this.filters.find(f => f.column === 'split_id');
    const participantIdFilter = this.filters.find(f => f.column === 'split_participant_id' && f.operator !== 'in');
    const inParticipantIdsFilter = this.filters.find(f => f.column === 'split_participant_id' && f.operator === 'in');
    const verificationFilter = this.filters.find(f => f.column === 'verification_status');

    if (this.tableName === 'merchants') {
      if (idFilter) {
        const res = await fetch(`${API_BASE}/merchants/${idFilter.value}`);
        if (!res.ok) return { data: null, error: { message: 'Merchant not found' } };
        const data = await res.json();
        return { data: this.isSingle || this.isMaybeSingle ? data : [data], error: null };
      }
      const res = await fetch(`${API_BASE}/merchants`);
      let data = await res.json();
      if (verificationFilter) {
        data = data.filter((m: any) => m.verification_status === verificationFilter.value);
      }
      return { data, error: null };
    }

    if (this.tableName === 'splits') {
      if (refFilter) {
        const res = await fetch(`${API_BASE}/splits/ref/${refFilter.value}`);
        if (!res.ok) return { data: null, error: { message: 'Split not found' } };
        const data = await res.json();
        return { data: this.isSingle || this.isMaybeSingle ? data : [data], error: null };
      }
      if (idFilter) {
        const res = await fetch(`${API_BASE}/splits/${idFilter.value}`);
        if (!res.ok) return { data: null, error: { message: 'Split not found' } };
        const data = await res.json();
        return { data: this.isSingle || this.isMaybeSingle ? data : [data], error: null };
      }
      const res = await fetch(`${API_BASE}/splits`);
      const data = await res.json();
      return { data, error: null };
    }

    if (this.tableName === 'split_participants') {
      const url = splitIdFilter ? `${API_BASE}/participants?split_id=${splitIdFilter.value}` : `${API_BASE}/participants`;
      const res = await fetch(url);
      let data = await res.json();
      if (idFilter) {
        data = data.filter((p: any) => p.id === idFilter.value);
        if (this.isSingle || this.isMaybeSingle) data = data[0] || null;
      }
      return { data, error: null };
    }

    if (this.tableName === 'allocation_items') {
      const url = splitIdFilter ? `${API_BASE}/allocation-items?split_id=${splitIdFilter.value}` : `${API_BASE}/allocation-items`;
      const res = await fetch(url);
      const data = await res.json();
      return { data, error: null };
    }

    if (this.tableName === 'payment_attempts') {
      const url = participantIdFilter ? `${API_BASE}/payment-attempts?split_participant_id=${participantIdFilter.value}` : `${API_BASE}/payment-attempts`;
      const res = await fetch(url);
      let data = await res.json();
      if (inParticipantIdsFilter && Array.isArray(inParticipantIdsFilter.value)) {
        const idSet = new Set(inParticipantIdsFilter.value);
        data = data.filter((p: any) => idSet.has(p.split_participant_id));
      }
      return { data, error: null };
    }

    if (this.tableName === 'audit_logs') {
      const res = await fetch(`${API_BASE}/audit-logs`);
      const data = await res.json();
      return { data, error: null };
    }

    return { data: [], error: null };
  }
}

class RealtimeChannelShim {
  on(_event: string, _filter: any, _callback?: (payload?: any) => void) {
    return this;
  }
  subscribe() {
    return this;
  }
  unsubscribe() {
    return this;
  }
}

export const supabase = {
  from: (tableName: string) => new PostgresQueryBuilder(tableName),
  channel: (_name: string) => new RealtimeChannelShim(),
  removeChannel: (_channel: any) => {}
};
