import { MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { post } from '../../services/apiClient';

export interface BranchMapLocation {
  latitude: number;
  longitude: number;
  placeId: string;
  formattedAddress: string;
}

interface BranchLocationPickerProps {
  addressQuery: string;
  value: BranchMapLocation | null;
  onChange: (location: BranchMapLocation) => void;
}

export function BranchLocationPicker({
  addressQuery,
  value,
  onChange,
}: Readonly<BranchLocationPickerProps>) {
  const { t } = useTranslation('manager');
  const [query, setQuery] = useState(addressQuery);
  const [results, setResults] = useState<BranchMapLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    const normalizedQuery = query.trim() || addressQuery.trim();
    if (normalizedQuery.length < 3) return;
    setLoading(true);
    setError('');
    try {
      const nextResults = await post<BranchMapLocation[]>('/api/v1/branches/geocode', {
        query: normalizedQuery,
      });
      setResults(nextResults);
      if (nextResults.length === 0) setError(t('branches.locationSearchEmpty'));
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : t('branches.locationSearchError')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {t('branches.locationSearch')}
      </span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="sr-only">{t('branches.locationSearch')}</span>
          <input
            type="search"
            name="branchLocationSearch"
            maxLength={500}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('branches.locationSearchPlaceholder')}
            className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void search()}
          className="rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? t('branches.locationSearching') : t('branches.searchMap')}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">{t('branches.locationSearchHelp')}</p>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {results.length > 0 && (
        <div className="mt-3 divide-y rounded-lg border border-gray-200 bg-white">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              onClick={() => {
                onChange(result);
                setQuery(result.formattedAddress);
                setResults([]);
              }}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span>{result.formattedAddress}</span>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-start gap-2 px-3 py-3 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold text-gray-950">{t('branches.selectedLocation')}</p>
              <p className="mt-0.5 text-gray-600">{value.formattedAddress}</p>
            </div>
          </div>
          <iframe
            title={t('branches.selectedLocation')}
            src={`https://www.google.com/maps?q=${encodeURIComponent(`${value.latitude},${value.longitude}`)}&z=17&output=embed`}
            className="h-[28rem] w-full border-0 sm:h-[32rem]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
}
