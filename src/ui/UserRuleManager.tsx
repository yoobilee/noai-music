import type { FormEvent, ReactNode } from 'react';

interface UserRuleSectionProps {
  children: ReactNode;
  className?: string;
  compact: boolean;
  description: string;
  heading: string;
  headingId: string;
  summaryCount: string;
  summaryDescription: string;
}

export function UserRuleSection({
  children,
  className = '',
  compact,
  description,
  heading,
  headingId,
  summaryCount,
  summaryDescription,
}: UserRuleSectionProps) {
  const classes = ['user-rule-manager', className].filter(Boolean).join(' ');

  if (compact) {
    return (
      <section aria-labelledby={headingId} className={classes}>
        <details className="user-rule-manager__disclosure">
          <summary>
            <span className="user-rule-manager__summary-copy">
              <span className="user-rule-manager__summary-heading" id={headingId}>
                {heading}
              </span>
              <span className="user-rule-manager__summary-description">
                {summaryDescription}
              </span>
            </span>
            <span
              aria-live="polite"
              className="user-rule-manager__summary-count"
            >
              {summaryCount}
            </span>
            <span aria-hidden="true" className="user-rule-manager__chevron" />
          </summary>
          <div className="user-rule-manager__compact-body">{children}</div>
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className={classes}>
      <header className="user-rule-manager__header">
        <h3 id={headingId}>{heading}</h3>
        <p>{description}</p>
      </header>
      <div className="user-rule-manager__full-body">{children}</div>
    </section>
  );
}

interface RuleInputFormProps {
  buttonLabel: string;
  disabled: boolean;
  error: boolean;
  errorId?: string;
  errorMessage: string;
  inputId: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  value: string;
}

export function RuleInputForm({
  buttonLabel,
  disabled,
  error,
  errorId,
  errorMessage,
  inputId,
  label,
  onChange,
  onSubmit,
  placeholder,
  value,
}: RuleInputFormProps) {
  const resolvedErrorId = errorId ?? `${inputId}-error`;

  return (
    <form className="user-rule-manager__form" onSubmit={onSubmit}>
      <label htmlFor={inputId}>{label}</label>
      <div className="user-rule-manager__input-row">
        <input
          aria-describedby={error ? resolvedErrorId : undefined}
          aria-invalid={error}
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          spellCheck={false}
          type="text"
          value={value}
        />
        <button disabled={disabled} type="submit">
          {buttonLabel}
        </button>
      </div>
      {error ? (
        <p className="user-rule-manager__field-error" id={resolvedErrorId}>
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

export interface RuleListItem {
  id: string;
  label?: string;
  onRemove: () => void;
  removeLabel: string;
  removeText: string;
}

interface RuleListGroupProps {
  disabled: boolean;
  emptyMessage: string;
  heading: string;
  headingLevel: 'h3' | 'h4';
  items: readonly RuleListItem[];
}

export function RuleListGroup({
  disabled,
  emptyMessage,
  heading,
  headingLevel: Heading,
  items,
}: RuleListGroupProps) {
  return (
    <div className="user-rule-manager__list-group">
      <Heading>
        <span>{heading}</span>
        <span className="user-rule-manager__group-count">{items.length}</span>
      </Heading>
      {items.length === 0 ? (
        <p className="user-rule-manager__empty">{emptyMessage}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className="user-rule-manager__identity">
                {item.label === undefined ? null : (
                  <strong>{item.label}</strong>
                )}
                <code>{item.id}</code>
              </span>
              <button
                aria-label={item.removeLabel}
                className="user-rule-manager__remove"
                disabled={disabled}
                onClick={item.onRemove}
                type="button"
              >
                {item.removeText}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
