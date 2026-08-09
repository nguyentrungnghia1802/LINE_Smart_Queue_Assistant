import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Time24HourField } from './Time24HourField';

const meta = {
  title: 'Manager/Time24HourField',
  component: Time24HourField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Branch business-hour control. It always exposes the 00:00–23:59 Japan Standard Time range and does not use AM/PM.',
      },
    },
  },
} satisfies Meta<typeof Time24HourField>;

export default meta;
type Story = StoryObj<typeof meta>;

function TimeFieldPreview({ disabled = false }: Readonly<{ disabled?: boolean }>) {
  const { t } = useTranslation('manager');
  const [value, setValue] = useState('09:30');
  const weekdays = t('settings.weekdays', { returnObjects: true }) as string[];
  const day = weekdays[1] ?? 'Monday';

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5">
      <Time24HourField
        label={t('settings.openTimeLabel', { day })}
        hourLabel={t('settings.hour')}
        minuteLabel={t('settings.minute')}
        value={value}
        disabled={disabled}
        onChange={setValue}
      />
      <output className="mt-4 block text-center font-mono text-lg font-bold text-gray-950">
        {value}
      </output>
    </div>
  );
}

export const Editable: Story = {
  args: {
    label: 'Opening time',
    hourLabel: 'Hour',
    minuteLabel: 'Minute',
    value: '09:30',
    onChange: () => undefined,
  },
  render: () => <TimeFieldPreview />,
};

export const Disabled: Story = {
  args: {
    label: 'Opening time',
    hourLabel: 'Hour',
    minuteLabel: 'Minute',
    value: '09:30',
    onChange: () => undefined,
  },
  render: () => <TimeFieldPreview disabled />,
};
