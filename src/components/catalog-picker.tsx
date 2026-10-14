"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ReviewSelection } from "@/data/types";
import { useCatalogSearch } from "./use-catalog-search";

export function CatalogPicker({ kind, label, selected, onSelect }: {
  kind: "course" | "professor";
  label: string;
  selected: ReviewSelection | null;
  onSelect: (value: ReviewSelection | null) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [query, setQuery] = useState(selected?.primary ?? "");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { results, loading, failed } = useCatalogSearch(query, !selected, kind);
  const choices: ReviewSelection[] = kind === "course"
    ? results.courses.map(course => ({ id: course.id, primary: course.code, secondary: course.title }))
    : results.professors.map(professor => ({ id: professor.id, primary: professor.name, secondary: professor.title ?? "Boston College faculty" }));
  const activeIndex = choices.findIndex(choice => choice.id === activeId);
  const showPanel = open && !selected && !!query.trim();

  useEffect(() => {
    if (showPanel && activeIndex >= 0) options.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [showPanel, activeIndex]);

  function choose(value: ReviewSelection) {
    onSelect(value);
    setQuery(value.primary);
    input.current?.focus();
    setOpen(false);
    setActiveId(null);
  }

  function navigate(event: KeyboardEvent<HTMLElement>, fromOption = false) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      if (!showPanel) return;
      event.preventDefault();
      if (fromOption) input.current?.focus();
      setOpen(false);
      setActiveId(null);
      return;
    }
    if (selected || !choices.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = !showPanel || activeIndex < 0
        ? event.key === "ArrowDown" ? 0 : choices.length - 1
        : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
      setOpen(true);
      setActiveId(choices[next].id);
      if (fromOption) options.current[next]?.focus();
    } else if (event.key === "Enter" && showPanel && !fromOption) {
      event.preventDefault();
      choose(choices[activeIndex >= 0 ? activeIndex : 0]);
    }
  }

  return <div className="relative" onBlur={event => {
    // Tab moves into the suggestions; close only after focus leaves this picker.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
      setActiveId(null);
    }
  }}>
    <label className="form-label" htmlFor={inputId}>{label}</label>
    <input
      ref={input}
      id={inputId}
      className={`form-control ${selected ? "has-selection" : ""}`}
      value={selected?.primary ?? query}
      onChange={event => {
        setQuery(event.target.value);
        onSelect(null);
        setActiveId(null);
        setOpen(!!event.target.value.trim());
      }}
      onFocus={() => { if (!selected && query.trim()) setOpen(true); }}
      onKeyDown={event => navigate(event)}
      autoComplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showPanel}
      aria-controls={showPanel ? `${inputId}-choices` : undefined}
      aria-activedescendant={showPanel && activeIndex >= 0 ? `${inputId}-choice-${activeIndex}` : undefined}
      placeholder={kind === "course" ? "Search course code or title" : "Search professor name"}
      required
    />
    {selected ? <button type="button" className="absolute bottom-3 right-3 text-xs font-bold text-[var(--blue)]" onClick={() => {
      onSelect(null);
      setQuery("");
      setOpen(false);
      setActiveId(null);
      input.current?.focus();
    }}>Change</button> : null}
    {showPanel ? <div id={`${inputId}-choices`} role="listbox" aria-label={`${label} suggestions`} aria-busy={loading} className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)] p-2 shadow-xl">
      {loading && !choices.length ? <p role="status" className="p-3 text-sm text-[var(--muted)]">Searching…</p> : null}
      {!loading && !choices.length ? <p role="status" className="p-3 text-sm text-[var(--muted)]">{failed ? "Search is temporarily unavailable. Please try again." : "No matches found."}</p> : null}
      {choices.map((choice, index) => <button
        ref={element => { options.current[index] = element; }}
        id={`${inputId}-choice-${index}`}
        key={choice.id}
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={`result-row w-full text-left ${index === activeIndex ? "bg-[var(--wash)]" : ""}`}
        onMouseDown={event => event.preventDefault()}
        onFocus={() => setActiveId(choice.id)}
        onKeyDown={event => navigate(event, true)}
        onClick={() => choose(choice)}
      ><span><strong className="block text-sm text-[var(--ink)]">{choice.primary}{kind === "course" ? ` · ${choice.secondary}` : ""}</strong><span className="text-xs text-[var(--muted)]">{kind === "course" ? results.courses[index]?.subject : choice.secondary}</span></span></button>)}
    </div> : null}
  </div>;
}
