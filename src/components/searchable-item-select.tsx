"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import type { InventoryItem } from "@/lib/types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function SearchableItemSelect({
  id,
  items,
  selectedId,
  onSelect,
  disabled = false,
}: {
  id: string;
  items: InventoryItem[];
  selectedId: string;
  onSelect: (itemId: string) => void;
  disabled?: boolean;
}) {
  const selectedItem = items.find((item) => item.id === selectedId);
  const [query, setQuery] = useState(selectedItem?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    if (
      !normalizedQuery ||
      normalizedQuery === normalizeSearch(selectedItem?.name ?? "")
    ) {
      return items;
    }

    return items.filter((item) =>
      normalizeSearch(item.name).includes(normalizedQuery),
    );
  }, [items, query, selectedItem?.name]);

  function chooseItem(item: InventoryItem) {
    onSelect(item.id);
    setQuery(item.name);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div
      className="searchable-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selectedItem?.name ?? "");
        }
      }}
    >
      <input type="hidden" name="itemId" value={selectedId} />

      <div
        className="searchable-select-control"
        onClick={() => inputRef.current?.focus()}
      >
        <Search aria-hidden="true" size={18} />
        <input
          id={id}
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Buscar item..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filteredItems[activeIndex]
              ? `${id}-option-${filteredItems[activeIndex].id}`
              : undefined
          }
          disabled={disabled}
          required
          onFocus={(event) => {
            setOpen(true);
            setActiveIndex(0);
            event.currentTarget.select();
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            setActiveIndex(0);

            if (normalizeSearch(nextQuery) !== normalizeSearch(selectedItem?.name ?? "")) {
              onSelect("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(filteredItems.length - 1, 0)),
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.max(current - 1, 0));
            }

            if (event.key === "Enter" && open && filteredItems[activeIndex]) {
              event.preventDefault();
              chooseItem(filteredItems[activeIndex]);
            }

            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selectedItem?.name ?? "");
            }
          }}
        />
        <ChevronDown
          className={open ? "searchable-select-chevron is-open" : "searchable-select-chevron"}
          aria-hidden="true"
          size={18}
        />
      </div>

      {open && (
        <div className="searchable-select-list" id={listboxId} role="listbox">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <button
                className={`searchable-select-option${
                  index === activeIndex ? " is-active" : ""
                }${item.id === selectedId ? " is-selected" : ""}`}
                id={`${id}-option-${item.id}`}
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === selectedId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseItem(item)}
              >
                <span>
                  {item.name}
                  {item.archivedAt ? " (arquivado)" : ""}
                </span>
                {item.id === selectedId && <Check aria-hidden="true" size={18} />}
              </button>
            ))
          ) : (
            <p className="searchable-select-empty">Nenhum item encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
