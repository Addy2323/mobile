import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Filter, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { supabase, type Split } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { getTranslation, type Language } from '@/lib/i18n';
import { CardSkeleton } from '../components/SkeletonLoader';
import { fetchUserSplits } from '@/lib/ledgerApi';
import { getOwnerId } from '@/lib/ownerId';

interface ActivityScreenProps {
  onSelectSplit: (split: Split) => void;
  language: Language;
}

export const ActivityScreen: React.FC<ActivityScreenProps> = ({ onSelectSplit, language }) => {
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'settled'>('all');

  const t = (key: any) => getTranslation(key, language);

  async function fetchSplits() {
    try {
      const data = await fetchUserSplits();
      setSplits(data || []);
    } catch (err) {
      console.error('Error loading activity:', err);
      try {
        const ownerId = getOwnerId();
        const { data } = await supabase
          .from('splits')
          .select('*')
          .eq('owner_user_id', ownerId)
          .order('created_at', { ascending: false });
        setSplits(data || []);
      } catch (e) {
        setSplits([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchSplits();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSplits();
  };

  const filteredSplits = splits.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());

    if (filter === 'open') return matchesSearch && s.status !== 'Settled';
    if (filter === 'settled') return matchesSearch && s.status === 'Settled';
    return matchesSearch;
  });

  return (
    <div className="p-4 space-y-4 no-tap-highlight text-white">
      {/* Search Bar & Refresh */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search splits by title or category..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0C181A] rounded-xl border border-white/10 text-sm font-medium text-white placeholder-white/40 focus:border-[#00E599] focus:outline-none"
          />
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 bg-[#0C181A] border border-white/10 rounded-xl text-white/70 hover:text-[#00E599] active:scale-95 transition-all"
          title="Refresh splits"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00E599]' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-[#0C181A] p-1 rounded-xl text-xs font-bold text-white/50 border border-white/10">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            filter === 'all' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-lg shadow-[#00E599]/20' : 'hover:text-white'
          }`}
        >
          All ({splits.length})
        </button>

        <button
          onClick={() => setFilter('open')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            filter === 'open' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-lg shadow-[#00E599]/20' : 'hover:text-white'
          }`}
        >
          Open ({splits.filter((s) => s.status !== 'Settled').length})
        </button>

        <button
          onClick={() => setFilter('settled')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            filter === 'settled' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-lg shadow-[#00E599]/20' : 'hover:text-white'
          }`}
        >
          Settled ({splits.filter((s) => s.status === 'Settled').length})
        </button>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="space-y-3 pt-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredSplits.length === 0 ? (
        <div className="bg-[#0C181A] p-8 rounded-3xl border border-white/10 text-center space-y-2 mt-4 shadow-xl">
          <Clock className="w-10 h-10 text-white/30 mx-auto" />
          <p className="text-sm font-semibold text-white/60">No activity matching filter</p>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {filteredSplits.map((split) => (
            <div
              key={split.id}
              onClick={() => onSelectSplit(split)}
              className="bg-[#0C181A] p-4 rounded-2xl border border-white/10 shadow-xl hover:border-[#00E599]/40 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{split.title}</span>
                  <StatusBadge status={split.status as any} />
                </div>
                <p className="text-xs text-white/50">
                  {split.participant_count} people · Created {formatDate(split.created_at)}
                </p>
              </div>

              <div className="text-right flex items-center space-x-2">
                <div>
                  <span className="text-sm font-extrabold text-white block">
                    {formatMoney(split.total_amount)}
                  </span>
                  <span className="text-[11px] font-extrabold text-[#00E599] block">
                    {split.settlement_percent || 0}% paid
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
