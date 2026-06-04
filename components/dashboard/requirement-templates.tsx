"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiFetch } from "./api";

type CoverageType = "general_liability" | "auto" | "umbrella" | "workers_comp";

type Rule = {
  min_each_occurrence?: number | null;
  min_aggregate?: number | null;
  additional_insured_required?: boolean;
};

type RequirementTemplate = {
  id: string;
  name: string;
  rules: Partial<Record<CoverageType, Rule>>;
  expiring_soon_window_days: number;
};

type RuleFormState = Record<
  CoverageType,
  {
    enabled: boolean;
    minEachOccurrence: string;
    minAggregate: string;
    additionalInsuredRequired: boolean;
  }
>;

const coverageOptions: { type: CoverageType; label: string }[] = [
  { type: "general_liability", label: "General liability" },
  { type: "auto", label: "Auto liability" },
  { type: "umbrella", label: "Umbrella" },
  { type: "workers_comp", label: "Workers compensation" }
];

const emptyRules: RuleFormState = {
  general_liability: {
    enabled: true,
    minEachOccurrence: "1000000",
    minAggregate: "2000000",
    additionalInsuredRequired: true
  },
  auto: {
    enabled: true,
    minEachOccurrence: "1000000",
    minAggregate: "",
    additionalInsuredRequired: true
  },
  umbrella: {
    enabled: false,
    minEachOccurrence: "",
    minAggregate: "",
    additionalInsuredRequired: false
  },
  workers_comp: {
    enabled: false,
    minEachOccurrence: "",
    minAggregate: "",
    additionalInsuredRequired: false
  }
};

