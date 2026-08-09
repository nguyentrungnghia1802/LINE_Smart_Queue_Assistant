import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface ValidationError {
  control: FormControl;
  host: HTMLElement;
  id: string;
  message: string;
}

let nextErrorId = 0;
const errorIds = new WeakMap<FormControl, string>();
const originalDescribedBy = new WeakMap<FormControl, string | null>();
const managedControls = new WeakSet<FormControl>();

/**
 * Renders one localized HTML-constraint error next to the field that owns it.
 * API field errors remain owned by each form because they depend on request payload paths.
 */
export function FormValidationManager() {
  const { t, i18n } = useTranslation('common');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  useEffect(() => {
    function clear(control: FormControl) {
      setErrors((current) => current.filter((entry) => entry.control !== control));
      if (!managedControls.has(control)) return;
      control.removeAttribute('aria-invalid');
      restoreDescribedBy(control);
      managedControls.delete(control);
    }

    function show(control: FormControl) {
      const message = control.disabled ? null : constraintMessage(control, t);
      if (!message) {
        clear(control);
        return;
      }
      const host = validationHost(control);
      if (!host) return;
      const id = errorId(control);
      if (!managedControls.has(control)) {
        originalDescribedBy.set(control, control.getAttribute('aria-describedby'));
        managedControls.add(control);
      }
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', appendToken(originalDescribedBy.get(control), id));
      setErrors((current) => [
        ...current.filter((entry) => entry.control !== control && entry.control.isConnected),
        { control, host, id, message },
      ]);
    }

    function onInvalid(event: Event) {
      const control = asFormControl(event.target);
      if (!control) return;
      event.preventDefault();
      show(control);
    }

    function onFocusOut(event: Event) {
      const control = asFormControl(event.target);
      if (control) show(control);
    }

    function onInput(event: Event) {
      const control = asFormControl(event.target);
      if (control) show(control);
    }

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
      for (const entry of errorsRef.current) {
        entry.control.removeAttribute('aria-invalid');
        restoreDescribedBy(entry.control);
        managedControls.delete(entry.control);
      }
    };
  }, [i18n.resolvedLanguage, t]);

  return (
    <>
      {errors.map((error) =>
        createPortal(
          <p
            key={error.id}
            id={error.id}
            data-inline-field-error="true"
            className="mt-1 basis-full text-xs font-medium text-red-700"
            role="alert"
          >
            {error.message}
          </p>,
          error.host
        )
      )}
    </>
  );
}

function asFormControl(target: EventTarget | null): FormControl | null {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
    ? target
    : null;
}

function validationHost(control: FormControl): HTMLElement | null {
  const explicit = control.closest<HTMLElement>('[data-validation-field]');
  if (explicit) return explicit;
  const label = control.closest<HTMLLabelElement>('label');
  if (label) return label;
  const parent = control.parentElement;
  if (parent?.classList.contains('relative')) return parent.parentElement ?? parent;
  return parent;
}

function errorId(control: FormControl): string {
  const existing = errorIds.get(control);
  if (existing) return existing;
  nextErrorId += 1;
  const id = `field-validation-error-${nextErrorId}`;
  errorIds.set(control, id);
  return id;
}

function appendToken(existing: string | null | undefined, token: string): string {
  return [...new Set([...(existing?.split(/\s+/).filter(Boolean) ?? []), token])].join(' ');
}

function restoreDescribedBy(control: FormControl) {
  const original = originalDescribedBy.get(control);
  if (original) control.setAttribute('aria-describedby', original);
  else control.removeAttribute('aria-describedby');
  originalDescribedBy.delete(control);
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

function constraintMessage(control: FormControl, t: Translate): string | null {
  const validity = control.validity;
  if (validity.valueMissing) return t('validation.required');
  if (validity.typeMismatch) {
    return t(
      control instanceof HTMLInputElement && control.type === 'email'
        ? 'validation.email'
        : 'validation.format'
    );
  }
  if (validity.patternMismatch) return t('validation.format');
  if (
    !(control instanceof HTMLSelectElement) &&
    control.minLength >= 0 &&
    control.value.length > 0 &&
    control.value.length < control.minLength
  ) {
    return t('validation.minLength', { count: control.minLength });
  }
  if (
    !(control instanceof HTMLSelectElement) &&
    control.maxLength >= 0 &&
    control.value.length > control.maxLength
  ) {
    return t('validation.maxLength', { count: control.maxLength });
  }
  if (validity.rangeUnderflow && control instanceof HTMLInputElement) {
    return t('validation.min', { value: control.min });
  }
  if (validity.rangeOverflow && control instanceof HTMLInputElement) {
    return t('validation.max', { value: control.max });
  }
  if (validity.stepMismatch || validity.badInput) return t('validation.number');
  if (validity.customError && control.validationMessage) return control.validationMessage;
  if (!validity.valid) return t('validation.invalid');
  return null;
}
