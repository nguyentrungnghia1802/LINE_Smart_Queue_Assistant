import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface QueueProductOption {
  id: string;
  product_code: string;
  name: string;
  is_active: boolean;
}

interface QueueProductPickerProps {
  products: QueueProductOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function QueueProductPicker({
  products,
  selectedIds,
  onChange,
}: Readonly<QueueProductPickerProps>) {
  const { t } = useTranslation(['manager', 'common']);
  const [search, setSearch] = useState('');
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter(
      (product) =>
        product.is_active &&
        (!query ||
          product.name.toLocaleLowerCase().includes(query) ||
          product.product_code.toLocaleLowerCase().includes(query))
    );
  }, [products, search]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <label className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('queue.productSearch')}</span>
        <input
          type="search"
          name="queueProductSearch"
          maxLength={160}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('queue.productSearchPlaceholder')}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="max-h-56 space-y-1 overflow-y-auto p-2">
        {visibleProducts.map((product) => (
          <label
            key={product.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(product.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selectedIds, product.id]
                    : selectedIds.filter((id) => id !== product.id)
                )
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
              {product.name}
            </span>
            <span className="shrink-0 font-mono text-xs font-bold text-gray-500">
              {product.product_code}
            </span>
          </label>
        ))}
        {visibleProducts.length === 0 && (
          <p className="px-2 py-5 text-center text-xs text-gray-500">{t('queue.productsEmpty')}</p>
        )}
      </div>
      <p className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
        {t('queue.productsSelected', { count: selectedIds.length })}
      </p>
    </div>
  );
}