export function RequirementTemplates() {
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("Default vendor requirements");
  const [windowDays, setWindowDays] = useState("30");
  const [rules, setRules] = useState<RuleFormState>(emptyRules);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("Loading requirement templates.");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await apiFetch<{ requirements: RequirementTemplate[] }>("/api/requirements");
        if (!active) return;
        setTemplates(response.requirements);
        setMessage("");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Requirements failed to load.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  function loadTemplate(id: string) {
    setSelectedId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) {
      resetForm();
      return;
    }

    setName(template.name);
    setWindowDays(String(template.expiring_soon_window_days));
    setRules(toRuleFormState(template.rules));
    setMessage(`${template.name} loaded for editing.`);
  }

  function resetForm() {
    setSelectedId("");
    setName("Default vendor requirements");
    setWindowDays("30");
    setRules(emptyRules);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const enabledRules = toRulesPayload(rules);
    if (Object.keys(enabledRules).length === 0) {
      setMessage("Select at least one coverage requirement.");
      return;
    }

    setIsSubmitting(true);
    setMessage(selectedTemplate ? "Updating requirement template." : "Creating requirement template.");

    try {
      const body = {
        name,
        rules: enabledRules,
        expiring_soon_window_days: Number(windowDays)
      };
      const path = selectedTemplate ? `/api/requirements/${selectedTemplate.id}` : "/api/requirements";
      const method = selectedTemplate ? "PATCH" : "POST";
      const response = await apiFetch<{ requirement: RequirementTemplate }>(path, {
        method,
        body: JSON.stringify(body)
      });

      setTemplates((current) => {
        const exists = current.some((template) => template.id === response.requirement.id);
        if (exists) {
          return current.map((template) =>
            template.id === response.requirement.id ? response.requirement : template
          );
        }
        return [response.requirement, ...current];
      });
      setSelectedId(response.requirement.id);
      setMessage(`${response.requirement.name} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Requirement template could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateRule(
    coverageType: CoverageType,
    patch: Partial<RuleFormState[CoverageType]>
  ) {
    setRules((current) => ({
      ...current,
      [coverageType]: {
        ...current[coverageType],
        ...patch
      }
    }));
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Compliance setup</p>
        <h1>Requirements</h1>
      </header>

      <section className="section-block" aria-labelledby="template-list-title">
        <div className="section-header">
          <h2 id="template-list-title">Requirement templates</h2>
          <button className="button-secondary" type="button" onClick={resetForm}>
            New template
          </button>
        </div>
        {message ? <p role="status">{message}</p> : null}
        <div className="template-list">
          {templates.map((template) => (
            <button
              className={template.id === selectedId ? "template-button template-button-active" : "template-button"}
              type="button"
              key={template.id}
              onClick={() => loadTemplate(template.id)}
              aria-pressed={template.id === selectedId}
            >
              <span>{template.name}</span>
              <small>{template.expiring_soon_window_days} day expiry window</small>
            </button>
          ))}
          {templates.length === 0 && !message ? <p>No requirement templates have been saved yet.</p> : null}
        </div>
      </section>

      <section className="section-block" aria-labelledby="template-form-title">
        <h2 id="template-form-title">{selectedTemplate ? "Edit template" : "Create template"}</h2>
        <form className="form-panel wide-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="requirement-name">Template name</label>
              <input
                id="requirement-name"
                name="requirement-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="expiring-window">Expiring soon window in days</label>
              <input
                id="expiring-window"
                name="expiring-window"
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={windowDays}
                onChange={(event) => setWindowDays(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="rules-fieldset">
            <legend>Coverage rules</legend>
            {coverageOptions.map((coverage) => {
              const state = rules[coverage.type];
              return (
                <div className="rule-row" key={coverage.type}>
                  <div className="checkbox-field">
                    <input
                      id={`${coverage.type}-enabled`}
                      type="checkbox"
                      checked={state.enabled}
                      onChange={(event) => updateRule(coverage.type, { enabled: event.target.checked })}
                    />
                    <label htmlFor={`${coverage.type}-enabled`}>{coverage.label}</label>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`${coverage.type}-each`}>Minimum each occurrence</label>
                      <input
                        id={`${coverage.type}-each`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        disabled={!state.enabled}
                        value={state.minEachOccurrence}
                        onChange={(event) =>
                          updateRule(coverage.type, { minEachOccurrence: event.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`${coverage.type}-aggregate`}>Minimum aggregate</label>
                      <input
                        id={`${coverage.type}-aggregate`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        disabled={!state.enabled}
                        value={state.minAggregate}
                        onChange={(event) =>
                          updateRule(coverage.type, { minAggregate: event.target.value })
                        }
                      />
                    </div>
                    <div className="checkbox-field checkbox-field-end">
                      <input
                        id={`${coverage.type}-additional-insured`}
                        type="checkbox"
                        disabled={!state.enabled}
                        checked={state.additionalInsuredRequired}
                        onChange={(event) =>
                          updateRule(coverage.type, {
                            additionalInsuredRequired: event.target.checked
                          })
                        }
                      />
                      <label htmlFor={`${coverage.type}-additional-insured`}>
                        Additional insured required
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </fieldset>

          <div className="action-row">
            <button className="button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving" : selectedTemplate ? "Update template" : "Create template"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function toRulesPayload(rules: RuleFormState): Partial<Record<CoverageType, Rule>> {
  return coverageOptions.reduce<Partial<Record<CoverageType, Rule>>>((acc, coverage) => {
    const state = rules[coverage.type];
    if (!state.enabled) return acc;

    acc[coverage.type] = {
      ...(state.minEachOccurrence !== "" ? { min_each_occurrence: Number(state.minEachOccurrence) } : {}),
      ...(state.minAggregate !== "" ? { min_aggregate: Number(state.minAggregate) } : {}),
      additional_insured_required: state.additionalInsuredRequired
    };
    return acc;
  }, {});
}

function toRuleFormState(rules: RequirementTemplate["rules"]): RuleFormState {
  return coverageOptions.reduce<RuleFormState>((acc, coverage) => {
    const rule = rules[coverage.type];
    acc[coverage.type] = {
      enabled: Boolean(rule),
      minEachOccurrence: numberToInput(rule?.min_each_occurrence),
      minAggregate: numberToInput(rule?.min_aggregate),
      additionalInsuredRequired: Boolean(rule?.additional_insured_required)
    };
    return acc;
  }, structuredClone(emptyRules));
}

function numberToInput(value: number | null | undefined) {
  return value == null ? "" : String(value);
}
